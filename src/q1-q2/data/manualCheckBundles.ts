import {
  buildAnnotationDraftKey,
  loadManualCheckItem,
} from './manualCheckFolderLoader';
import type {
  AnnotationExportBundle,
  ImportableBundle,
  ManualCheckDataset,
  MergedDatasetBundleEntry,
  MergedDatasetBundleItem,
  MergedDatasetExportBundle,
  SavedAnnotationEntry,
} from '../types';

function filterAnnotationEntriesByStatus(
  savedAnnotations: Record<string, SavedAnnotationEntry>,
  status: SavedAnnotationEntry['annotation']['status'],
): SavedAnnotationEntry[] {
  return Object.values(savedAnnotations).filter((entry) => entry.annotation.status === status);
}

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

export function formatTimestampForFilename(date = new Date()): string {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('');
}

export function buildAnnotationStorageKey(datasetFingerprint: string): string {
  return `q1-q2-annotations:${datasetFingerprint}`;
}

export function buildAnnotationExportBundle(
  dataset: ManualCheckDataset,
  savedAnnotations: Record<string, SavedAnnotationEntry>,
  annotationStatus: SavedAnnotationEntry['annotation']['status'],
): AnnotationExportBundle {
  return {
    bundleType: 'q1-q2-annotations',
    version: 1,
    sourceType:
      annotationStatus === 'saved' ? 'saved_annotation_bundle' : 'draft_annotation_bundle',
    rootName: dataset.rootName,
    datasetFingerprint: dataset.datasetFingerprint,
    generatedAt: new Date().toISOString(),
    annotationStatus,
    annotations: filterAnnotationEntriesByStatus(savedAnnotations, annotationStatus),
  };
}

export async function buildMergedDatasetExportBundle(
  dataset: ManualCheckDataset,
  savedAnnotations: Record<string, SavedAnnotationEntry>,
): Promise<MergedDatasetExportBundle> {
  const entries: MergedDatasetBundleEntry[] = [];

  for (const entry of dataset.entries) {
    const items: MergedDatasetBundleItem[] = [];

    for (let rowIndex = 0; rowIndex < entry.manifestRows.length; rowIndex += 1) {
      const loadedItem = await loadManualCheckItem(dataset, entry, rowIndex);
      const draftKey = buildAnnotationDraftKey({
        track: entry.track,
        task: entry.task,
        ability: entry.ability,
        sessionId: loadedItem.manifestRow.session_id,
        canonicalId: loadedItem.manifestRow.canonical_id,
      });
      const savedEntry = savedAnnotations[draftKey];

      items.push({
        relativeItemPath: loadedItem.itemPath,
        manifestRow: loadedItem.manifestRow,
        itemData: savedEntry
          ? {
              ...loadedItem.itemData,
              workbench_annotation: savedEntry.annotation,
            }
          : loadedItem.itemData,
        annotation: savedEntry?.annotation,
      });
    }

    entries.push({
      id: entry.id,
      track: entry.track,
      task: entry.task,
      ability: entry.ability,
      manifestPath: entry.manifestPath,
      baseDir: entry.baseDir,
      title: entry.title,
      itemCount: entry.itemCount,
      items,
    });
  }

  return {
    bundleType: 'q1-q2-merged-dataset',
    version: 1,
    sourceType: 'merged_manual_check_bundle',
    rootName: dataset.rootName,
    datasetFingerprint: dataset.datasetFingerprint,
    generatedAt: new Date().toISOString(),
    runSummary: dataset.runSummary,
    warnings: dataset.warnings,
    entries,
    annotations: Object.values(savedAnnotations),
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeLegacyAnnotationBundle(value: Record<string, unknown>): AnnotationExportBundle {
  const rawAnnotations = Array.isArray(value.annotations)
    ? (value.annotations as SavedAnnotationEntry[])
    : [];
  const explicitStatus = value.annotationStatus;
  const inferredStatus =
    explicitStatus === 'saved' || explicitStatus === 'draft'
      ? explicitStatus
      : rawAnnotations.every((entry) => entry?.annotation?.status === 'draft')
        ? 'draft'
        : 'saved';

  return {
    bundleType: 'q1-q2-annotations',
    version: typeof value.version === 'number' ? value.version : 1,
    sourceType:
      inferredStatus === 'saved' ? 'saved_annotation_bundle' : 'draft_annotation_bundle',
    rootName: typeof value.rootName === 'string' ? value.rootName : 'manual_check_data',
    datasetFingerprint:
      typeof value.datasetFingerprint === 'string' ? value.datasetFingerprint : 'unknown',
    generatedAt: typeof value.generatedAt === 'string' ? value.generatedAt : new Date().toISOString(),
    annotationStatus: inferredStatus,
    annotations: rawAnnotations,
  };
}

export function parseImportableBundle(value: unknown): ImportableBundle | null {
  if (!isObject(value) || typeof value.bundleType !== 'string') {
    return null;
  }

  if (value.bundleType === 'q1-q2-annotations') {
    return normalizeLegacyAnnotationBundle(value);
  }

  if (value.bundleType === 'q1-q2-merged-dataset') {
    return value as MergedDatasetExportBundle;
  }

  return null;
}

export function createDatasetFromMergedBundle(bundle: MergedDatasetExportBundle): {
  dataset: ManualCheckDataset;
  savedAnnotations: Record<string, SavedAnnotationEntry>;
} {
  const bundledItemsByRelativePath = new Map<string, Record<string, unknown>>();

  bundle.entries.forEach((entry) => {
    entry.items.forEach((item) => {
      bundledItemsByRelativePath.set(item.relativeItemPath, item.itemData);
    });
  });

  const savedAnnotations = Object.fromEntries(
    bundle.annotations.map((annotationEntry) => [annotationEntry.draftKey, annotationEntry]),
  );

  return {
    dataset: {
      sourceType: 'merged_manual_check_bundle',
      rootName: bundle.rootName,
      datasetFingerprint: bundle.datasetFingerprint,
      runSummary: bundle.runSummary,
      warnings: bundle.warnings ?? [],
      entries: bundle.entries.map((entry) => ({
        id: entry.id,
        track: entry.track,
        task: entry.task,
        ability: entry.ability,
        manifestPath: entry.manifestPath,
        baseDir: entry.baseDir,
        title: entry.title,
        manifestRows: entry.items.map((item) => item.manifestRow),
        itemCount: entry.items.length,
      })),
      bundledItemsByRelativePath,
    },
    savedAnnotations,
  };
}
