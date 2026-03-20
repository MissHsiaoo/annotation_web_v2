import { useEffect, useState } from 'react';
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
import { TaskSampleDisplay } from '../components/display/TaskSampleDisplay';
import { buildUploadedFileIndex } from '../data/indexers/buildUploadedFileIndex';
import {
  buildAnnotationDraftKey,
  getManifestRowAssignedModel,
  loadManualCheckDataset,
  loadManualCheckItem,
} from '../data/manualCheckFolderLoader';
import type {
  AbilityKey,
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
  Q1: 'Q1 Benchmark Construction',
  Q2: 'Q2 LLM-as-a-Judge Alignment',
};

const TASK_LABELS: Record<TaskKey, string> = {
  task1: 'Task 1',
  task2: 'Task 2',
  task3: 'Task 3',
  task4: 'Task 4',
};

const ABILITY_LABELS: Record<AbilityKey, string> = {
  ability1: 'Ability 1',
  ability2: 'Ability 2',
  ability3: 'Ability 3',
  ability4: 'Ability 4',
  ability5: 'Ability 5',
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
    <div className={`min-w-[150px] rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 ${className}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className={`mt-1 text-sm font-semibold ${tone === 'muted' ? 'text-slate-700' : 'text-slate-900'}`}>{value}</p>
    </div>
  );
}

export default function Q1Q2AnnotationApp() {
  const [dataset, setDataset] = useState<ManualCheckDataset | null>(null);
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [currentItem, setCurrentItem] = useState<LoadedManualCheckItem | null>(null);
  const [jumpInput, setJumpInput] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [isLoadingItem, setIsLoadingItem] = useState(false);
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
  const currentSavedAnnotation = currentDraftKey ? savedAnnotations[currentDraftKey]?.annotation : undefined;
  const entrySavedCount = activeEntry
    ? Object.values(savedAnnotations).filter(
        (item) =>
          item.track === activeEntry.track &&
          item.task === activeEntry.task &&
          (item.ability ?? null) === (activeEntry.ability ?? null),
      ).length
    : 0;
  const currentSampleSavedAt = currentSavedAnnotation?.updatedAt
    ? new Date(currentSavedAnnotation.updatedAt)
    : null;
  const currentSampleSaveLabel = currentSampleSavedAt
    ? `Saved ${currentSampleSavedAt.toLocaleString()}`
    : 'Current item not saved yet';
  const progressPercent = activeEntry ? ((currentItemIndex + 1) / activeEntry.itemCount) * 100 : 0;

  useEffect(() => {
    if (!dataset) {
      return;
    }

    const storageKey = `q1-q2-annotations:${dataset.rootName}`;
    const raw = localStorage.getItem(storageKey);

    if (!raw) {
      setSavedAnnotations({});
      setLastSavedTime(null);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as {
        savedAnnotations?: Record<string, SavedAnnotationEntry>;
        updatedAt?: string;
      };

      setSavedAnnotations(parsed.savedAnnotations ?? {});
      setLastSavedTime(parsed.updatedAt ? new Date(parsed.updatedAt) : null);
    } catch {
      setSavedAnnotations({});
      setLastSavedTime(null);
      toast.warning('Failed to restore saved annotations from local storage.');
    }
  }, [dataset]);

  useEffect(() => {
    if (!dataset) {
      return;
    }

    const storageKey = `q1-q2-annotations:${dataset.rootName}`;
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
          toast.error(error instanceof Error ? error.message : 'Failed to load item.');
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

  const handleDatasetImport = async (files: FileList) => {
    setIsImporting(true);

    try {
      const uploadedFileIndex = buildUploadedFileIndex(files);
      const loadedDataset = await loadManualCheckDataset(uploadedFileIndex);
      const firstEntry = loadedDataset.entries[0];

      setDataset(loadedDataset);
      setActiveEntryId(firstEntry.id);
      setCurrentItemIndex(0);
      setCurrentItem(null);
      setJumpInput('');
      setEvaluationMode('judge_visible');

      toast.success(`Loaded ${loadedDataset.entries.length} dataset views from ${loadedDataset.rootName}.`);

      if (loadedDataset.warnings.length > 0) {
        toast.info('Dataset loaded with warnings. Review the import notes in the workbench.');
      }
    } catch (error) {
      setDataset(null);
      setActiveEntryId(null);
      setCurrentItem(null);
      toast.error(error instanceof Error ? error.message : 'Failed to import dataset folder.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleReset = () => {
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
    if (!dataset) {
      return;
    }

    const nextEntry = dataset.entries.find((entry) => entry.track === nextTrack);
    if (!nextEntry) {
      return;
    }

    setActiveEntryId(nextEntry.id);
    setCurrentItemIndex(0);
    setEvaluationMode('judge_visible');
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

    setActiveEntryId(nextEntry.id);
    setCurrentItemIndex(0);
    setEvaluationMode('judge_visible');
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

    setActiveEntryId(nextEntry.id);
    setCurrentItemIndex(0);
    setEvaluationMode('judge_visible');
  };

  const handleJump = () => {
    if (!activeEntry) {
      return;
    }

    const target = Number.parseInt(jumpInput, 10);
    if (Number.isNaN(target)) {
      toast.error('Enter a valid item number.');
      return;
    }

    const nextIndex = target - 1;
    if (nextIndex < 0 || nextIndex >= activeEntry.itemCount) {
      toast.error(`Item number must be between 1 and ${activeEntry.itemCount}.`);
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

  const handleSaveAnnotation = (annotation: AnySupportedAnnotation) => {
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

    toast.success('Annotation saved.');
  };

  const handleDownloadAnnotations = () => {
    if (!dataset) {
      return;
    }

    const exportPayload = {
      sourceType: dataset.sourceType,
      rootName: dataset.rootName,
      generatedAt: new Date().toISOString(),
      annotations: Object.values(savedAnnotations),
    };

    downloadJson(exportPayload, `q1-q2-annotations-${Date.now()}.json`);
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <Toaster position="top-right" />
      <div className="mx-auto max-w-[1680px] space-y-6">
        <header className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-slate-200 bg-slate-100 text-slate-700">
                  Q1/Q2 Workbench
                </Badge>
                <Badge variant="outline" className="border-slate-200 bg-slate-100 text-slate-600">
                  Manual check dataset
                </Badge>
              </div>
              <div className="flex items-center gap-3">
                <Layers3 className="h-7 w-7 text-slate-700" />
                <div>
                  <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Q1/Q2 Annotation Workbench</h1>
                  <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
                    A task-aware annotation workspace for <code>manual_check_data</code>, with folder import,
                    lazy sample loading, requirement-guided review, and per-task human annotation flows for Q1 and Q2.
                  </p>
                </div>
              </div>
            </div>

            {dataset ? (
              <div className="flex flex-wrap gap-2 lg:justify-end">
                <Button type="button" variant="outline" onClick={handleReset} className="gap-2 rounded-xl border-slate-300 bg-white">
                  <RefreshCw className="h-4 w-4" />
                  Reset import
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDownloadAnnotations}
                  disabled={Object.keys(savedAnnotations).length === 0}
                  className="gap-2 rounded-xl border-slate-300 bg-white"
                >
                  <Archive className="h-4 w-4" />
                  Download annotations
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    currentItem
                      ? downloadJson(
                          currentItem.itemData,
                          `${currentItem.entry.track}-${currentItem.entry.task}-${currentItem.manifestRow.session_id}-${currentItem.manifestRow.canonical_id}.json`,
                        )
                      : null
                  }
                  disabled={!currentItem}
                  className="gap-2 rounded-xl border-slate-300 bg-white"
                >
                  <ArrowDownToLine className="h-4 w-4" />
                  Download current item
                </Button>
              </div>
            ) : null}
          </div>
        </header>

        {!dataset ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.8fr)_minmax(320px,1fr)]">
            <FileSourceSelector onFolderSelected={handleDatasetImport} isLoading={isImporting} />

            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="border-b border-slate-100">
                <CardTitle className="flex items-center gap-2 text-slate-900">
                  <Database className="h-5 w-5 text-slate-700" />
                  Expected dataset shape
                </CardTitle>
                <CardDescription className="text-slate-600">
                  The current implementation is tuned for the exported folder structure already present in this
                  workspace.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-6 text-sm text-slate-600">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="mb-2 font-medium text-slate-900">Key files</p>
                  <ul className="list-disc space-y-1 pl-4">
                    <li><code>run_summary.json</code></li>
                    <li><code>benchmark_construction_check_data/**/manifest.json</code></li>
                    <li><code>LLM_as_judge_Human_Alignment_data/**/manifest.json</code></li>
                    <li><code>sessions/&lt;session&gt;__&lt;canonical&gt;/item.json</code></li>
                  </ul>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <p className="mb-2 font-medium text-slate-900">What this slice proves</p>
                  <ul className="list-disc space-y-1 pl-4">
                    <li>The app can discover Q1/Q2 dataset views from the folder.</li>
                    <li>The app can map manifest rows to the correct <code>item.json</code>.</li>
                    <li>The app can browse samples without eagerly reading the whole dataset.</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="space-y-6">
            <Card className="overflow-hidden border-slate-200 bg-white shadow-sm">
              <CardHeader className="border-b border-slate-100 bg-white px-5 py-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <CardTitle className="flex items-center gap-2 text-base text-slate-900">
                      <FolderTree className="h-5 w-5 text-slate-700" />
                      Dataset workbench
                    </CardTitle>
                    <CardDescription className="text-sm text-slate-600">
                      Imported from <code>{dataset.rootName}</code> with {dataset.entries.length} discovered dataset views.
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                      {entrySavedCount} / {activeEntry?.itemCount ?? 0} annotated in this view
                    </Badge>
                    <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                      {currentSampleSaveLabel}
                    </Badge>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4 px-5 pt-4">
                <div className="flex flex-wrap items-end gap-3">
                      <div className="min-w-[220px] flex-1 space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Track</label>
                        <Select value={activeEntry?.track} onValueChange={handleTrackChange}>
                          <SelectTrigger className="h-10 rounded-xl border-slate-300 bg-white">
                            <SelectValue placeholder="Select track" />
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
                        <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Task</label>
                        <Select value={activeEntry?.task} onValueChange={handleTaskChange}>
                          <SelectTrigger className="h-10 rounded-xl border-slate-300 bg-white">
                            <SelectValue placeholder="Select task" />
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
                        <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Ability</label>
                        <Select
                          value={activeEntry?.ability ?? 'none'}
                          onValueChange={handleAbilityChange}
                          disabled={activeEntry?.task !== 'task4'}
                        >
                          <SelectTrigger className="h-10 rounded-xl border-slate-300 bg-white">
                            <SelectValue placeholder="No ability" />
                          </SelectTrigger>
                          <SelectContent>
                            {activeEntry?.task !== 'task4' ? (
                              <SelectItem value="none">Not applicable</SelectItem>
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

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                        <div className="space-y-2 xl:min-w-[240px]">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Current progress</p>
                          <div className="flex items-end gap-3">
                            <p className="text-2xl font-semibold tracking-tight text-slate-950">
                              {activeEntry ? `${currentItemIndex + 1} / ${activeEntry.itemCount}` : '0 / 0'}
                            </p>
                            <p className="pb-1 text-xs text-slate-500">
                              {activeEntry ? `${progressPercent.toFixed(1)}% through this view` : 'No active view'}
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
                              className="gap-2 rounded-xl border-slate-300 bg-white"
                            >
                              <ChevronLeft className="h-4 w-4" />
                              Previous
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
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
                              className="gap-2 rounded-xl border-slate-300 bg-white"
                            >
                              Next
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
                              placeholder="Jump to item #"
                              className="h-10 rounded-xl border-slate-300 bg-white"
                            />
                            <Button type="button" variant="outline" onClick={handleJump} className="rounded-xl border-slate-300 bg-white">
                              Go
                            </Button>
                          </div>
                        </div>
                      </div>
                      <Progress value={progressPercent} className="mt-3 h-2 bg-slate-200 [&>div]:bg-slate-900" />
                </div>

                <div className="flex flex-wrap gap-3 lg:flex-nowrap">
                  <SummaryStat
                    label="Current view"
                    value={activeEntry ? getEntryLabel(activeEntry) : 'No selection'}
                    className="min-w-[220px] flex-[1.35]"
                  />
                  <SummaryStat
                    label="Annotated"
                    value={`${entrySavedCount} / ${activeEntry?.itemCount ?? 0}`}
                    className="flex-1"
                  />
                  <SummaryStat
                    label="Session"
                    value={currentItem?.manifestRow.session_id ?? 'Loading...'}
                    tone="muted"
                    className="min-w-[190px] flex-1"
                  />
                  <SummaryStat
                    label="Assigned model"
                    value={currentAssignedModel ?? 'Not assigned'}
                    tone="muted"
                    className="min-w-[180px] flex-1"
                  />
                  <SummaryStat
                    label="Canonical ID"
                    value={currentItem?.manifestRow.canonical_id ?? 'N/A'}
                    tone="muted"
                    className="min-w-[180px] flex-1"
                  />
                  <SummaryStat
                    label="Autosave"
                    value={lastSavedTime ? `Local backup ${lastSavedTime.toLocaleTimeString()}` : 'No local backup'}
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
                    Import notes
                  </CardTitle>
                  <CardDescription className="text-amber-800">
                    These warnings do not block browsing, but they may matter for partial imports.
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
              className="flex items-start gap-6"
              style={{
                alignItems: 'flex-start',
              }}
            >
              <div
                className="min-w-0 space-y-4"
                style={{
                  flex: '1 1 0%',
                  width: '0',
                }}
              >
                {isLoadingItem ? (
                  <Card className="min-w-0 overflow-hidden border-slate-200 shadow-sm">
                    <CardHeader className="border-b border-slate-100">
                      <CardTitle className="flex items-center gap-2 text-slate-900">
                        <FileJson className="h-5 w-5 text-slate-700" />
                        Sample display
                      </CardTitle>
                      <CardDescription className="text-slate-600">
                        Loading the task-aware display for the current item.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <div className="flex min-h-[240px] items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
                        <div className="flex items-center gap-3 text-slate-600">
                          <LoaderCircle className="h-5 w-5 animate-spin" />
                          Loading current item...
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ) : currentItem ? (
                  <TaskSampleDisplay loadedItem={currentItem} evaluationMode={evaluationMode} />
                ) : (
                  <Card className="min-w-0 overflow-hidden border-slate-200 shadow-sm">
                    <CardHeader className="border-b border-slate-100">
                      <CardTitle className="flex items-center gap-2 text-slate-900">
                        <FileJson className="h-5 w-5 text-slate-700" />
                        Sample display
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
                        No item is currently loaded.
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              <div
                className="min-w-0 space-y-4"
                style={{
                  flex: '0 0 clamp(420px, 30vw, 580px)',
                  width: 'clamp(420px, 30vw, 580px)',
                  maxHeight: 'calc(100vh - 5rem)',
                  overflowY: 'auto',
                  paddingRight: '0.25rem',
                  position: 'sticky',
                  top: '1rem',
                }}
              >
                {requirement ? <TaskRequirementPanel requirement={requirement} /> : null}

                {activeEntry ? (
                  <AnnotationPane
                    key={`${activeEntry.id}:${currentDraftKey ?? 'no-item'}`}
                    entry={activeEntry}
                    loadedItem={currentItem}
                    currentAnnotation={currentSavedAnnotation}
                    evaluationMode={evaluationMode}
                    onEvaluationModeChange={setEvaluationMode}
                    onSave={handleSaveAnnotation}
                  />
                ) : null}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
