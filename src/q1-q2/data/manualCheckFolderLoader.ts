import type {
  AbilityKey,
  LoadedManualCheckItem,
  ManualCheckDataset,
  ManualCheckDatasetEntry,
  ManualCheckManifestRow,
  ManualCheckRunSummary,
  TaskKey,
  TrackKey,
  UploadedFileIndex,
} from '../types';

const TRACK_ROOTS: Record<TrackKey, string> = {
  Q1: 'benchmark_construction_check_data',
  Q2: 'LLM_as_judge_Human_Alignment_data',
};

const TRACK_ORDER: TrackKey[] = ['Q1', 'Q2'];
const TASK_ORDER: TaskKey[] = ['task1', 'task2', 'task3', 'task4'];
const ABILITY_ORDER: AbilityKey[] = ['ability1', 'ability2', 'ability3', 'ability4', 'ability5'];

interface ParsedManifestPath {
  track: TrackKey;
  task: TaskKey;
  ability?: AbilityKey;
  manifestPath: string;
  baseDir: string;
}

function pathExists(index: UploadedFileIndex, relativePath: string): boolean {
  return index.filesByRelativePath.has(relativePath);
}

async function readTextFromIndex(index: UploadedFileIndex, relativePath: string): Promise<string> {
  const file = index.filesByRelativePath.get(relativePath);

  if (!file) {
    throw new Error(`Missing required file: ${relativePath}`);
  }

  return file.text();
}

async function readJsonFromIndex<T>(index: UploadedFileIndex, relativePath: string): Promise<T> {
  const text = await readTextFromIndex(index, relativePath);
  return JSON.parse(text) as T;
}

function toEntryTitle(track: TrackKey, task: TaskKey, ability?: AbilityKey): string {
  if (task === 'task4' && ability) {
    return `${track} / ${task} / ${ability}`;
  }

  return `${track} / ${task}`;
}

function inferTrackFromPath(index: UploadedFileIndex, manifestPath: string): TrackKey | null {
  const segments = manifestPath.split('/');
  const firstSegment = segments[0];

  const explicitTrack = Object.entries(TRACK_ROOTS).find(([, root]) => root === firstSegment)?.[0];
  if (explicitTrack) {
    return explicitTrack as TrackKey;
  }

  const rootTrack = Object.entries(TRACK_ROOTS).find(([, root]) => root === index.rootName)?.[0];
  if (rootTrack) {
    return rootTrack as TrackKey;
  }

  return null;
}

function parseManifestPath(index: UploadedFileIndex, manifestPath: string): ParsedManifestPath | null {
  const track = inferTrackFromPath(index, manifestPath);
  if (!track) {
    return null;
  }

  const segments = manifestPath.split('/');
  const trackRoot = TRACK_ROOTS[track];
  const relativeSegments = segments[0] === trackRoot ? segments.slice(1) : segments;

  if (relativeSegments.length < 2) {
    return null;
  }

  const task = relativeSegments[0] as TaskKey;
  if (!TASK_ORDER.includes(task)) {
    return null;
  }

  const ability = task === 'task4' ? (relativeSegments[1] as AbilityKey | undefined) : undefined;
  if (task === 'task4' && ability && !ABILITY_ORDER.includes(ability)) {
    return null;
  }

  return {
    track,
    task,
    ability,
    manifestPath,
    baseDir: manifestPath.replace(/\/manifest\.json$/, ''),
  };
}

function getManifestCandidates(index: UploadedFileIndex, runSummary?: ManualCheckRunSummary): string[] {
  const candidates = new Set<string>();

  if (runSummary?.tasks?.length) {
    runSummary.tasks.forEach((taskSpec) => {
      Object.values(TRACK_ROOTS).forEach((trackRoot) => {
        const manifestPath = `${trackRoot}/${taskSpec.task}/manifest.json`;
        if (pathExists(index, manifestPath)) {
          candidates.add(manifestPath);
        }
      });
    });
  }

  index.allRelativePaths.forEach((relativePath) => {
    if (relativePath === 'manifest.json' || relativePath.endsWith('/manifest.json')) {
      candidates.add(relativePath);
    }
  });

  return Array.from(candidates);
}

function sortEntries(entries: ManualCheckDatasetEntry[]): ManualCheckDatasetEntry[] {
  return [...entries].sort((left, right) => {
    const trackDiff = TRACK_ORDER.indexOf(left.track) - TRACK_ORDER.indexOf(right.track);
    if (trackDiff !== 0) {
      return trackDiff;
    }

    const taskDiff = TASK_ORDER.indexOf(left.task) - TASK_ORDER.indexOf(right.task);
    if (taskDiff !== 0) {
      return taskDiff;
    }

    const leftAbilityIndex = left.ability ? ABILITY_ORDER.indexOf(left.ability) : -1;
    const rightAbilityIndex = right.ability ? ABILITY_ORDER.indexOf(right.ability) : -1;
    return leftAbilityIndex - rightAbilityIndex;
  });
}

export async function loadManualCheckDataset(index: UploadedFileIndex): Promise<ManualCheckDataset> {
  const warnings: string[] = [];
  let runSummary: ManualCheckRunSummary | undefined;

  if (pathExists(index, 'run_summary.json')) {
    runSummary = await readJsonFromIndex<ManualCheckRunSummary>(index, 'run_summary.json');
  } else {
    warnings.push('`run_summary.json` was not found. Discovery fell back to manifest scanning.');
  }

  const manifestPaths = getManifestCandidates(index, runSummary);
  const entries: ManualCheckDatasetEntry[] = [];

  for (const manifestPath of manifestPaths) {
    const parsedPath = parseManifestPath(index, manifestPath);

    if (!parsedPath) {
      warnings.push(`Skipped manifest with unsupported import scope: ${manifestPath}`);
      continue;
    }

    const manifestRows = await readJsonFromIndex<ManualCheckManifestRow[]>(index, manifestPath);
    entries.push({
      id: `${parsedPath.track}:${parsedPath.task}:${parsedPath.ability ?? 'none'}`,
      track: parsedPath.track,
      task: parsedPath.task,
      ability: parsedPath.ability,
      manifestPath: parsedPath.manifestPath,
      baseDir: parsedPath.baseDir,
      title: toEntryTitle(parsedPath.track, parsedPath.task, parsedPath.ability),
      manifestRows,
      itemCount: manifestRows.length,
    });
  }

  if (entries.length === 0) {
    throw new Error(
      'No supported manifests were found. Please upload the `manual_check_data` root folder or one track-level folder.',
    );
  }

  return {
    sourceType: 'manual_check_data_folder',
    rootName: index.rootName,
    datasetFingerprint: index.datasetFingerprint,
    uploadedFileIndex: index,
    runSummary,
    entries: sortEntries(entries),
    warnings,
  };
}

export function getManifestRowAssignedModel(manifestRow: ManualCheckManifestRow): string | null {
  return (
    (typeof manifestRow.assigned_model === 'string' && manifestRow.assigned_model) ||
    (typeof manifestRow.assigned_model_for_judge_track === 'string' &&
      manifestRow.assigned_model_for_judge_track) ||
    null
  );
}

export function getItemRelativePath(entry: ManualCheckDatasetEntry, manifestRow: ManualCheckManifestRow): string {
  return `${entry.baseDir}/sessions/${manifestRow.session_id}__${manifestRow.canonical_id}/item.json`;
}

export function buildAnnotationDraftKey(params: {
  track: TrackKey;
  task: TaskKey;
  ability?: AbilityKey;
  sessionId: string;
  canonicalId: string;
}): string {
  return `${params.track}:${params.task}:${params.ability ?? 'none'}:${params.sessionId}:${params.canonicalId}`;
}

export async function loadManualCheckItem(
  dataset: ManualCheckDataset,
  entry: ManualCheckDatasetEntry,
  rowIndex: number,
): Promise<LoadedManualCheckItem> {
  const manifestRow = entry.manifestRows[rowIndex];

  if (!manifestRow) {
    throw new Error(`Item index ${rowIndex + 1} is out of range for ${entry.title}.`);
  }

  const itemPath = getItemRelativePath(entry, manifestRow);
  let itemData: Record<string, unknown>;

  if (dataset.sourceType === 'manual_check_data_folder') {
    if (!dataset.uploadedFileIndex) {
      throw new Error('Uploaded file index is missing for the current folder dataset.');
    }

    itemData = await readJsonFromIndex<Record<string, unknown>>(dataset.uploadedFileIndex, itemPath);
  } else {
    const bundledItem = dataset.bundledItemsByRelativePath?.get(itemPath);

    if (!bundledItem) {
      throw new Error(`Merged bundle is missing item data for ${itemPath}.`);
    }

    itemData = bundledItem;
  }

  return {
    entry,
    manifestRow,
    itemPath,
    itemData,
  };
}
