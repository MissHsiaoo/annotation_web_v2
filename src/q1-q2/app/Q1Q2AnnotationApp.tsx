import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  ArrowDownToLine,
  ChevronLeft,
  ChevronRight,
  FileJson,
  LoaderCircle,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';

import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
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
import { sampleBlockCardClass, sampleBlockContentClass, sampleBlockHeaderClass } from '../components/display/sampleBlockStyles';
import { TaskSampleDisplay } from '../components/display/TaskSampleDisplay';
import { buildUploadedFileIndex } from '../data/indexers/buildUploadedFileIndex';
import {
  buildAnnotationExportBundle,
  applyDirectAnnotationEdits,
  buildAnnotationStorageKey,
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
  Q1Task1Annotation,
  Q1Task2Annotation,
  Q1Task3Annotation,
  Q1Task4Annotation,
  SavedAnnotationEntry,
  TaskKey,
  TrackKey,
} from '../types';

// 鈹€鈹€鈹€ Labels 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

const TRACK_LABELS: Record<TrackKey, string> = {
  Q1: '标准构建 (Q1)',
  Q2: '评测对齐 (Q2)',
};

const TASK_LABELS: Record<TaskKey, string> = {
  task1: '任务1：记忆抽取',
  task2: '任务2：记忆更新',
  task3: '任务3：查询匹配',
  task4: '任务4：能力定向',
};

const ABILITY_LABELS: Record<AbilityKey, string> = {
  ability1: '能力1',
  ability2: '能力2',
  ability3: '能力3',
  ability4: '能力4',
  ability5: '能力5',
};

// 鈹€鈹€鈹€ Helpers 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

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
  if (timestamps.length === 0) return null;
  return timestamps.reduce((latest, current) => (current > latest ? current : latest));
}

function matchesDataset(dataset: ManualCheckDataset, bundle: AnnotationExportBundle): boolean {
  return (
    bundle.datasetFingerprint === dataset.datasetFingerprint ||
    bundle.rootName === dataset.rootName
  );
}

function getEntryLabel(entry: ManualCheckDatasetEntry): string {
  return entry.ability
    ? `${TASK_LABELS[entry.task]} / ${ABILITY_LABELS[entry.ability]}`
    : TASK_LABELS[entry.task];
}

function cloneMemoryRecords(memories: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  return memories.map((memory) => structuredClone(memory) as Record<string, unknown>);
}

function findMatchingGoldMemory(
  goldMemories: Array<Record<string, unknown>>,
  selectedMemory: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!selectedMemory) {
    return null;
  }

  const selectedMemoryId =
    typeof selectedMemory.memory_id === 'string' && selectedMemory.memory_id.trim()
      ? selectedMemory.memory_id
      : null;

  if (selectedMemoryId) {
    const matchedById = goldMemories.find(
      (memory) =>
        typeof memory.memory_id === 'string' &&
        memory.memory_id.trim() === selectedMemoryId,
    );
    if (matchedById) {
      return structuredClone(matchedById) as Record<string, unknown>;
    }
  }

  const selectedLabel =
    typeof selectedMemory.label === 'string' && selectedMemory.label.trim() ? selectedMemory.label : null;
  const selectedValue =
    typeof selectedMemory.value === 'string' && selectedMemory.value.trim() ? selectedMemory.value : null;

  const matchedByContent =
    selectedLabel || selectedValue
      ? goldMemories.find(
          (memory) =>
            (typeof memory.label === 'string' ? memory.label : null) === selectedLabel &&
            (typeof memory.value === 'string' ? memory.value : null) === selectedValue,
        )
      : null;

  return matchedByContent
    ? (structuredClone(matchedByContent) as Record<string, unknown>)
    : (structuredClone(selectedMemory) as Record<string, unknown>);
}

function syncExistingQ1AnnotationsFromTask1(
  savedEntries: Record<string, SavedAnnotationEntry>,
  task1Entry: SavedAnnotationEntry,
): {
  nextSavedEntries: Record<string, SavedAnnotationEntry>;
  syncedEntryCount: number;
} {
  if (task1Entry.annotation.formType !== 'Q1:task1') {
    return {
      nextSavedEntries: savedEntries,
      syncedEntryCount: 0,
    };
  }

  const goldMemories = cloneMemoryRecords(task1Entry.annotation.editableGoldMemories ?? []);
  const timestamp = new Date().toISOString();
  let syncedEntryCount = 0;

  const nextSavedEntries = Object.fromEntries(
    Object.entries(savedEntries).map(([draftKey, entry]) => {
      const isLinkedQ1Entry =
        entry.track === 'Q1' &&
        entry.sessionId === task1Entry.sessionId &&
        entry.canonicalId === task1Entry.canonicalId &&
        draftKey !== task1Entry.draftKey;

      if (!isLinkedQ1Entry) {
        return [draftKey, entry];
      }

      if (entry.annotation.formType === 'Q1:task2') {
        const goldById = new Map(
          goldMemories
            .filter((m) => typeof m.memory_id === 'string' && (m.memory_id as string).trim())
            .map((m) => [m.memory_id as string, m]),
        );
        const syncedMemories = entry.annotation.editableUpdatedMemories.map((mem) => {
          const id = typeof mem.memory_id === 'string' ? mem.memory_id : null;
          const gold = id ? goldById.get(id) : undefined;
          if (!gold) return mem;
          return { ...mem, memory_id: gold.memory_id, value: gold.value };
        });
        const nextAnnotation: Q1Task2Annotation = {
          ...entry.annotation,
          editableUpdatedMemories: cloneMemoryRecords(syncedMemories as Array<Record<string, unknown>>),
          updatedAt: timestamp,
        };
        syncedEntryCount += 1;
        return [draftKey, { ...entry, annotation: nextAnnotation }];
      }

      if (entry.annotation.formType === 'Q1:task3') {
        const nextAnnotation: Q1Task3Annotation = {
          ...entry.annotation,
          editableSelectedMemory: findMatchingGoldMemory(goldMemories, entry.annotation.editableSelectedMemory),
          updatedAt: timestamp,
        };
        syncedEntryCount += 1;
        return [draftKey, { ...entry, annotation: nextAnnotation }];
      }

      if (entry.annotation.formType === 'Q1:task4') {
        const nextSelectedMemory = findMatchingGoldMemory(
          goldMemories,
          entry.annotation.editableSelectedMemory,
        );
        const nextAnnotation: Q1Task4Annotation = {
          ...entry.annotation,
          editableSelectedMemory: nextSelectedMemory,
          subAnnotations: entry.annotation.subAnnotations.map((item) => ({
            ...item,
            editableSelectedMemory: findMatchingGoldMemory(goldMemories, item.editableSelectedMemory),
          })),
          updatedAt: timestamp,
        };
        syncedEntryCount += 1;
        return [draftKey, { ...entry, annotation: nextAnnotation }];
      }

      return [draftKey, entry];
    }),
  );

  return {
    nextSavedEntries,
    syncedEntryCount,
  };
}

// 鈹€鈹€鈹€ Sub-components 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

interface AppHeaderProps {
  dataset: ManualCheckDataset | null;
  savedAnnotations: Record<string, SavedAnnotationEntry>;
  currentItem: LoadedManualCheckItem | null;
  isImporting: boolean;
  onReset: () => void;
  onBundleImportClick: () => void;
  onDownloadBundles: () => void;
  onDownloadCurrentItem: () => void;
}

function AppHeader({
  dataset,
  savedAnnotations,
  currentItem,
  isImporting,
  onReset,
  onBundleImportClick,
  onDownloadBundles,
  onDownloadCurrentItem,
}: AppHeaderProps) {
  return (
    <div className="flex min-h-[48px] items-center justify-between gap-4">
      <div className="min-w-0">
        <h1 className="truncate text-base font-semibold text-slate-900">Alps 标注工作台</h1>
        {dataset ? (
          <p className="truncate text-xs text-slate-500">
            {dataset.rootName} · {dataset.entries.length} 个视图
          </p>
        ) : (
          <p className="text-xs text-slate-500">导入数据集后开始标注。</p>
        )}
      </div>

      {dataset && (
        <div className="flex shrink-0 items-center gap-1.5">
          <Button type="button" variant="outline" size="sm" onClick={onReset} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">重新导入</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onBundleImportClick}
            disabled={isImporting}
            className="gap-1.5"
          >
            <FileJson className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">导入标注</span>
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onDownloadBundles}
            disabled={Object.keys(savedAnnotations).length === 0}
            className="gap-1.5"
          >
            <Archive className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">导出标注</span>
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onDownloadCurrentItem}
            disabled={!currentItem}
            className="gap-1.5"
          >
            <ArrowDownToLine className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">导出当前</span>
          </Button>
        </div>
      )}
    </div>
  );
}

interface DatasetControlBarProps {
  dataset: ManualCheckDataset;
  activeEntry: ManualCheckDatasetEntry | null;
  currentItemIndex: number;
  currentItem: LoadedManualCheckItem | null;
  isLoadingItem: boolean;
  entrySavedCount: number;
  lastSavedTime: Date | null;
  currentSavedAnnotation: AnySupportedAnnotation | undefined;
  jumpInput: string;
  trackOptions: TrackKey[];
  taskOptions: TaskKey[];
  abilityOptions: AbilityKey[];
  onTrackChange: (value: string) => void;
  onTaskChange: (value: string) => void;
  onAbilityChange: (value: string) => void;
  onPrev: () => void;
  onNext: () => void;
  onJumpInputChange: (value: string) => void;
  onJump: () => void;
}

function DatasetControlBar({
  dataset,
  activeEntry,
  currentItemIndex,
  currentItem,
  isLoadingItem,
  entrySavedCount,
  lastSavedTime,
  currentSavedAnnotation,
  jumpInput,
  trackOptions,
  taskOptions,
  abilityOptions,
  onTrackChange,
  onTaskChange,
  onAbilityChange,
  onPrev,
  onNext,
  onJumpInputChange,
  onJump,
}: DatasetControlBarProps) {
  const progressPercent = activeEntry ? ((currentItemIndex + 1) / activeEntry.itemCount) * 100 : 0;
  const saveLabel = currentSavedAnnotation?.updatedAt
    ? `${currentSavedAnnotation.status === 'saved' ? '已保存' : '草稿'} ${new Date(currentSavedAnnotation.updatedAt).toLocaleTimeString()}`
    : '未保存';

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Row 1: Selectors (left) + Navigation (right) — never wraps */}
      <div className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3">
        {/* Selectors — allowed to wrap among themselves */}
        <div className="flex flex-wrap items-center gap-2">
          <Select value={activeEntry?.track} onValueChange={onTrackChange}>
            <SelectTrigger className="h-8 w-[160px] text-sm">
              <SelectValue placeholder="数据类型" />
            </SelectTrigger>
            <SelectContent>
              {trackOptions.map((track) => (
                <SelectItem key={track} value={track}>{TRACK_LABELS[track]}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={activeEntry?.task} onValueChange={onTaskChange}>
            <SelectTrigger className="h-8 w-[180px] text-sm">
              <SelectValue placeholder="标注任务" />
            </SelectTrigger>
            <SelectContent>
              {taskOptions.map((task) => (
                <SelectItem key={task} value={task}>{TASK_LABELS[task]}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {activeEntry?.task === 'task4' && (
            <Select value={activeEntry?.ability ?? ''} onValueChange={onAbilityChange}>
              <SelectTrigger className="h-8 w-[120px] text-sm">
                <SelectValue placeholder="能力维度" />
              </SelectTrigger>
              <SelectContent>
                {abilityOptions.map((ability) => (
                  <SelectItem key={ability} value={ability}>{ABILITY_LABELS[ability]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Navigation — shrink-0 keeps it on same line always */}
        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onPrev}
            disabled={!activeEntry || currentItemIndex === 0 || isLoadingItem}
            className="h-8 w-8 p-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="w-[72px] text-center text-sm tabular-nums text-slate-700">
            {activeEntry ? `${currentItemIndex + 1} / ${activeEntry.itemCount}` : '--'}
          </span>
          <Button
            type="button"
            size="sm"
            onClick={onNext}
            disabled={!activeEntry || !activeEntry.itemCount || currentItemIndex >= activeEntry.itemCount - 1 || isLoadingItem}
            className="h-8 w-8 p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Input
            value={jumpInput}
            onChange={(e) => onJumpInputChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onJump(); }}
            placeholder="跳转"
            className="h-8 w-16 text-center text-sm"
          />
          <Button type="button" variant="secondary" size="sm" onClick={onJump} className="h-8 px-3">
            Go
          </Button>
        </div>
      </div>

      {/* Row 2: Progress + meta */}
      <div className="border-t border-slate-100 px-4 pb-3 pt-2">
        <Progress value={progressPercent} className="h-1 bg-slate-100 [&>div]:bg-slate-600" />
        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-0.5 text-xs text-slate-400">
          <span className="truncate">
            {currentItem?.manifestRow.session_id
              ? `Session: ${currentItem.manifestRow.session_id}`
              : dataset.rootName}
            {currentItem?.manifestRow.canonical_id ? ` · ID: ${currentItem.manifestRow.canonical_id}` : ''}
          </span>
          <span className="flex shrink-0 items-center gap-3">
            <span>已保存 {entrySavedCount} / {activeEntry?.itemCount ?? 0}</span>
            <span>{saveLabel}</span>
            {lastSavedTime && <span className="hidden sm:inline">备份 {lastSavedTime.toLocaleTimeString()}</span>}
          </span>
        </div>
      </div>
    </div>
  );
}

// 鈹€鈹€鈹€ Main app 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

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
  const [annotationPaneVersion, setAnnotationPaneVersion] = useState(0);
  const [evaluationMode, setEvaluationMode] = useState<EvaluationMode>('judge_visible');
  const [savedAnnotations, setSavedAnnotations] = useState<Record<string, SavedAnnotationEntry>>({});
  const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null);

  // 鈹€鈹€鈹€ Derived state 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

  const activeEntry =
    dataset && activeEntryId
      ? dataset.entries.find((entry) => entry.id === activeEntryId) ?? null
      : null;

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
  const linkedTask1DraftKey =
    currentItem
      ? buildAnnotationDraftKey({
          track: 'Q1',
          task: 'task1',
          sessionId: currentItem.manifestRow.session_id,
          canonicalId: currentItem.manifestRow.canonical_id,
        })
      : null;
  const linkedTask1Annotation = linkedTask1DraftKey
    ? savedAnnotations[linkedTask1DraftKey]?.annotation?.formType === 'Q1:task1'
      ? (savedAnnotations[linkedTask1DraftKey]?.annotation as Q1Task1Annotation)
      : null
    : null;

  const entrySavedCount = activeEntry
    ? Object.values(savedAnnotations).filter(
        (item) =>
          item.track === activeEntry.track &&
          item.task === activeEntry.task &&
          (item.ability ?? null) === (activeEntry.ability ?? null) &&
          item.annotation.status === 'saved',
      ).length
    : 0;

  // Q1 tasks render the annotation form inline inside TaskSampleDisplay;
  // Q2 tasks render it in the right column.
  const showRightAnnotationColumn = activeEntry?.track === 'Q2';

  const trackOptions = dataset
    ? Array.from(new Set(dataset.entries.map((entry) => entry.track)))
    : [];

  const taskOptions =
    dataset && activeEntry
      ? Array.from(
          new Set(
            dataset.entries
              .filter((entry) => entry.track === activeEntry.track)
              .map((entry) => entry.task),
          ),
        )
      : [];

  const abilityOptions =
    dataset && activeEntry?.task === 'task4'
      ? dataset.entries
          .filter((entry) => entry.track === activeEntry.track && entry.task === 'task4' && entry.ability)
          .map((entry) => entry.ability as AbilityKey)
      : [];

  // 鈹€鈹€鈹€ Effects 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

  useEffect(() => {
    if (!dataset) return;
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
      restoredAnnotations = { ...restoredAnnotations, ...pendingImportedAnnotationsRef.current };
      restoredTime = getLatestAnnotationTime(restoredAnnotations) ?? restoredTime;
      pendingImportedAnnotationsRef.current = null;
    }

    setSavedAnnotations(restoredAnnotations);
    setLastSavedTime(restoredTime);
  }, [dataset]);

  useEffect(() => {
    if (!dataset) return;
    const storageKey = buildAnnotationStorageKey(dataset.datasetFingerprint);
    const timestamp = new Date().toISOString();
    localStorage.setItem(storageKey, JSON.stringify({ savedAnnotations, updatedAt: timestamp }));
    if (Object.keys(savedAnnotations).length > 0) setLastSavedTime(new Date(timestamp));
  }, [dataset, savedAnnotations]);

  useEffect(() => {
    if (!dataset || !activeEntry) {
      setCurrentItem(null);
      return;
    }

    let isCancelled = false;
    setIsLoadingItem(true);

    loadManualCheckItem(dataset, activeEntry, currentItemIndex)
      .then((loadedItem) => { if (!isCancelled) setCurrentItem(loadedItem); })
      .catch((error) => {
        if (!isCancelled) {
          setCurrentItem(null);
          toast.error(error instanceof Error ? error.message : '加载当前样本失败。');
        }
      })
      .finally(() => { if (!isCancelled) setIsLoadingItem(false); });

    return () => { isCancelled = true; };
  }, [dataset, activeEntry, currentItemIndex]);

  // 鈹€鈹€鈹€ Handlers 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

  const getPreferredItemIndexForEntry = (nextEntry: ManualCheckDatasetEntry): number => {
    if (!nextEntry.itemCount) return 0;
    if (currentItem) {
      const matched = nextEntry.manifestRows.findIndex(
        (row) =>
          row.session_id === currentItem.manifestRow.session_id &&
          row.canonical_id === currentItem.manifestRow.canonical_id,
      );
      if (matched >= 0) return matched;
    }
    return Math.min(currentItemIndex, nextEntry.itemCount - 1);
  };

  const switchToEntry = (nextEntry: ManualCheckDatasetEntry) => {
    setActiveEntryId(nextEntry.id);
    setCurrentItemIndex(getPreferredItemIndexForEntry(nextEntry));
  };

  const applyLoadedDataset = (
    loadedDataset: ManualCheckDataset,
    importedAnnotations?: Record<string, SavedAnnotationEntry>,
  ) => {
    pendingImportedAnnotationsRef.current = importedAnnotations ?? null;
    setSavedAnnotations({});
    setLastSavedTime(null);
    setAnnotationPaneVersion((v) => v + 1);
    setDataset(loadedDataset);
    setActiveEntryId(loadedDataset.entries[0].id);
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
      toast.success(`已从 ${loadedDataset.rootName} 加载 ${loadedDataset.entries.length} 个视图。`);
      if (loadedDataset.warnings.length > 0) toast.info('数据集已加载，但包含提示信息。');
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
      const bundle = parseImportableBundle(JSON.parse(await file.text()) as unknown);
      if (!bundle) throw new Error('Unsupported bundle JSON.');

      if (bundle.bundleType === 'q1-q2-merged-dataset') {
        const { dataset: importedDataset, savedAnnotations: importedAnnotations } =
          createDatasetFromMergedBundle(bundle);
        applyLoadedDataset(importedDataset, importedAnnotations);
        toast.success(`已从 ${bundle.rootName} 导入合并数据包。`);
        return;
      }

      if (!dataset) throw new Error('请先加载数据集文件夹，再导入标注结果文件。');
      if (!matchesDataset(dataset, bundle)) throw new Error('标注文件与当前数据集不匹配。');

      const importedAnnotations = toSavedAnnotationMap(bundle.annotations);
      setSavedAnnotations((current) => ({ ...current, ...importedAnnotations }));
      setLastSavedTime(getLatestAnnotationTime(importedAnnotations) ?? new Date());
      setAnnotationPaneVersion((v) => v + 1);
      toast.success(`已导入 ${bundle.annotations.length} 条标注记录。`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '导入 JSON 数据包失败。');
    } finally {
      setIsImporting(false);
    }
  };

  const handleReset = () => {
    pendingImportedAnnotationsRef.current = null;
    setAnnotationPaneVersion((v) => v + 1);
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
    if (!dataset || !activeEntry) return;
    const nextEntry =
      dataset.entries.find(
        (e) => e.track === nextTrack && e.task === activeEntry.task &&
          (activeEntry.task !== 'task4' || e.ability === activeEntry.ability),
      ) ??
      dataset.entries.find((e) => e.track === nextTrack && e.task === activeEntry.task) ??
      dataset.entries.find((e) => e.track === nextTrack);
    if (nextEntry) switchToEntry(nextEntry);
  };

  const handleTaskChange = (nextTask: string) => {
    if (!dataset || !activeEntry) return;
    const nextEntry = dataset.entries.find(
      (e) => e.track === activeEntry.track && e.task === nextTask,
    );
    if (nextEntry) switchToEntry(nextEntry);
  };

  const handleAbilityChange = (nextAbility: string) => {
    if (!dataset || !activeEntry || activeEntry.task !== 'task4') return;
    const nextEntry = dataset.entries.find(
      (e) => e.track === activeEntry.track && e.task === 'task4' && e.ability === nextAbility,
    );
    if (nextEntry) switchToEntry(nextEntry);
  };

  const handleJump = () => {
    if (!activeEntry) return;
    const target = Number.parseInt(jumpInput, 10);
    if (Number.isNaN(target)) { toast.error('请输入有效的样本编号。'); return; }
    const nextIndex = target - 1;
    if (nextIndex < 0 || nextIndex >= activeEntry.itemCount) {
      toast.error(`样本编号必须在 1 到 ${activeEntry.itemCount} 之间。`);
      return;
    }
    setCurrentItemIndex(nextIndex);
    setJumpInput('');
  };

  const upsertAnnotationRecord = (annotation: AnySupportedAnnotation, toastMessage?: string) => {
    if (!currentItem || !activeEntry || !currentDraftKey) return;
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
    const isQ1Task1Save =
      activeEntry.track === 'Q1' &&
      activeEntry.task === 'task1' &&
      annotation.formType === 'Q1:task1' &&
      annotation.status === 'saved';

    let syncedEntryCount = 0;

    if (isQ1Task1Save) {
      // Compute the sync result synchronously so syncedEntryCount is available
      // before the toast fires. Using savedAnnotations from the closure is safe
      // here because this runs in a user-event handler with no pending batched updates.
      const baseEntries = { ...savedAnnotations, [currentDraftKey]: savedEntry };
      const syncResult = syncExistingQ1AnnotationsFromTask1(baseEntries, savedEntry);
      syncedEntryCount = syncResult.syncedEntryCount;
      setSavedAnnotations(syncResult.nextSavedEntries);
    } else {
      setSavedAnnotations((current) => ({ ...current, [currentDraftKey]: savedEntry }));
    }

    if (toastMessage) {
      if (isQ1Task1Save) {
        const syncSummary =
          syncedEntryCount > 0
            ? `已同步更新 ${syncedEntryCount} 条现有的 Q1 task2-4 标注；未打开的 task2-4 页面也会使用最新的 task1 记忆。`
            : 'Q1 task2-4 后续打开时也会使用最新的 task1 记忆。';
        toast.success(`${toastMessage} ${syncSummary}`);
      } else {
        toast.success(toastMessage);
      }
    }
  };

  const handleDownloadBundles = () => {
    if (!dataset) return;
    const timestamp = formatTimestampForFilename();
    const annotationEntries = Object.values(savedAnnotations);
    const savedCount = annotationEntries.filter((e) => e.annotation.status === 'saved').length;
    const draftCount = annotationEntries.filter((e) => e.annotation.status === 'draft').length;

    if (savedCount === 0 && draftCount === 0) {
      toast.warning('暂无标注记录可导出。');
      return;
    }

    if (savedCount > 0) {
      downloadJson(
        buildAnnotationExportBundle(dataset, savedAnnotations, 'saved'),
        `${dataset.rootName}-annotations-${timestamp}.json`,
      );
    }
    if (draftCount > 0) {
      downloadJson(
        buildAnnotationExportBundle(dataset, savedAnnotations, 'draft'),
        `${dataset.rootName}-drafts-${timestamp}.json`,
      );
    }
    toast.success(`已导出 ${savedCount + draftCount} 条标注记录。`);
  };

  const handleDownloadCurrentItem = () => {
    if (!currentItem) return;
    downloadJson(
      applyDirectAnnotationEdits(currentItem.itemData, currentSavedAnnotation),
      `${currentItem.entry.track}-${currentItem.entry.task}-${currentItem.manifestRow.session_id}-${currentItem.manifestRow.canonical_id}-${formatTimestampForFilename()}.json`,
    );
  };

  // 鈹€鈹€鈹€ Render 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

  return (
    <div className="min-h-screen bg-slate-50">
      <Toaster position="top-right" />
      <input
        ref={bundleInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) handleBundleImport(file);
          event.target.value = '';
        }}
      />

      {/* ── Sticky top bar ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur-sm">
        <div className="mx-auto max-w-[1680px] px-4 py-2 sm:px-6 lg:px-8">
          <AppHeader
            dataset={dataset}
            savedAnnotations={savedAnnotations}
            currentItem={currentItem}
            isImporting={isImporting}
            onReset={handleReset}
            onBundleImportClick={() => bundleInputRef.current?.click()}
            onDownloadBundles={handleDownloadBundles}
            onDownloadCurrentItem={handleDownloadCurrentItem}
          />
        </div>
      </header>

      {/* ── Scrollable content ─────────────────────────────────────── */}
      <div className="mx-auto max-w-[1680px] space-y-4 px-4 py-5 sm:px-6 lg:px-8">
        {!dataset ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.8fr)_minmax(280px,1fr)]">
            <FileSourceSelector
              onFolderSelected={handleDatasetImport}
              onBundleSelected={handleBundleImport}
              isLoading={isImporting}
            />
            <Card className="border-slate-200 bg-white shadow-sm">
              <CardHeader className="border-b border-slate-100 bg-slate-50 px-5 py-4 sm:px-6">
                <CardTitle className="text-sm font-medium text-slate-700">支持的数据格式</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 pt-4 text-sm text-slate-500 sm:px-6">
                <ul className="list-disc space-y-1.5 pl-4">
                  <li><code>run_summary.json</code></li>
                  <li><code>**/manifest.json</code> + <code>sessions/**/item.json</code></li>
                  <li><code>task123_session_packets/sess_*.json</code></li>
                  <li><code>chunks/chunk_*/sess_*.json</code></li>
                </ul>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="space-y-4">
            <DatasetControlBar
              dataset={dataset}
              activeEntry={activeEntry}
              currentItemIndex={currentItemIndex}
              currentItem={currentItem}
              isLoadingItem={isLoadingItem}
              entrySavedCount={entrySavedCount}
              lastSavedTime={lastSavedTime}
              currentSavedAnnotation={currentSavedAnnotation}
              jumpInput={jumpInput}
              trackOptions={trackOptions}
              taskOptions={taskOptions}
              abilityOptions={abilityOptions}
              onTrackChange={handleTrackChange}
              onTaskChange={handleTaskChange}
              onAbilityChange={handleAbilityChange}
              onPrev={() => setCurrentItemIndex((v) => Math.max(v - 1, 0))}
              onNext={() =>
                setCurrentItemIndex((v) =>
                  activeEntry ? Math.min(v + 1, activeEntry.itemCount - 1) : v,
                )
              }
              onJumpInputChange={setJumpInput}
              onJump={handleJump}
            />

            {dataset.warnings.length > 0 && (
              <Card className="border-amber-200 bg-amber-50 shadow-sm">
                <CardHeader className="border-b border-amber-100 px-5 py-3">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium text-amber-800">
                    <AlertTriangle className="h-4 w-4" />
                    导入提示
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-5 py-4">
                  <ul className="list-disc space-y-1 pl-5 text-sm text-amber-700">
                    {dataset.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            <div
              className={
                showRightAnnotationColumn
                  ? 'grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,6fr)_minmax(0,4fr)]'
                  : ''
              }
            >
              {/* Left / main content */}
              <div className="min-w-0">
                {isLoadingItem ? (
                  <Card className={sampleBlockCardClass}>
                    <CardHeader className={sampleBlockHeaderClass}>
                      <CardTitle className="flex items-center gap-2 text-base font-medium text-slate-700">
                        <LoaderCircle className="h-4 w-4 animate-spin text-slate-400" />
                        正在加载…
                      </CardTitle>
                    </CardHeader>
                    <CardContent className={sampleBlockContentClass}>
                      <div className="flex min-h-[160px] items-center justify-center text-sm text-slate-400">
                        加载中，请稍候
                      </div>
                    </CardContent>
                  </Card>
                ) : currentItem ? (
                  <TaskSampleDisplay
                    loadedItem={currentItem}
                    evaluationMode={evaluationMode}
                    currentAnnotation={currentSavedAnnotation}
                    linkedTask1Annotation={linkedTask1Annotation}
                    onDraftChange={(annotation) => upsertAnnotationRecord(annotation)}
                    onSave={(annotation) => upsertAnnotationRecord(annotation, '标注已保存。')}
                  />
                ) : (
                  <Card className={sampleBlockCardClass}>
                    <CardHeader className={sampleBlockHeaderClass}>
                      <CardTitle className="flex items-center gap-2 text-base font-medium text-slate-700">
                        <FileJson className="h-4 w-4 text-slate-400" />
                        样本展示
                      </CardTitle>
                    </CardHeader>
                    <CardContent className={sampleBlockContentClass}>
                      <div className="rounded-xl border border-dashed border-slate-200 py-14 text-center text-sm text-slate-400">
                        当前尚未加载样本
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Right column: requirement + annotation form (Q2 only) */}
              {showRightAnnotationColumn && (
                <div className="min-w-0 space-y-4 lg:sticky lg:top-[69px] lg:max-h-[calc(100vh-85px)] lg:overflow-y-auto">
                  {requirement && <TaskRequirementPanel requirement={requirement} />}
                  {requirement && activeEntry && <Separator className="bg-slate-200" />}
                  {activeEntry && (
                    <AnnotationPane
                      key={`${annotationPaneVersion}:${activeEntry.id}:${currentDraftKey ?? 'no-item'}`}
                      entry={activeEntry}
                      loadedItem={currentItem}
                      currentAnnotation={currentSavedAnnotation}
                      evaluationMode={evaluationMode}
                      onEvaluationModeChange={setEvaluationMode}
                      onDraftChange={(annotation) => upsertAnnotationRecord(annotation)}
                      onSave={(annotation) => upsertAnnotationRecord(annotation, '标注已保存。')}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


