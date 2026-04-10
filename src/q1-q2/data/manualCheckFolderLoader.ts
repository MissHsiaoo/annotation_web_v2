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
const SESSION_PACKET_TRACK_ROOT = 'cleaned_data/task123_session_packets';

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

interface SessionPacketDiscovery {
  manifestPath: string;
  baseDir: string;
  packetFiles: string[];
  isChunked: boolean;
}

function pathExists(index: UploadedFileIndex, relativePath: string): boolean {
  return index.filesByRelativePath.has(relativePath);
}

function joinPath(...parts: string[]): string {
  return parts.filter(Boolean).join('/');
}

function getDirName(relativePath: string): string {
  const lastSlash = relativePath.lastIndexOf('/');
  return lastSlash >= 0 ? relativePath.slice(0, lastSlash) : '';
}

function getFileName(relativePath: string): string {
  const lastSlash = relativePath.lastIndexOf('/');
  return lastSlash >= 0 ? relativePath.slice(lastSlash + 1) : relativePath;
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

async function readTextPrefixFromIndex(
  index: UploadedFileIndex,
  relativePath: string,
  charCount: number,
): Promise<string> {
  const file = index.filesByRelativePath.get(relativePath);

  if (!file) {
    throw new Error(`Missing required file: ${relativePath}`);
  }

  return file.slice(0, charCount).text();
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

function isSessionPacketManifest(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const manifest = value as Record<string, unknown>;
  return (
    typeof manifest.session_file_count === 'number' ||
    (typeof manifest.chunk_size === 'number' && Array.isArray(manifest.sessions))
  );
}

function isChunkedSessionPacketManifest(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const manifest = value as Record<string, unknown>;
  return Array.isArray(manifest.chunks) && typeof manifest.chunk_size === 'number';
}

function getSessionPacketFilesInDir(index: UploadedFileIndex, dirName: string): string[] {
  return index.allRelativePaths
    .filter(
      (relativePath) =>
        getDirName(relativePath) === dirName &&
        /^sess_[^/]+\.json$/.test(getFileName(relativePath)),
    )
    .sort();
}

async function findSessionPacketDiscovery(index: UploadedFileIndex): Promise<SessionPacketDiscovery | null> {
  if (pathExists(index, 'manifest.json')) {
    try {
      const rootManifest = await readJsonFromIndex<unknown>(index, 'manifest.json');
      if (isChunkedSessionPacketManifest(rootManifest)) {
        const packetFiles = index.allRelativePaths
          .filter((relativePath) => /^chunks\/chunk_[^/]+\/sess_[^/]+\.json$/.test(relativePath))
          .sort();

        if (packetFiles.length > 0) {
          return {
            manifestPath: 'manifest.json',
            baseDir: 'chunks',
            packetFiles,
            isChunked: true,
          };
        }
      }
    } catch {
      // Fall back to the legacy session-packet discovery below.
    }
  }

  // Parent directory uploaded (e.g. task1_3_annotation_data containing chunks/)
  const nestedChunkPacketFiles = index.allRelativePaths
    .filter((relativePath) => /^chunks\/chunk_[^/]+\/sess_[^/]+\.json$/.test(relativePath))
    .sort();

  if (nestedChunkPacketFiles.length > 0) {
    return {
      manifestPath: pathExists(index, 'chunks/manifest.json') ? 'chunks/manifest.json' : 'chunks',
      baseDir: 'chunks',
      packetFiles: nestedChunkPacketFiles,
      isChunked: true,
    };
  }

  // chunks/ folder uploaded directly (paths: chunk_0001/sess_*.json)
  const directChunkPacketFiles = index.allRelativePaths
    .filter((relativePath) => /^chunk_[^/]+\/sess_[^/]+\.json$/.test(relativePath))
    .sort();

  if (directChunkPacketFiles.length > 0) {
    return {
      manifestPath: pathExists(index, 'manifest.json') ? 'manifest.json' : 'chunks',
      baseDir: '',
      packetFiles: directChunkPacketFiles,
      isChunked: true,
    };
  }

  const candidateDirs = new Set<string>();

  index.allRelativePaths.forEach((relativePath) => {
    if (/^sess_[^/]+\.json$/.test(getFileName(relativePath))) {
      candidateDirs.add(getDirName(relativePath));
    }
  });

  const orderedCandidates = [
    SESSION_PACKET_TRACK_ROOT,
    'task123_session_packets',
    '',
    ...Array.from(candidateDirs).sort(),
  ];

  for (const candidateDir of orderedCandidates) {
    if (!candidateDirs.has(candidateDir) && candidateDir !== SESSION_PACKET_TRACK_ROOT && candidateDir !== 'task123_session_packets' && candidateDir !== '') {
      continue;
    }

    const manifestPath = joinPath(candidateDir, 'manifest.json');
    if (!pathExists(index, manifestPath)) {
      continue;
    }

    try {
      const manifestValue = await readJsonFromIndex<unknown>(index, manifestPath);
      if (isSessionPacketManifest(manifestValue)) {
        const packetFiles = getSessionPacketFilesInDir(index, candidateDir);
        if (packetFiles.length > 0) {
          return {
            manifestPath,
            baseDir: candidateDir,
            packetFiles,
            isChunked: false,
          };
        }
      }
    } catch {
      continue;
    }
  }

  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function getTask4RecordCanonicalId(
  sessionId: string,
  ability: AbilityKey,
  record: Record<string, unknown>,
  recordIndex: number,
): string {
  const queries = Array.isArray(record.queries) ? record.queries : [];
  const firstQuery = asRecord(queries[0]);

  return (
    (typeof firstQuery?.query_id === 'string' && firstQuery.query_id.trim()) ||
    `${sessionId}:${ability}:${recordIndex + 1}`
  );
}

async function loadSessionPacketDataset(index: UploadedFileIndex, discovery: SessionPacketDiscovery): Promise<ManualCheckDataset> {
  if (discovery.packetFiles.length === 0) {
    throw new Error('No session packet files were found next to the task123 manifest.');
  }

  const rowsByTask: Record<'task1' | 'task2' | 'task3', ManualCheckManifestRow[]> = {
    task1: [],
    task2: [],
    task3: [],
  };
  const task4Rows: ManualCheckManifestRow[] = [];

  const prefixTexts = await Promise.all(
    discovery.packetFiles.map((relativePath) => readTextPrefixFromIndex(index, relativePath, 768)),
  );

  for (const [indexWithinList, relativePath] of discovery.packetFiles.entries()) {
    const sessionId = getFileName(relativePath).replace(/\.json$/, '');
    const prefixText = prefixTexts[indexWithinList];
    const taskAvailability = {
      task1: /"task1"\s*:\s*true/.test(prefixText),
      task2: /"task2"\s*:\s*true/.test(prefixText),
      task3: /"task3"\s*:\s*true/.test(prefixText),
      task4: /"task4"\s*:\s*true/.test(prefixText),
    };

    (['task1', 'task2', 'task3'] as const).forEach((taskKey) => {
      if (!taskAvailability[taskKey]) {
        return;
      }

      rowsByTask[taskKey].push({
        canonical_id: sessionId,
        session_id: sessionId,
        packet_relative_path: relativePath,
      });
    });

    if (taskAvailability.task4) {
      const packet = await readJsonFromIndex<Record<string, unknown>>(index, relativePath);
      const task4Records = Array.isArray(packet.task4) ? packet.task4 : [];

      if (task4Records.length > 0) {
        task4Rows.push({
          canonical_id: `${sessionId}:task4`,
          session_id: sessionId,
          packet_relative_path: relativePath,
          task4_record_count: task4Records.length,
        });
      } else {
        task4Rows.push({
          canonical_id: `${sessionId}:task4`,
          session_id: sessionId,
          packet_relative_path: relativePath,
          task4_record_count: 0,
        });
      }
    }
  }

  const entries: ManualCheckDatasetEntry[] = (['task1', 'task2', 'task3'] as const)
    .filter((taskKey) => rowsByTask[taskKey].length > 0)
    .map((taskKey) => ({
      id: `Q1:${taskKey}:none`,
      track: 'Q1' as const,
      task: taskKey,
      manifestPath: discovery.manifestPath,
      baseDir: discovery.baseDir,
      title: toEntryTitle('Q1', taskKey),
      manifestRows: rowsByTask[taskKey],
      itemCount: rowsByTask[taskKey].length,
    }));

  if (task4Rows.length > 0) {
    entries.push({
      id: 'Q1:task4:none',
      track: 'Q1',
      task: 'task4',
      manifestPath: discovery.manifestPath,
      baseDir: discovery.baseDir,
      title: toEntryTitle('Q1', 'task4'),
      manifestRows: task4Rows,
      itemCount: task4Rows.length,
    });
  }

  return {
    sourceType: 'session_packet_folder',
    rootName: index.rootName,
    datasetFingerprint: index.datasetFingerprint,
    uploadedFileIndex: index,
    sessionPacketBaseDir: discovery.baseDir,
    entries: sortEntries(entries),
    warnings: [
      discovery.isChunked
        ? '已从 `chunks/chunk_*/sess_*.json` 加载 Q1 会话数据包。该数据集中不包含 Q2 评审对齐视图。'
        : '已从 `task123_session_packets` 加载 Q1 会话数据包。该数据集中不包含 Q2 评审对齐视图。',
      'task1-3 数量依据每个数据包文件中的 `available_tasks` 标记推导；task4 按包含 task4 query 的 session 计数，一个 session 作为一条待标注样本。',
    ],
  };
}

function normalizeSessionPacketItem(
  task: TaskKey,
  packet: Record<string, unknown>,
  ability?: AbilityKey,
  manifestRow?: ManualCheckManifestRow,
): Record<string, unknown> {
  const sessionId =
    typeof packet.session_id === 'string' && packet.session_id.trim() ? packet.session_id : 'unknown_session';
  const dialogue = Array.isArray(packet.dialogue) ? packet.dialogue : [];
  const task1 = packet.task1 && typeof packet.task1 === 'object' ? (packet.task1 as Record<string, unknown>) : null;
  const task2 = packet.task2 && typeof packet.task2 === 'object' ? (packet.task2 as Record<string, unknown>) : null;
  const task3 = packet.task3 && typeof packet.task3 === 'object' ? (packet.task3 as Record<string, unknown>) : null;

  if (task === 'task1') {
    return {
      task: 'task1',
      canonical_id:
        (typeof task1?.canonical_id === 'string' && task1.canonical_id) ||
        (typeof task1?.record_id === 'string' && task1.record_id) ||
        sessionId,
      session_id: sessionId,
      stratum: task1?.stratum ?? null,
      source_format: 'task123_session_packet',
      original: {
        record_id: task1?.record_id ?? task1?.canonical_id ?? sessionId,
        probe: {
          dialogue,
          ground_truth_memories: Array.isArray(task1?.ground_truth_memories) ? task1.ground_truth_memories : [],
          llm_outputs:
            task1?.llm_outputs && typeof task1.llm_outputs === 'object' ? task1.llm_outputs : {},
          query: task1?.memory_extraction_query ?? null,
          metadata: task1?.metadata ?? null,
        },
      },
    };
  }

  if (task === 'task2') {
    return {
      task: 'task2',
      canonical_id: (typeof task2?.canonical_id === 'string' && task2.canonical_id) || sessionId,
      session_id: sessionId,
      stratum: task2?.stratum ?? null,
      source_format: 'task123_session_packet',
      original: {
        memory: Array.isArray(task2?.memory_pool_before_update) ? task2.memory_pool_before_update : [],
        record: {
          new_dialogue: Array.isArray(task2?.new_dialogue) ? task2.new_dialogue : [],
        },
        answer: Array.isArray(task2?.golden_answer) ? task2.golden_answer : [],
        selected_memory: task2?.task2_selected_memory ?? null,
        metadata: task2?.metadata ?? null,
      },
    };
  }

  if (task === 'task3') {
    return {
      task: 'task3',
      canonical_id: (typeof task3?.canonical_id === 'string' && task3.canonical_id) || sessionId,
      session_id: sessionId,
      stratum: task3?.stratum ?? null,
      source_format: 'task123_session_packet',
      original: {
        query: task3?.query ?? '',
        selected_memory: task3?.task3_selected_memory ?? null,
        candidate_memories: Array.isArray(task3?.candidate_memories) ? task3.candidate_memories : [],
        metadata: task3?.metadata ?? null,
      },
    };
  }

  if (task === 'task4') {
    const task4Records = Array.isArray(packet.task4) ? packet.task4 : [];
    const requestedIndex =
      typeof manifestRow?.task4_record_index === 'number' ? manifestRow.task4_record_index : -1;
    const indexedTask4Records = task4Records
      .map((rawRecord, recordIndex) => ({
        record: asRecord(rawRecord),
        recordIndex,
      }))
      .filter((item): item is { record: Record<string, unknown>; recordIndex: number } => Boolean(item.record));
    const selectedTask4Records =
      requestedIndex >= 0
        ? indexedTask4Records.filter((item) => item.recordIndex === requestedIndex)
        : ability
          ? indexedTask4Records.filter((item) => item.record.ability === ability)
          : indexedTask4Records;
    const firstTask4Record = selectedTask4Records[0]?.record ?? null;
    const selectedMemory = asRecord(firstTask4Record?.task4_selected_memory);
    const selectedMemoryId =
      (typeof firstTask4Record?.task4_selected_memory_id === 'string' && firstTask4Record.task4_selected_memory_id) ||
      (typeof selectedMemory?.memory_id === 'string' && selectedMemory.memory_id) ||
      null;
    const candidateMemories = Array.isArray(task1?.ground_truth_memories) ? task1.ground_truth_memories : [];
    const flattenedQueries = selectedTask4Records.flatMap(({ record, recordIndex }) => {
      const recordAbility = record.ability as AbilityKey | undefined;
      const recordSelectedMemory = asRecord(record.task4_selected_memory);
      const recordSelectedMemoryId =
        (typeof record.task4_selected_memory_id === 'string' && record.task4_selected_memory_id) ||
        (typeof recordSelectedMemory?.memory_id === 'string' && recordSelectedMemory.memory_id) ||
        null;
      const queries = Array.isArray(record.queries) ? record.queries : [];

      return queries.flatMap((rawQuery, queryIndex) => {
        const queryRecord = asRecord(rawQuery);
        const queryText = typeof queryRecord?.query === 'string' ? queryRecord.query : '';

        if (!queryText.trim()) {
          return [];
        }

        return [
          {
            ...queryRecord,
            query_id:
              (typeof queryRecord?.query_id === 'string' && queryRecord.query_id.trim()) ||
              `${sessionId}:task4:${recordIndex + 1}:query-${queryIndex + 1}`,
            query: queryText,
            ability: recordAbility,
            task4_record_index: recordIndex,
            task4_selected_memory_id: recordSelectedMemoryId,
            task4_selected_memory: recordSelectedMemory,
          },
        ];
      });
    });
    const selectedMemories = selectedTask4Records
      .map(({ record }) => asRecord(record.task4_selected_memory))
      .filter(Boolean) as Record<string, unknown>[];

    return {
      task: ability ? `task4/${ability}` : 'task4',
      canonical_id:
        (typeof manifestRow?.canonical_id === 'string' && manifestRow.canonical_id) ||
        (ability && firstTask4Record
          ? getTask4RecordCanonicalId(sessionId, ability, firstTask4Record, Math.max(0, requestedIndex))
          : `${sessionId}:task4`),
      session_id: sessionId,
      stratum: firstTask4Record?.stratum ?? task1?.stratum ?? null,
      source_format: 'task123_session_packet',
      original: {
        session_id: sessionId,
        ability: firstTask4Record?.ability ?? ability ?? null,
        queries: flattenedQueries,
        task4_records: selectedTask4Records.map(({ record }) => record),
        conversation: dialogue,
        extracted_memory: candidateMemories,
        selected_memories: selectedMemories,
        selected_memory: selectedMemory,
        memory_key: selectedMemoryId,
        task4_selected_memory_id: selectedMemoryId,
        task4_selected_memory: selectedMemory,
        metadata: firstTask4Record?.metadata ?? null,
      },
    };
  }

  return packet;
}

export async function loadManualCheckDataset(index: UploadedFileIndex): Promise<ManualCheckDataset> {
  const sessionPacketDiscovery = await findSessionPacketDiscovery(index);
  if (sessionPacketDiscovery !== null) {
    return loadSessionPacketDataset(index, sessionPacketDiscovery);
  }

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
  if (typeof manifestRow.packet_relative_path === 'string' && manifestRow.packet_relative_path) {
    return manifestRow.packet_relative_path;
  }

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

  if (dataset.sourceType === 'manual_check_data_folder' || dataset.sourceType === 'session_packet_folder') {
    if (!dataset.uploadedFileIndex) {
      throw new Error('Uploaded file index is missing for the current folder dataset.');
    }

    itemData = await readJsonFromIndex<Record<string, unknown>>(dataset.uploadedFileIndex, itemPath);
    if (dataset.sourceType === 'session_packet_folder') {
      itemData = normalizeSessionPacketItem(entry.task, itemData, entry.ability, manifestRow);
    }
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
