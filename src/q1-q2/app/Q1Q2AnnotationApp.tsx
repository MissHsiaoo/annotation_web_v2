import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  ArrowDownToLine,
  ChevronLeft,
  ChevronRight,
  Database,
  FileJson,
  FolderTree,
  Layers3,
  LoaderCircle,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';

import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Progress } from '../../components/ui/progress';
import { Separator } from '../../components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Toaster } from '../../components/ui/sonner';
import { AnnotationPane } from '../components/AnnotationPane';
import { getRequirementConfig } from '../config/requirements';
import { FileSourceSelector } from '../components/FileSourceSelector';
import { TaskRequirementPanel } from '../components/TaskRequirementPanel';
import {
  sampleBlockCardClass,
  sampleBlockContentClass,
  sampleBlockHeaderClass,
} from '../components/display/sampleBlockStyles';
import { TaskSampleDisplay } from '../components/display/TaskSampleDisplay';
import { buildUploadedFileIndex } from '../data/indexers/buildUploadedFileIndex';
import {
  buildAnnotationExportBundle,
  buildAnnotationStorageKey,
  buildMergedDatasetExportBundle,
  createDatasetFromMergedBundle,
  formatTimestampForFilename,
  parseImportableBundle,
} from '../data/manualCheckBundles';
import {
  buildAnnotationDraftKey,
  getManifestRowAssignedModel,
  loadManualCheckDataset,
  loadManualCheckItem,
} from '../data/manualCheckFolderLoader';
import type {
  AbilityKey,
  AnnotationExportBundle,
  AnySupportedAnnotation,
  EvaluationMode,
  LoadedManualCheckItem,
  ManualCheckDataset,
  ManualCheckDatasetEntry,
  SavedAnnotationEntry,
  TaskKey,
  TrackKey,
} from '../types';

const TRACK_LABELS: Record<TrackKey, string> = {
  Q1: '基准构建数据标注',
  Q2: '评测对齐数据标注',
};

const TASK_LABELS: Record<TaskKey, string> = {
  task1: '任务1：记忆抽取审核',
  task2: '任务2：记忆更新审核',
  task3: '任务3：查询与记忆匹配审核',
  task4: '任务4：能力定向审核',
};

const ABILITY_LABELS: Record<AbilityKey, string> = {
  ability1: '能力1',
  ability2: '能力2',
  ability3: '能力3',
  ability4: '能力4',
  ability5: '能力5',
};

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function toSavedAnnotationMap(entries: SavedAnnotationEntry[]): Record<string, SavedAnnotationEntry> {
  return Object.fromEntries(entries.map((entry) => [entry.draftKey, entry]));
}

function getLatestAnnotationTime(savedEntries: Record<string, SavedAnnotationEntry>): Date | null {
  const timestamps = Object.values(savedEntries)
    .map((entry) => entry.annotation.updatedAt)
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value))
    .filter((value) => !Number.isNaN(value.getTime()));

  if (timestamps.length === 0) {
    return null;
  }

  return timestamps.reduce((latest, current) => (current > latest ? current : latest));
}

function matchesDataset(
  dataset: ManualCheckDataset,
  bundle: AnnotationExportBundle,
): boolean {
  return (
    bundle.datasetFingerprint === dataset.datasetFingerprint ||
    bundle.rootName === dataset.rootName
  );
}

function getEntryLabel(entry: ManualCheckDatasetEntry): string {
  return entry.ability ? `${TASK_LABELS[entry.task]} / ${ABILITY_LABELS[entry.ability]}` : TASK_LABELS[entry.task];
}

function SummaryStat({
  label,
  value,
  tone = 'default',
  className = '',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'muted';
  className?: string;
}) {
  return (
    <div
      className={`min-h-[4.5rem] min-w-0 flex-1 rounded-2xl border border-slate-200/90 bg-white px-5 py-4 shadow-sm ring-1 ring-slate-950/[0.04] transition-[box-shadow,transform] duration-200 hover:shadow-md ${className}`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p
        className={`mt-2 break-words text-sm font-semibold leading-snug ${tone === 'muted' ? 'text-slate-700' : 'text-slate-900'}`}
      >
        {value}
      </p>
    </div>
  );
}

export default function Q1Q2AnnotationApp() {
  const bundleInputRef = useRef<HTMLInputElement>(null);
  const pendingImportedAnnotationsRef = useRef<Record<string, SavedAnnotationEntry> | null>(null);
  const [dataset, setDataset] = useState<ManualCheckDataset | null>(null);
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [currentItem, setCurrentItem] = useState<LoadedManualCheckItem | null>(null);
  const [jumpInput, setJumpInput] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [isLoadingItem, setIsLoadingItem] = useState(false);
  const [isExportingBundles, setIsExportingBundles] = useState(false);
  const [annotationPaneVersion, setAnnotationPaneVersion] = useState(0);
  const [evaluationMode, setEvaluationMode] = useState<EvaluationMode>('judge_visible');
  const [savedAnnotations, setSavedAnnotations] = useState<Record<string, SavedAnnotationEntry>>({});
  const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null);

  const activeEntry =
    dataset && activeEntryId ? dataset.entries.find((entry) => entry.id === activeEntryId) ?? null : null;
  const requirement = activeEntry ? getRequirementConfig(activeEntry.track, activeEntry.task) : null;
  const currentDraftKey =
    currentItem && activeEntry
      ? buildAnnotationDraftKey({
          track: activeEntry.track,
          task: activeEntry.task,
          ability: activeEntry.ability,
          sessionId: currentItem.manifestRow.session_id,
          canonicalId: currentItem.manifestRow.canonical_id,
        })
      : null;
  const currentSavedAnnotationEntry = currentDraftKey ? savedAnnotations[currentDraftKey] : undefined;
  const currentSavedAnnotation = currentSavedAnnotationEntry?.annotation;
  const entrySavedCount = activeEntry
    ? Object.values(savedAnnotations).filter(
        (item) =>
          item.track === activeEntry.track &&
          item.task === activeEntry.task &&
          (item.ability ?? null) === (activeEntry.ability ?? null) &&
          item.annotation.status === 'saved',
      ).length
    : 0;
  const currentSampleSavedAt = currentSavedAnnotation?.updatedAt
    ? new Date(currentSavedAnnotation.updatedAt)
    : null;
  const currentSampleSaveLabel = currentSampleSavedAt
    ? `${currentSavedAnnotation?.status === 'saved' ? '已保存' : '草稿已自动保存'} ${currentSampleSavedAt.toLocaleString()}`
    : '当前样本尚未保存';
  const progressPercent = activeEntry ? ((currentItemIndex + 1) / activeEntry.itemCount) * 100 : 0;
  const useTask123ReviewLayout =
    activeEntry?.track === 'Q1' &&
    (activeEntry.task === 'task1' ||
      activeEntry.task === 'task2' ||
      activeEntry.task === 'task3' ||
      activeEntry.task === 'task4');

  const getPreferredItemIndexForEntry = (nextEntry: ManualCheckDatasetEntry): number => {
    if (!nextEntry.itemCount) {
      return 0;
    }

    if (currentItem) {
      const matchedIndex = nextEntry.manifestRows.findIndex(
        (row) =>
          row.session_id === currentItem.manifestRow.session_id &&
          row.canonical_id === currentItem.manifestRow.canonical_id,
      );

      if (matchedIndex >= 0) {
        return matchedIndex;
      }
    }

    return Math.min(currentItemIndex, nextEntry.itemCount - 1);
  };

  const switchToEntryPreservingContext = (nextEntry: ManualCheckDatasetEntry) => {
    setActiveEntryId(nextEntry.id);
    setCurrentItemIndex(getPreferredItemIndexForEntry(nextEntry));
  };

  useEffect(() => {
    if (!dataset) {
      return;
    }

    const storageKey = buildAnnotationStorageKey(dataset.datasetFingerprint);
    const raw = localStorage.getItem(storageKey);
    let restoredAnnotations: Record<string, SavedAnnotationEntry> = {};
    let restoredTime: Date | null = null;

    if (raw) {
      try {
        const parsed = JSON.parse(raw) as {
          savedAnnotations?: Record<string, SavedAnnotationEntry>;
          updatedAt?: string;
        };

        restoredAnnotations = parsed.savedAnnotations ?? {};
        restoredTime = parsed.updatedAt ? new Date(parsed.updatedAt) : null;
      } catch {
      toast.warning('未能从本地存储恢复标注记录。');
      }
    }

    if (pendingImportedAnnotationsRef.current) {
      restoredAnnotations = {
        ...restoredAnnotations,
        ...pendingImportedAnnotationsRef.current,
      };
      restoredTime = getLatestAnnotationTime(restoredAnnotations) ?? restoredTime;
      pendingImportedAnnotationsRef.current = null;
    }

    setSavedAnnotations(restoredAnnotations);
    setLastSavedTime(restoredTime);
  }, [dataset]);

  useEffect(() => {
    if (!dataset) {
      return;
    }

    const storageKey = buildAnnotationStorageKey(dataset.datasetFingerprint);
    const timestamp = new Date().toISOString();
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        savedAnnotations,
        updatedAt: timestamp,
      }),
    );

    if (Object.keys(savedAnnotations).length > 0) {
      setLastSavedTime(new Date(timestamp));
    }
  }, [dataset, savedAnnotations]);

  useEffect(() => {
    if (!dataset || !activeEntry) {
      setCurrentItem(null);
      return;
    }

    let isCancelled = false;

    const readItem = async () => {
      setIsLoadingItem(true);

      try {
        const loadedItem = await loadManualCheckItem(dataset, activeEntry, currentItemIndex);

        if (!isCancelled) {
          setCurrentItem(loadedItem);
        }
      } catch (error) {
        if (!isCancelled) {
          setCurrentItem(null);
      toast.error(error instanceof Error ? error.message : '加载当前样本失败。');
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingItem(false);
        }
      }
    };

    readItem();

    return () => {
      isCancelled = true;
    };
  }, [dataset, activeEntry, currentItemIndex]);

  const applyLoadedDataset = (
    loadedDataset: ManualCheckDataset,
    importedAnnotations?: Record<string, SavedAnnotationEntry>,
  ) => {
    const firstEntry = loadedDataset.entries[0];

    pendingImportedAnnotationsRef.current = importedAnnotations ?? null;
    setSavedAnnotations({});
    setLastSavedTime(null);
    setAnnotationPaneVersion((value) => value + 1);
    setDataset(loadedDataset);
    setActiveEntryId(firstEntry.id);
    setCurrentItemIndex(0);
    setCurrentItem(null);
    setJumpInput('');
    setEvaluationMode('judge_visible');
  };

  const handleDatasetImport = async (files: FileList) => {
    setIsImporting(true);

    try {
      const uploadedFileIndex = buildUploadedFileIndex(files);
      const loadedDataset = await loadManualCheckDataset(uploadedFileIndex);
      applyLoadedDataset(loadedDataset);

      toast.success(`已从 ${loadedDataset.rootName} 加载 ${loadedDataset.entries.length} 个标注视图。`);

      if (loadedDataset.warnings.length > 0) {
        toast.info('数据集已加载，但包含提示信息，请查看导入说明。');
      }
    } catch (error) {
      setDataset(null);
      setActiveEntryId(null);
      setCurrentItem(null);
      toast.error(error instanceof Error ? error.message : '导入数据集文件夹失败。');
    } finally {
      setIsImporting(false);
    }
  };

  const handleBundleImport = async (file: File) => {
    setIsImporting(true);

    try {
      const parsedValue = JSON.parse(await file.text()) as unknown;
      const bundle = parseImportableBundle(parsedValue);

      if (!bundle) {
        throw new Error('Unsupported bundle JSON. Expected an annotation bundle or merged dataset bundle.');
      }

      if (bundle.bundleType === 'q1-q2-merged-dataset') {
        const { dataset: importedDataset, savedAnnotations: importedAnnotations } =
          createDatasetFromMergedBundle(bundle);
        applyLoadedDataset(importedDataset, importedAnnotations);
        toast.success(`已从 ${bundle.rootName} 导入合并数据包。`);
        return;
      }

      if (!dataset) {
        throw new Error('Load a dataset folder or merged dataset bundle before importing annotation-only bundles.');
      }

      if (!matchesDataset(dataset, bundle)) {
        throw new Error('The selected annotation bundle does not match the currently loaded dataset.');
      }

      const importedAnnotations = toSavedAnnotationMap(bundle.annotations);
      setSavedAnnotations((current) => ({
        ...current,
        ...importedAnnotations,
      }));
      setLastSavedTime(getLatestAnnotationTime(importedAnnotations) ?? new Date());
      setAnnotationPaneVersion((value) => value + 1);
      toast.success(`已从数据包导入 ${bundle.annotations.length} 条标注记录。`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '导入 JSON 数据包失败。');
    } finally {
      setIsImporting(false);
    }
  };

  const handleReset = () => {
    pendingImportedAnnotationsRef.current = null;
    setAnnotationPaneVersion((value) => value + 1);
    setDataset(null);
    setActiveEntryId(null);
    setCurrentItemIndex(0);
    setCurrentItem(null);
    setJumpInput('');
    setSavedAnnotations({});
    setLastSavedTime(null);
    setEvaluationMode('judge_visible');
  };

  const handleTrackChange = (nextTrack: string) => {
    if (!dataset || !activeEntry) {
      return;
    }

    const nextEntry =
      dataset.entries.find(
        (entry) =>
          entry.track === nextTrack &&
          entry.task === activeEntry.task &&
          (activeEntry.task !== 'task4' || entry.ability === activeEntry.ability),
      ) ??
      dataset.entries.find(
        (entry) => entry.track === nextTrack && entry.task === activeEntry.task,
      ) ??
      dataset.entries.find((entry) => entry.track === nextTrack);

    if (!nextEntry) {
      return;
    }

    switchToEntryPreservingContext(nextEntry);
  };

  const handleTaskChange = (nextTask: string) => {
    if (!dataset || !activeEntry) {
      return;
    }

    const nextEntry = dataset.entries.find(
      (entry) => entry.track === activeEntry.track && entry.task === nextTask,
    );
    if (!nextEntry) {
      return;
    }

    switchToEntryPreservingContext(nextEntry);
  };

  const handleAbilityChange = (nextAbility: string) => {
    if (!dataset || !activeEntry || activeEntry.task !== 'task4') {
      return;
    }

    const nextEntry = dataset.entries.find(
      (entry) =>
        entry.track === activeEntry.track &&
        entry.task === 'task4' &&
        entry.ability === nextAbility,
    );
    if (!nextEntry) {
      return;
    }

    switchToEntryPreservingContext(nextEntry);
  };

  const handleJump = () => {
    if (!activeEntry) {
      return;
    }

    const target = Number.parseInt(jumpInput, 10);
    if (Number.isNaN(target)) {
      toast.error('请输入有效的样本编号。');
      return;
    }

    const nextIndex = target - 1;
    if (nextIndex < 0 || nextIndex >= activeEntry.itemCount) {
      toast.error(`样本编号必须在 1 到 ${activeEntry.itemCount} 之间。`);
      return;
    }

    setCurrentItemIndex(nextIndex);
    setJumpInput('');
  };

  const trackOptions = dataset
    ? Array.from(new Set(dataset.entries.map((entry) => entry.track)))
    : [];
  const taskOptions =
    dataset && activeEntry
      ? Array.from(
          new Set(dataset.entries.filter((entry) => entry.track === activeEntry.track).map((entry) => entry.task)),
        )
      : [];
  const abilityOptions =
    dataset && activeEntry?.task === 'task4'
      ? dataset.entries
          .filter((entry) => entry.track === activeEntry.track && entry.task === 'task4' && entry.ability)
          .map((entry) => entry.ability as AbilityKey)
      : [];

  const currentAssignedModel = currentItem ? getManifestRowAssignedModel(currentItem.manifestRow) : null;

  const upsertAnnotationRecord = (annotation: AnySupportedAnnotation, toastMessage?: string) => {
    if (!currentItem || !activeEntry || !currentDraftKey) {
      return;
    }

    const savedEntry: SavedAnnotationEntry = {
      draftKey: currentDraftKey,
      relativeItemPath: currentItem.itemPath,
      canonicalId: currentItem.manifestRow.canonical_id,
      sessionId: currentItem.manifestRow.session_id,
      track: activeEntry.track,
      task: activeEntry.task,
      ability: activeEntry.ability,
      annotation,
    };

    setSavedAnnotations((current) => ({
      ...current,
      [currentDraftKey]: savedEntry,
    }));

    if (toastMessage) {
      toast.success(toastMessage);
    }
  };

  const handleDraftAnnotation = (annotation: AnySupportedAnnotation) => {
    upsertAnnotationRecord(annotation);
  };

  const handleSaveAnnotation = (annotation: AnySupportedAnnotation) => {
    upsertAnnotationRecord(annotation, '标注已保存。');
  };

  const handleDownloadBundles = async () => {
    if (!dataset) {
      return;
    }

    setIsExportingBundles(true);
    const timestamp = formatTimestampForFilename();
    const annotationEntries = Object.values(savedAnnotations);
    const savedCount = annotationEntries.filter((entry) => entry.annotation.status === 'saved').length;
    const draftCount = annotationEntries.filter((entry) => entry.annotation.status === 'draft').length;

    try {
      if (savedCount > 0) {
        const annotationBundle = buildAnnotationExportBundle(dataset, savedAnnotations, 'saved');
        downloadJson(annotationBundle, `${dataset.rootName}-annotation-records-${timestamp}.json`);
      }

      if (draftCount > 0) {
        const draftBundle = buildAnnotationExportBundle(dataset, savedAnnotations, 'draft');
        downloadJson(draftBundle, `${dataset.rootName}-annotation-drafts-${timestamp}.json`);
      }

      const mergedBundle = await buildMergedDatasetExportBundle(dataset, savedAnnotations);
      downloadJson(mergedBundle, `${dataset.rootName}-merged-dataset-${timestamp}.json`);
      const downloadedLabels = [
        savedCount > 0 ? 'saved annotations' : null,
        draftCount > 0 ? 'draft annotations' : null,
        '合并数据包',
      ].filter(Boolean);
      toast.success(`已导出：${downloadedLabels.join('、')}。`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '导出数据包失败。');
    } finally {
      setIsExportingBundles(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100/95 via-white to-indigo-50/40 px-4 py-8 sm:px-6 lg:px-10">
      <Toaster position="top-right" />
      <input
        ref={bundleInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];

          if (file) {
            handleBundleImport(file);
          }

          event.target.value = '';
        }}
      />
      <div className="mx-auto max-w-[1680px] space-y-8">
        <header className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white/95 p-7 shadow-md ring-1 ring-slate-200/50 backdrop-blur-sm sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-slate-200 bg-slate-100 text-slate-700">
                  中文标注工作台
                </Badge>
                <Badge variant="outline" className="border-slate-200 bg-slate-100 text-slate-600">
                  人工标注数据集
                </Badge>
              </div>
              <div className="flex items-center gap-3">
                <Layers3 className="h-7 w-7 text-slate-700" />
                <div>
                  <h1 className="text-3xl font-semibold tracking-tight text-slate-950">中文数据标注工作台</h1>
                  <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
                    这是一个面向任务的数据标注工作台，支持旧版 <code>manual_check_data</code> 导出数据，
                    也支持新版 <code>task123_session_packets</code> 和 <code>chunks</code> 会话级基准构建数据。
                    支持文件夹导入、样本懒加载、按任务展示说明，以及 Q1 task1-4 的展示即编辑标注流程。
                  </p>
                </div>
              </div>
            </div>

            {dataset ? (
              <div className="flex flex-wrap gap-3 lg:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleReset}
                  className="gap-2 rounded-xl border-slate-300 bg-white shadow-sm transition-all hover:border-slate-400 hover:bg-slate-50 hover:shadow"
                >
                  <RefreshCw className="h-4 w-4" />
                  重新导入
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => bundleInputRef.current?.click()}
                  disabled={isImporting}
                  className="gap-2 rounded-xl border-slate-300 bg-white shadow-sm transition-all hover:border-slate-400 hover:bg-slate-50 hover:shadow"
                >
                  <FileJson className="h-4 w-4" />
                  导入标注结果
                </Button>
                <Button
                  type="button"
                  variant="default"
                  onClick={handleDownloadBundles}
                  disabled={Object.keys(savedAnnotations).length === 0 || isExportingBundles}
                  className="gap-2 rounded-xl shadow-sm transition-all hover:shadow-md"
                >
                  <Archive className="h-4 w-4" />
                  {isExportingBundles ? '正在准备导出...' : '导出标注结果'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    currentItem
                      ? downloadJson(
                          currentSavedAnnotation
                            ? {
                                ...currentItem.itemData,
                                workbench_annotation: currentSavedAnnotation,
                              }
                            : currentItem.itemData,
                          `${currentItem.entry.track}-${currentItem.entry.task}-${currentItem.manifestRow.session_id}-${currentItem.manifestRow.canonical_id}-${formatTimestampForFilename()}.json`,
                        )
                      : null
                  }
                  disabled={!currentItem}
                  className="gap-2 rounded-xl shadow-sm transition-all hover:shadow-md"
                >
                  <ArrowDownToLine className="h-4 w-4" />
                  导出当前样本
                </Button>
              </div>
            ) : null}
          </div>
        </header>

        {!dataset ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.8fr)_minmax(320px,1fr)]">
            <FileSourceSelector
              onFolderSelected={handleDatasetImport}
              onBundleSelected={handleBundleImport}
              isLoading={isImporting}
            />

            <Card className="overflow-hidden border-slate-200/80 bg-white/95 shadow-md ring-1 ring-slate-200/35">
              <CardHeader className="border-b border-slate-100/80 bg-gradient-to-r from-white via-white to-indigo-50/40 px-5 py-5 sm:px-6">
                <CardTitle className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                  <Database className="h-5 w-5 text-slate-700" />
                  支持的数据格式
                </CardTitle>
                <CardDescription className="text-slate-600">
                  当前导入器同时支持旧版人工检查导出结构和新版基准构建会话数据结构。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 px-5 pb-6 pt-6 text-sm text-slate-600 sm:px-6">
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-5 shadow-sm ring-1 ring-slate-200/20">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">关键文件</p>
                  <ul className="list-disc space-y-1.5 pl-4">
                    <li><code>run_summary.json</code></li>
                    <li><code>benchmark_construction_check_data/**/manifest.json</code></li>
                    <li><code>LLM_as_judge_Human_Alignment_data/**/manifest.json</code></li>
                    <li><code>sessions/&lt;session&gt;__&lt;canonical&gt;/item.json</code></li>
                    <li><code>cleaned_data/task123_session_packets/manifest.json</code></li>
                    <li><code>cleaned_data/task123_session_packets/sess_*.json</code></li>
                    <li><code>chunks/chunk_*/manifest.json</code></li>
                    <li><code>chunks/chunk_*/sess_*.json</code></li>
                  </ul>
                </div>
                <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ring-1 ring-slate-200/25">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">当前能力说明</p>
                  <ul className="list-disc space-y-1.5 pl-4">
                    <li>可以从文件夹中自动发现各类标注视图。</li>
                    <li>可以把 manifest 行或会话包映射到正确的当前样本。</li>
                    <li>可以在不预加载整个数据集的前提下逐条浏览样本。</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="space-y-8">
            <Card className="overflow-hidden border-slate-200/90 bg-white/95 shadow-md ring-1 ring-slate-200/40 backdrop-blur-sm">
              <CardHeader className="border-b border-slate-100/90 bg-gradient-to-r from-white to-slate-50/80 px-6 py-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <CardTitle className="flex items-center gap-2 text-base text-slate-900">
                      <FolderTree className="h-5 w-5 text-slate-700" />
                      数据集工作台
                    </CardTitle>
                    <CardDescription className="text-sm text-slate-600">
                      已从 <code>{dataset.rootName}</code> 导入，识别到 {dataset.entries.length} 个标注视图。
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                      当前视图已标注 {entrySavedCount} / {activeEntry?.itemCount ?? 0}
                    </Badge>
                    <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                      {currentSampleSaveLabel}
                    </Badge>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-6 px-6 pb-6 pt-5">
                <div className="rounded-2xl border border-slate-200/70 bg-slate-50/60 p-5 shadow-inner ring-1 ring-slate-200/25">
                  <div className="flex flex-wrap items-end gap-4">
                      <div className="min-w-[220px] flex-1 space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">数据类型</label>
                        <Select value={activeEntry?.track} onValueChange={handleTrackChange}>
                          <SelectTrigger className="h-10 rounded-xl border-slate-300 bg-white">
                            <SelectValue placeholder="选择数据类型" />
                          </SelectTrigger>
                          <SelectContent>
                            {trackOptions.map((track) => (
                              <SelectItem key={track} value={track}>
                                {TRACK_LABELS[track]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="min-w-[220px] flex-1 space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">标注任务</label>
                        <Select value={activeEntry?.task} onValueChange={handleTaskChange}>
                          <SelectTrigger className="h-10 rounded-xl border-slate-300 bg-white">
                            <SelectValue placeholder="选择标注任务" />
                          </SelectTrigger>
                          <SelectContent>
                            {taskOptions.map((task) => (
                              <SelectItem key={task} value={task}>
                                {TASK_LABELS[task]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="min-w-[220px] flex-1 space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">能力维度</label>
                        <Select
                          value={activeEntry?.ability ?? 'none'}
                          onValueChange={handleAbilityChange}
                          disabled={activeEntry?.task !== 'task4'}
                        >
                          <SelectTrigger className="h-10 rounded-xl border-slate-300 bg-white">
                            <SelectValue placeholder="无能力维度" />
                          </SelectTrigger>
                          <SelectContent>
                            {activeEntry?.task !== 'task4' ? (
                              <SelectItem value="none">不适用</SelectItem>
                            ) : (
                              abilityOptions.map((ability) => (
                                <SelectItem key={ability} value={ability}>
                                  {ABILITY_LABELS[ability]}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-50 to-white p-6 shadow-sm ring-1 ring-slate-200/30">
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                        <div className="space-y-2 xl:min-w-[240px]">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">当前进度</p>
                          <div className="flex items-end gap-3">
                            <p className="text-2xl font-semibold tracking-tight text-slate-950">
                              {activeEntry ? `${currentItemIndex + 1} / ${activeEntry.itemCount}` : '0 / 0'}
                            </p>
                            <p className="pb-1 text-xs text-slate-500">
                              {activeEntry ? `当前视图进度 ${progressPercent.toFixed(1)}%` : '暂无活动视图'}
                            </p>
                          </div>
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col gap-3 xl:max-w-[700px]">
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setCurrentItemIndex((value) => Math.max(value - 1, 0))}
                              disabled={!activeEntry || currentItemIndex === 0 || isLoadingItem}
                              className="gap-2 rounded-xl border-slate-300 bg-white shadow-sm transition-all hover:border-slate-400 hover:bg-slate-50"
                            >
                              <ChevronLeft className="h-4 w-4" />
                              上一个
                            </Button>
                            <Button
                              type="button"
                              variant="default"
                              size="sm"
                              onClick={() =>
                                setCurrentItemIndex((value) =>
                                  activeEntry ? Math.min(value + 1, activeEntry.itemCount - 1) : value,
                                )
                              }
                              disabled={
                                !activeEntry ||
                                !activeEntry.itemCount ||
                                currentItemIndex >= activeEntry.itemCount - 1 ||
                                isLoadingItem
                              }
                              className="gap-2 rounded-xl shadow-md transition-all hover:shadow-lg"
                            >
                              下一个
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="flex gap-2">
                            <Input
                              value={jumpInput}
                              onChange={(event) => setJumpInput(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  handleJump();
                                }
                              }}
                              placeholder="跳转到样本编号"
                              className="h-10 min-w-[8rem] flex-1 rounded-xl border-slate-300 bg-white shadow-sm transition-shadow focus-visible:shadow-md"
                            />
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={handleJump}
                              className="rounded-xl shadow-sm transition-all hover:shadow-md"
                            >
                              跳转
                            </Button>
                          </div>
                        </div>
                      </div>
                      <Progress value={progressPercent} className="mt-3 h-2 bg-slate-200 [&>div]:bg-slate-900" />
                </div>

                <div className="flex flex-wrap gap-4 lg:flex-nowrap">
                  <SummaryStat
                    label="当前视图"
                    value={activeEntry ? getEntryLabel(activeEntry) : '未选择'}
                    className="min-w-[220px] flex-[1.35]"
                  />
                  <SummaryStat
                    label="已标注"
                    value={`${entrySavedCount} / ${activeEntry?.itemCount ?? 0}`}
                    className="flex-1"
                  />
                  <SummaryStat
                    label="会话 ID"
                    value={currentItem?.manifestRow.session_id ?? '加载中...'}
                    tone="muted"
                    className="min-w-[190px] flex-1"
                  />
                  <SummaryStat
                    label="指定模型"
                    value={currentAssignedModel ?? '未指定'}
                    tone="muted"
                    className="min-w-[180px] flex-1"
                  />
                  <SummaryStat
                    label="样本 ID"
                    value={currentItem?.manifestRow.canonical_id ?? '无'}
                    tone="muted"
                    className="min-w-[180px] flex-1"
                  />
                  <SummaryStat
                    label="自动保存"
                    value={lastSavedTime ? `本地备份 ${lastSavedTime.toLocaleTimeString()}` : '暂无本地备份'}
                    tone="muted"
                    className="min-w-[190px] flex-1"
                  />
                </div>
              </CardContent>
            </Card>

            {dataset.warnings.length > 0 ? (
              <Card className="border-amber-200 bg-amber-50/90 shadow-sm">
                <CardHeader className="border-b border-amber-100">
                  <CardTitle className="flex items-center gap-2 text-amber-900">
                    <AlertTriangle className="h-5 w-5" />
                    导入提示
                  </CardTitle>
                  <CardDescription className="text-amber-800">
                    这些提示不会阻止浏览数据，但在部分导入场景下可能影响理解。
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <ul className="list-disc space-y-2 pl-5 text-sm text-amber-900">
                    {dataset.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ) : null}

            <div
              className={
                useTask123ReviewLayout
                  ? 'grid grid-cols-1 items-start gap-6'
                  : 'grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,6fr)_minmax(0,4fr)] lg:gap-10'
              }
            >
              <div className="min-w-0 space-y-6">
                {isLoadingItem ? (
                  <Card className={sampleBlockCardClass}>
                    <CardHeader className={sampleBlockHeaderClass}>
                      <CardTitle className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                        <FileJson className="h-5 w-5 text-slate-700" />
                        样本展示
                      </CardTitle>
                      <CardDescription className="text-slate-600">
                        正在加载当前样本的任务展示内容。
                      </CardDescription>
                    </CardHeader>
                    <CardContent className={sampleBlockContentClass}>
                      <div className="flex min-h-[240px] items-center justify-center rounded-2xl border border-slate-200/80 bg-slate-50/80 shadow-inner ring-1 ring-slate-200/20">
                        <div className="flex items-center gap-3 text-slate-600">
                          <LoaderCircle className="h-5 w-5 animate-spin" />
                          正在加载当前样本...
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ) : currentItem ? (
                  <TaskSampleDisplay
                    loadedItem={currentItem}
                    evaluationMode={evaluationMode}
                    currentAnnotation={currentSavedAnnotation}
                    onDraftChange={handleDraftAnnotation}
                    onSave={handleSaveAnnotation}
                  />
                ) : (
                  <Card className={sampleBlockCardClass}>
                    <CardHeader className={sampleBlockHeaderClass}>
                      <CardTitle className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                        <FileJson className="h-5 w-5 text-slate-700" />
                        样本展示
                      </CardTitle>
                    </CardHeader>
                    <CardContent className={sampleBlockContentClass}>
                      <div className="rounded-2xl border border-dashed border-slate-300/90 bg-slate-50/80 p-8 text-center text-sm text-slate-600 shadow-inner ring-1 ring-slate-200/20">
                        当前尚未加载样本。
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {!useTask123ReviewLayout ? (
                <div
                  className="min-w-0 space-y-6 rounded-2xl border border-slate-200/70 bg-white/80 p-5 shadow-md ring-1 ring-slate-200/35 backdrop-blur-md lg:sticky lg:top-4 lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto lg:p-6"
                >
                  {requirement ? <TaskRequirementPanel requirement={requirement} /> : null}

                  {requirement && activeEntry ? (
                    <Separator className="bg-slate-200/80" />
                  ) : null}

                  {activeEntry ? (
                    <AnnotationPane
                      key={`${annotationPaneVersion}:${activeEntry.id}:${currentDraftKey ?? 'no-item'}`}
                      entry={activeEntry}
                      loadedItem={currentItem}
                      currentAnnotation={currentSavedAnnotation}
                      evaluationMode={evaluationMode}
                      onEvaluationModeChange={setEvaluationMode}
                      onDraftChange={handleDraftAnnotation}
                      onSave={handleSaveAnnotation}
                    />
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
