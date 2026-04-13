import { useEffect, useState, type ReactNode } from 'react';
import { Languages } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../components/ui/alert-dialog';
import { Badge } from '../../../components/ui/badge';
import { Button, buttonVariants } from '../../../components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog';
import type {
  AnySupportedAnnotation,
  AbilityKey,
  EvaluationMode,
  LoadedManualCheckItem,
  Q1Task1Annotation,
  Q1Task2Annotation,
  Q1Task3Annotation,
  Q1Task4Annotation,
  Q1Task4SubAnnotation,
} from '../../types';
import {
  cloneMemoryRecord,
  type EditableMemoryRecord,
  StructuredMemoryEditor,
  validateMemoryRecords,
} from '../forms/StructuredMemoryEditor';
import { CheckboxField, RadioField, TextAreaField } from '../forms/FormFields';
import { JsonPreviewBlock } from '../JsonPreviewBlock';
import { ConversationBlock } from './ConversationBlock';
import { MemoryListBlock } from './MemoryListBlock';
import { sampleBlockCardClass, sampleBlockContentClass, sampleBlockHeaderClass } from './sampleBlockStyles';
import { TextBlock } from './TextBlock';

type Dictionary = Record<string, any>;

interface TaskSampleDisplayProps {
  loadedItem: LoadedManualCheckItem;
  evaluationMode: EvaluationMode;
  currentAnnotation?: AnySupportedAnnotation;
  linkedTask1Annotation?: Q1Task1Annotation;
  onDraftChange?: (annotation: AnySupportedAnnotation) => void;
  onSave?: (annotation: AnySupportedAnnotation) => void;
}

function asDictionary(value: unknown): Dictionary | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Dictionary) : null;
}

function asArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function stripCodeFence(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1].trim() : trimmed;
}

function formatPossiblyStructuredString(value: unknown): string | null {
  const text = asString(value);
  if (!text) {
    return null;
  }

  const stripped = stripCodeFence(text);
  if (!stripped) {
    return text;
  }

  if (stripped.startsWith('{') || stripped.startsWith('[')) {
    try {
      return JSON.stringify(JSON.parse(stripped), null, 2);
    } catch {
      return stripped;
    }
  }

  return stripped;
}

function normalizeConversation(value: unknown): Array<{ role: string; text: string }> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') {
      return [];
    }

    const record = item as Dictionary;

    if (typeof record.role === 'string' && typeof record.text === 'string') {
      return [{ role: record.role, text: record.text }];
    }

    const turns: Array<{ role: string; text: string }> = [];

    if (typeof record.human === 'string') {
      turns.push({ role: 'user', text: record.human });
    }

    if (typeof record.assistant === 'string') {
      turns.push({ role: 'assistant', text: record.assistant });
    }

    return turns;
  });
}

function getResponseItems(modelOutput: Dictionary | null): Array<{ label?: string; text: string }> {
  if (!modelOutput) {
    return [];
  }

  const responses = asArray(modelOutput.responses)
    .map((response, index) => {
      const record = asDictionary(response);
      const text = record ? asString(record.response) : null;
      if (!text) {
        return null;
      }

      return {
        label: asString(record.query_id) ?? `鍥炵瓟 ${index + 1}`,
        text,
      };
    })
    .filter(Boolean) as Array<{ label?: string; text: string }>;

  if (responses.length > 0) {
    return responses;
  }

  const responseText = asString(modelOutput.response_text) ?? asString(modelOutput.response);
  return responseText ? [{ text: responseText }] : [];
}

function buildJudgeReviewTextItems(
  reviewItems: unknown,
  reviewKind: 'pair_reviews' | 'missing_reviews' | 'extra_reviews',
): Array<{ label?: string; text: string }> {
  if (!Array.isArray(reviewItems)) {
    return [];
  }

  return reviewItems
    .map((item, index) => {
      const record = asDictionary(item);
      if (!record) {
        return null;
      }

      const rationale =
        formatPossiblyStructuredString(record.rationale) ?? JSON.stringify(record, null, 2);

      if (reviewKind === 'pair_reviews') {
        return {
          label: `${asString(record.gold_id) ?? 'gold'} -> ${asString(record.pred_id) ?? 'pred'} | ${
            record.ok === true ? 'match' : 'mismatch'
          } | severity ${typeof record.severity === 'number' ? record.severity : '?'}`,
          text: rationale,
        };
      }

      if (reviewKind === 'missing_reviews') {
        return {
          label: `${asString(record.id) ?? `missing-${index + 1}`} | should extract ${
            record.should_have_extracted === true ? 'yes' : 'no'
          } | severity ${typeof record.severity === 'number' ? record.severity : '?'}`,
          text: rationale,
        };
      }

      return {
        label: `${asString(record.id) ?? `extra-${index + 1}`} | hallucinated ${
          record.hallucinated === true ? 'yes' : 'no'
        } | severity ${typeof record.severity === 'number' ? record.severity : '?'}`,
        text: rationale,
      };
    })
    .filter(Boolean) as Array<{ label?: string; text: string }>;
}

function getTask3ModelTextItems(modelOutput: Dictionary | null): Array<{ label?: string; text: string }> {
  if (!modelOutput) {
    return [];
  }

  const parsedResponse = asDictionary(modelOutput.parsed_response);
  const items: Array<{ label?: string; text: string }> = [];

  const answerText = formatPossiblyStructuredString(parsedResponse?.answer);
  if (answerText) {
    items.push({ label: '鍥炵瓟', text: answerText });
  }

  const reasonText = formatPossiblyStructuredString(parsedResponse?.reason);
  if (reasonText) {
    items.push({ label: '鍘熷洜', text: reasonText });
  }

  const selectedMemoryId = asString(parsedResponse?.selected_memory_id);
  if (selectedMemoryId) {
    items.push({ label: '閫変腑璁板繂 ID', text: selectedMemoryId });
  }

  const rawOutput = formatPossiblyStructuredString(modelOutput.raw_output);
  if (items.length === 0 && rawOutput) {
    items.push({ label: '妯″瀷鍘熷杈撳嚭', text: rawOutput });
  }

  return items;
}

function getTask1ModelMemoryGroups(
  llmOutputs: unknown,
): Array<{ modelName: string; items: Array<Record<string, unknown>> }> {
  const outputRecord = asDictionary(llmOutputs);
  if (!outputRecord) {
    return [];
  }

  return Object.entries(outputRecord)
    .map(([modelName, modelValue]) => {
      const modelRecord = asDictionary(modelValue);
      const memoryItems = asArray(modelRecord?.memory_items).filter(
        (item): item is Record<string, unknown> => Boolean(asDictionary(item)),
      );

      if (memoryItems.length === 0) {
        return null;
      }

      return {
        modelName,
        items: memoryItems,
      };
    })
    .filter(Boolean) as Array<{ modelName: string; items: Array<Record<string, unknown>> }>;
}

function getMemoryRecords(value: unknown): EditableMemoryRecord[] {
  return asArray(value)
    .map((item, index) => {
      const record = asDictionary(item);
      if (!record || !String(record.value ?? '').trim()) {
        return null;
      }

      return {
        ...record,
        memory_id:
          typeof record.memory_id === 'string' && record.memory_id.trim()
            ? record.memory_id
            : `memory-${index + 1}`,
      };
    })
    .filter(Boolean) as EditableMemoryRecord[];
}

function getSelectedMemoryRecord(value: unknown): EditableMemoryRecord | null {
  const record = asDictionary(value);
  return record ? cloneMemoryRecord(record) : null;
}

function getLinkedGoldMemories(linkedTask1Annotation?: Q1Task1Annotation): EditableMemoryRecord[] {
  return (linkedTask1Annotation?.editableGoldMemories ?? [])
    .filter((item): item is EditableMemoryRecord => Boolean(asDictionary(item)))
    .map(cloneMemoryRecord);
}

function syncSelectedMemoryWithGold(
  selectedMemory: EditableMemoryRecord | null,
  goldMemories: EditableMemoryRecord[],
): EditableMemoryRecord | null {
  if (!selectedMemory) {
    return null;
  }

  const selectedMemoryId = asString(selectedMemory.memory_id);
  const matchedById = selectedMemoryId
    ? goldMemories.find((memory) => asString(memory.memory_id) === selectedMemoryId)
    : null;

  if (matchedById) {
    return cloneMemoryRecord(matchedById);
  }

  const selectedLabel = asString(selectedMemory.label);
  const selectedValue = asString(selectedMemory.value);
  const matchedByContent =
    selectedLabel || selectedValue
      ? goldMemories.find(
          (memory) =>
            asString(memory.label) === selectedLabel &&
            asString(memory.value) === selectedValue,
        )
      : null;

  return matchedByContent ? cloneMemoryRecord(matchedByContent) : cloneMemoryRecord(selectedMemory);
}

function getNewDialogueSeeds(value: unknown): Array<{ turnId: string; role: string; text: string }> {
  return normalizeConversation(value).map((turn, index) => ({
    turnId: `turn-${index + 1}`,
    role: turn.role,
    text: turn.text,
  }));
}

function createTask1Annotation(
  goldMemorySeed: EditableMemoryRecord[],
  existing?: AnySupportedAnnotation,
): Q1Task1Annotation {
  if (existing?.formType === 'Q1:task1' && existing.editableGoldMemories !== undefined) {
    return existing;
  }

  return {
    formType: 'Q1:task1',
    status: 'draft',
    updatedAt: '',
    overallVerdict: 'reasonable',
    hasDialogueEvidence: 'yes',
    overInference: 'no',
    faithfulToOriginalMeaning: 'yes',
    editableGoldMemories: goldMemorySeed.map(cloneMemoryRecord),
    issueTypes: [],
    evidenceNote: '',
    revisionSuggestion: '',
    annotatorNote: '',
  };
}

function syncUpdatedMemoriesWithGold(
  memories: EditableMemoryRecord[],
  goldMemories: EditableMemoryRecord[],
): EditableMemoryRecord[] {
  if (goldMemories.length === 0) return memories;

  // Patch value for memories with matching ID
  const existingIds = new Set(memories.map((m) => String(m.memory_id ?? '')).filter(Boolean));
  const patched = memories.map((m) => {
    const id = String(m.memory_id ?? '');
    const gold = id ? goldMemories.find((g) => String(g.memory_id ?? '') === id) : null;
    if (!gold) return m;
    // Sync taxonomy/metadata from gold; preserve task2-specific fields (reasoning, evidence, evidence_text).
    return {
      ...m,
      memory_id: gold.memory_id,
      value: gold.value,
      type: gold.type,
      label: gold.label,
      label_suggestion: gold.label_suggestion,
      confidence: gold.confidence,
      time_scope: gold.time_scope,
      emotion: gold.emotion,
      preference_attitude: gold.preference_attitude,
    };
  });

  // Append new gold memories not already present.
  // Clear evidence/evidence_text because those reference task1 dialogue turns,
  // not the task2 new_dialogue turns.
  const newEntries = goldMemories
    .filter((g) => {
      const id = String(g.memory_id ?? '');
      return id && !existingIds.has(id);
    })
    .map((g) => ({ ...cloneMemoryRecord(g), evidence: null, evidence_text: '' }));

  // Safety net: deduplicate final list by memory_id (keep first occurrence)
  const seen = new Set<string>();
  return [...patched, ...newEntries].filter((m) => {
    const id = String(m.memory_id ?? '');
    if (!id) return true;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function createTask2Annotation(
  newDialogueSeed: Array<{ turnId: string; role: string; text: string }>,
  updatedMemorySeed: EditableMemoryRecord[],
  existing?: AnySupportedAnnotation,
  linkedGoldMemories: EditableMemoryRecord[] = [],
): Q1Task2Annotation {
  const base: Q1Task2Annotation =
    existing?.formType === 'Q1:task2'
      ? existing
      : {
          formType: 'Q1:task2',
          status: 'draft',
          updatedAt: '',
          overallVerdict: 'reasonable',
          expectedAction: 'modification',
          newDialogueContainsUpdateSignal: 'yes',
          goldUpdateReasonable: 'yes',
          changedOnlyRelevantMemory: 'yes',
          editableNewDialogue: newDialogueSeed,
          editableUpdatedMemories: updatedMemorySeed.map(cloneMemoryRecord),
          issueTypes: [],
          evidenceNote: '',
          revisionSuggestion: '',
          annotatorNote: '',
        };

  return {
    ...base,
    editableUpdatedMemories: syncUpdatedMemoriesWithGold(base.editableUpdatedMemories, linkedGoldMemories),
  };
}

function createTask3Annotation(
  querySeed: string,
  selectedMemorySeed: EditableMemoryRecord | null,
  existing?: AnySupportedAnnotation,
  linkedGoldMemories: EditableMemoryRecord[] = [],
): Q1Task3Annotation {
  if (existing?.formType === 'Q1:task3') {
    const baseMemory =
      existing.editableSelectedMemory ?? (selectedMemorySeed ? cloneMemoryRecord(selectedMemorySeed) : null);
    return {
      ...existing,
      queryText: existing.queryText ?? querySeed,
      editableSelectedMemory: syncSelectedMemoryWithGold(baseMemory, linkedGoldMemories),
    };
  }

  return {
    formType: 'Q1:task3',
    status: 'draft',
    updatedAt: '',
    queryText: querySeed,
    editableSelectedMemory: selectedMemorySeed ? cloneMemoryRecord(selectedMemorySeed) : null,
    relevanceLevel: 'strong',
    hardWithoutTargetMemory: 'yes',
    answerableByCommonSense: 'no',
    multipleMemoriesCouldSupport: 'no',
    evidenceNote: '',
    revisionSuggestion: '',
    annotatorNote: '',
  };
}

const TASK4_VERDICT_OPTIONS = [
  { value: 'reasonable', label: 'Reasonable' },
  { value: 'partially_reasonable', label: 'Partially Reasonable' },
  { value: 'unreasonable', label: 'Unreasonable' },
];

const TASK4_TERNARY_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'partial', label: 'Partial' },
  { value: 'no', label: 'No' },
];

const TASK4_DEPENDENCY_OPTIONS = [
  { value: 'strong', label: 'Strong' },
  { value: 'medium', label: 'Medium' },
  { value: 'weak', label: 'Weak' },
];

const TASK4_PURITY_OPTIONS = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const TASK4_ISSUE_TYPE_OPTIONS = [
  { value: 'ability_mismatch', label: 'Ability Mismatch' },
  { value: 'memory_not_required', label: 'Memory Not Required' },
  { value: 'selected_memory_wrong', label: 'Selected Memory Wrong' },
  { value: 'query_unclear', label: 'Query Unclear' },
  { value: 'leakage', label: 'Leakage' },
  { value: 'other', label: 'Other' },
];

interface Task4QuerySeed {
  queryId: string;
  queryText: string;
  ability?: AbilityKey;
  task4RecordIndex?: number;
  selectedMemorySeed: EditableMemoryRecord | null;
}

function getTask4SelectedMemoryRecord(original: Dictionary): EditableMemoryRecord | null {
  const selectedMemory =
    asDictionary(original.selected_memory) ??
    asDictionary(original.task4_selected_memory);

  if (selectedMemory) {
    return cloneMemoryRecord(selectedMemory);
  }

  const memoryKey = asString(original.memory_key) ?? asString(original.task4_selected_memory_id);
  const memoryItems = asArray(original.extracted_memory);
  const matchedMemory = memoryKey
    ? memoryItems
        .map(asDictionary)
        .find((item) => item?.memory_id === memoryKey)
    : null;

  return matchedMemory ? cloneMemoryRecord(matchedMemory) : null;
}

function buildTask4QuerySeeds(original: Dictionary): Task4QuerySeed[] {
  const fallbackSelectedMemory = getTask4SelectedMemoryRecord(original);

  return asArray(original.queries)
    .map((item, index) => {
      const record = asDictionary(item);
      const queryText = record ? asString(record.query) : null;

      if (!queryText) {
        return null;
      }

      const selectedMemory = asDictionary(record?.task4_selected_memory);
      return {
        queryId: asString(record?.query_id) ?? `query-${index + 1}`,
        queryText,
        ability: asString(record?.ability) as AbilityKey | undefined,
        task4RecordIndex:
          typeof record?.task4_record_index === 'number' ? record.task4_record_index : undefined,
        selectedMemorySeed: selectedMemory
          ? cloneMemoryRecord(selectedMemory)
          : fallbackSelectedMemory
            ? cloneMemoryRecord(fallbackSelectedMemory)
            : null,
      };
    })
    .filter(Boolean) as Task4QuerySeed[];
}

function createTask4SubAnnotation(seed: Task4QuerySeed): Q1Task4SubAnnotation {
  return {
    queryId: seed.queryId,
    queryText: seed.queryText,
    ability: seed.ability,
    task4RecordIndex: seed.task4RecordIndex,
    editableSelectedMemory: seed.selectedMemorySeed ? cloneMemoryRecord(seed.selectedMemorySeed) : null,
    overallVerdict: 'reasonable',
    testsTargetAbility: 'yes',
    memoryDependency: 'strong',
    abilityPurity: 'high',
    issueTypes: [],
    evidenceNote: '',
    revisionSuggestion: '',
  };
}

function createTask4Annotation(
  querySeeds: Task4QuerySeed[],
  selectedMemorySeed: EditableMemoryRecord | null,
  ability: Q1Task4Annotation['ability'],
  existing?: AnySupportedAnnotation,
  linkedGoldMemories: EditableMemoryRecord[] = [],
): Q1Task4Annotation {
  const existingTask4 = existing?.formType === 'Q1:task4' ? existing : null;
  const existingById = new Map(existingTask4?.subAnnotations.map((item) => [item.queryId, item]) ?? []);

  return {
    formType: 'Q1:task4',
    status: existingTask4?.status ?? 'draft',
    updatedAt: existingTask4?.updatedAt ?? '',
    ability,
    editableSelectedMemory: syncSelectedMemoryWithGold(
      existingTask4?.editableSelectedMemory ?? (selectedMemorySeed ? cloneMemoryRecord(selectedMemorySeed) : null),
      linkedGoldMemories,
    ),
    subAnnotations: querySeeds.map((seed) => {
      const existingItem = existingById.get(seed.queryId);
      const baseMemory = existingItem
        ? (existingItem.editableSelectedMemory ?? (seed.selectedMemorySeed ? cloneMemoryRecord(seed.selectedMemorySeed) : null))
        : (seed.selectedMemorySeed ? cloneMemoryRecord(seed.selectedMemorySeed) : null);
      return existingItem
        ? {
            ...existingItem,
            queryText: existingItem.queryText ?? seed.queryText,
            ability: existingItem.ability ?? seed.ability,
            task4RecordIndex: existingItem.task4RecordIndex ?? seed.task4RecordIndex,
            editableSelectedMemory: syncSelectedMemoryWithGold(baseMemory, linkedGoldMemories),
          }
        : createTask4SubAnnotation(seed);
    }),
    evidenceNote: existingTask4?.evidenceNote ?? '',
    revisionSuggestion: existingTask4?.revisionSuggestion ?? '',
    annotatorNote: existingTask4?.annotatorNote ?? '',
  };
}

function validateTask4SelectedMemoryRecord(record: EditableMemoryRecord | null): string | null {
  if (!record) {
    return 'Selected Memory cannot be empty.';
  }

  if (!String(record.value ?? '').trim()) {
    return 'Selected Memory value cannot be empty.';
  }

  if (typeof record.evidence !== 'undefined' && record.evidence !== null && !asDictionary(record.evidence)) {
    return 'Selected Memory evidence must be a JSON object or null, not a plain string.';
  }

  return null;
}

function markDraft<T extends AnySupportedAnnotation>(annotation: T, patch: Partial<T>): T {
  return {
    ...annotation,
    ...patch,
    status: 'draft',
    updatedAt: new Date().toISOString(),
  };
}

function markSaved<T extends AnySupportedAnnotation>(annotation: T): T {
  return {
    ...annotation,
    status: 'saved',
    updatedAt: new Date().toISOString(),
  };
}

function DisplaySection({
  title,
  tone,
  children,
}: {
  title: string;
  tone: 'input' | 'output' | 'judge';
  children: ReactNode;
}) {
  const toneClasses =
    tone === 'input'
      ? 'border-sky-200 bg-sky-50/55'
      : tone === 'output'
        ? 'border-amber-200 bg-amber-50/60'
        : 'border-violet-200 bg-violet-50/60';

  return (
    <section
      className={`rounded-2xl border p-4 shadow-sm ${toneClasses}`}
    >
      <div className="mb-4">
        <span className="inline-flex rounded-full border border-white/70 bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-700 shadow-sm">
          {title}
        </span>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function ThreeColumnTaskLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="grid min-w-0 items-start gap-4 lg:grid-cols-3">
      {children}
    </div>
  );
}

function TaskColumn({
  step,
  title,
  helper,
  children,
}: {
  step: string;
  title: string;
  helper: string;
  children: ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-3 shadow-sm">
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs font-semibold text-white">{step}</span>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        </div>
        <p className="mt-1.5 text-xs leading-5 text-slate-500">{helper}</p>
      </div>
      <div className="flex min-w-0 flex-col gap-3">{children}</div>
    </section>
  );
}

function IntegratedSaveBar({
  error,
  buttonLabel,
  onSave,
}: {
  error: string;
  buttonLabel: string;
  onSave: () => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      {error ? (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      <div className="flex justify-end">
        <Button type="button" onClick={onSave} className="rounded-lg px-5">
          {buttonLabel}
        </Button>
      </div>
    </div>
  );
}

function MemoryPickerDialog({
  open,
  onOpenChange,
  memories,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memories: EditableMemoryRecord[];
  onSelect: (memory: EditableMemoryRecord) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Select a New Memory</DialogTitle>
          <DialogDescription>
            Choose a memory from the list below to replace the current selected memory.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
          {memories.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-500">No memories available.</p>
          ) : null}
          {memories.map((mem, index) => (
            <div
              key={String(mem.memory_id ?? index)}
              className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5"
            >
              <div className="min-w-0 space-y-1">
                <p className="truncate font-mono text-xs font-medium text-slate-700">
                  {String(mem.memory_id ?? `memory-${index + 1}`)}
                </p>
                <p className="line-clamp-2 text-xs text-slate-500">
                  {String(mem.value ?? '').slice(0, 150)}
                  {String(mem.value ?? '').length > 150 ? '…' : ''}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="shrink-0"
                onClick={() => {
                  onSelect(cloneMemoryRecord(mem));
                  onOpenChange(false);
                }}
              >
                Select
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function TaskSampleDisplay({
  loadedItem,
  evaluationMode,
  currentAnnotation,
  linkedTask1Annotation,
  onDraftChange,
  onSave,
}: TaskSampleDisplayProps) {
  const [translationEnabled, setTranslationEnabled] = useState(true);
  const [integratedAnnotation, setIntegratedAnnotation] = useState<AnySupportedAnnotation | undefined>(
    currentAnnotation,
  );
  const [integratedValidationError, setIntegratedValidationError] = useState('');
  const [activeTask1ModelIndex, setActiveTask1ModelIndex] = useState(0);
  const [activeTask4QueryIndex, setActiveTask4QueryIndex] = useState(0);
  const [task1CopyWarning, setTask1CopyWarning] = useState('');
  const [task3PickerOpen, setTask3PickerOpen] = useState(false);
  const [task3PendingMemory, setTask3PendingMemory] = useState<EditableMemoryRecord | null>(null);
  const [task4PickerOpen, setTask4PickerOpen] = useState(false);
  const [task4PendingMemory, setTask4PendingMemory] = useState<EditableMemoryRecord | null>(null);
  const [evidenceSelection, setEvidenceSelection] = useState<{
    memoryIndex: number;
    selectedIndices: Set<number>;
  } | null>(null);
  // Sync annotation state whenever the prop changes (draft saves, bundle imports).
  useEffect(() => {
    setIntegratedAnnotation(currentAnnotation);
  }, [loadedItem.itemPath, currentAnnotation]);

  // Reset UI carousel positions only when navigating to a different item.
  useEffect(() => {
    setIntegratedValidationError('');
    setTask1CopyWarning('');
    setActiveTask1ModelIndex(0);
    setActiveTask4QueryIndex(0);
    setEvidenceSelection(null);
    setTask3PickerOpen(false);
    setTask3PendingMemory(null);
    setTask4PickerOpen(false);
    setTask4PendingMemory(null);
  }, [loadedItem.itemPath]);

  const { entry, itemData } = loadedItem;
  const original = asDictionary(itemData.original);
  const modelOutput = asDictionary(itemData.model_output);
  const judgeOutput = asDictionary(itemData.judge_output_raw);
  const judgeOutputValue = itemData.judge_output_raw;
  const showJudgeArtifacts = entry.track !== 'Q2' || evaluationMode === 'judge_visible';
  const activeIntegratedAnnotation = integratedAnnotation ?? currentAnnotation;
  const linkedGoldMemories = getLinkedGoldMemories(linkedTask1Annotation);

  const updateIntegratedAnnotation = (annotation: AnySupportedAnnotation) => {
    setIntegratedAnnotation(annotation);
    setIntegratedValidationError('');
    onDraftChange?.(annotation);
  };

  const saveIntegratedAnnotation = (annotation: AnySupportedAnnotation, validationError: string | null) => {
    if (validationError) {
      setIntegratedValidationError(validationError);
      return;
    }

    const savedAnnotation = markSaved(annotation);
    setIntegratedAnnotation(savedAnnotation);
    setIntegratedValidationError('');
    onSave?.(savedAnnotation);
  };

  const renderTrackSpecificBlocks = () => {
    if (!original) {
      return (
        <JsonPreviewBlock
          title="Full Sample JSON"
          description="Normalized original data was not found for this sample."
          value={itemData}
        />
      );
    }

    if (entry.track === 'Q1' && entry.task === 'task1') {
      const probe = asDictionary(original.probe);
      const task1ModelGroups = getTask1ModelMemoryGroups(probe?.llm_outputs);
      const originalGoldMemories = getMemoryRecords(probe?.ground_truth_memories);
      const task1Annotation = createTask1Annotation(originalGoldMemories, activeIntegratedAnnotation);
      const clampedTask1ModelIndex =
        task1ModelGroups.length > 0 ? Math.min(activeTask1ModelIndex, task1ModelGroups.length - 1) : 0;
      const activeTask1ModelGroup = task1ModelGroups[clampedTask1ModelIndex] ?? null;

      return (
        <ThreeColumnTaskLayout>
          <TaskColumn
            step="1"
            title="Original Conversation"
            helper="Read the full conversation first, then decide which facts should become long-term memories."
          >
            <ConversationBlock
              title="Conversation"
              description="Source dialogue used to build the golden memory set."
              turns={normalizeConversation(probe?.dialogue)}
              translationEnabled={translationEnabled}
              evidenceMode={evidenceSelection !== null}
              selectedIndices={evidenceSelection?.selectedIndices}
              onTurnClick={(index) => {
                if (!evidenceSelection) return;
                const next = new Set(evidenceSelection.selectedIndices);
                if (next.has(index)) next.delete(index);
                else next.add(index);
                setEvidenceSelection({ ...evidenceSelection, selectedIndices: next });
              }}
            />
          </TaskColumn>
          <TaskColumn
            step="2"
            title="Golden Memories"
            helper="Edit the final golden memories directly here."
          >
            <StructuredMemoryEditor
              title="Golden Memory Editor"
              description="Keep the original taxonomy while updating each memory field directly."
              memories={task1Annotation.editableGoldMemories ?? []}
              displayMode="carousel"
              translationEnabled={translationEnabled}
              onActiveIndexChange={(nextIndex) => {
                if (evidenceSelection !== null && nextIndex !== evidenceSelection.memoryIndex) {
                  setEvidenceSelection(null);
                }
              }}
              onPickEvidence={(memoryIndex, currentIndices) =>
                setEvidenceSelection({ memoryIndex, selectedIndices: new Set(currentIndices) })
              }
              activeEvidenceMemoryIndex={evidenceSelection?.memoryIndex ?? null}
              onConfirmEvidence={(memoryIndex) => {
                if (!evidenceSelection) return;
                const turns = normalizeConversation(probe?.dialogue);
                const sortedIndices = Array.from(evidenceSelection.selectedIndices).sort((a, b) => a - b);
                const evidenceValue = sortedIndices.length > 0
                  ? { turn_indices: sortedIndices, turns: sortedIndices.map((i) => ({ index: i, role: turns[i]?.role ?? '', text: turns[i]?.text ?? '' })) }
                  : null;
                const memories = [...(task1Annotation.editableGoldMemories ?? [])];
                if (memories[memoryIndex]) {
                  memories[memoryIndex] = { ...memories[memoryIndex], evidence: evidenceValue };
                  updateIntegratedAnnotation(markDraft(task1Annotation, { editableGoldMemories: memories }));
                }
                setEvidenceSelection(null);
              }}
              onCancelEvidence={() => setEvidenceSelection(null)}
              onChange={(editableGoldMemories) =>
                updateIntegratedAnnotation(markDraft(task1Annotation, { editableGoldMemories }))
              }
            />
            <IntegratedSaveBar
              error={integratedValidationError}
              buttonLabel="Save Golden Memories"
              onSave={() =>
                saveIntegratedAnnotation(
                  task1Annotation,
                  validateMemoryRecords(task1Annotation.editableGoldMemories ?? []),
                )
              }
            />
          </TaskColumn>
          <TaskColumn
            step="3"
            title="Model Outputs"
            helper="Review one model at a time and use them only to check whether golden memories missed anything important."
          >
            {task1ModelGroups.length > 0 ? (
              <div className="space-y-4">
                {activeTask1ModelGroup ? (
                  <>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
                            Model Output
                          </p>
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {activeTask1ModelGroup.modelName}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setActiveTask1ModelIndex((index) => Math.max(index - 1, 0))}
                            disabled={clampedTask1ModelIndex === 0}
                          >
                            Previous
                          </Button>
                          <span className="text-xs text-slate-500">
                            {clampedTask1ModelIndex + 1} / {task1ModelGroups.length}
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setActiveTask1ModelIndex((index) => Math.min(index + 1, task1ModelGroups.length - 1))
                            }
                            disabled={clampedTask1ModelIndex >= task1ModelGroups.length - 1}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    </div>
                    <MemoryListBlock
                      key={activeTask1ModelGroup.modelName}
                      title={`Model Candidate Memories: ${activeTask1ModelGroup.modelName}`}
                      description="Click 'Add to Golden' on any memory to copy it into the golden set."
                      items={activeTask1ModelGroup.items}
                      displayMode="list"
                      searchable
                      translationEnabled={translationEnabled}
                      onCopyItem={(picked) => {
                        const current = task1Annotation.editableGoldMemories ?? [];
                        const normalizeValue = (v: unknown) =>
                          String(v ?? '').trim().toLowerCase();
                        const pickedValue = normalizeValue(picked.value);
                        const isDuplicate =
                          pickedValue.length > 0 &&
                          current.some((m) => normalizeValue(m.value) === pickedValue);
                        if (isDuplicate) {
                          setTask1CopyWarning('This memory is already in the golden set.');
                          setTimeout(() => setTask1CopyWarning(''), 3000);
                          return;
                        }
                        setTask1CopyWarning('');
                        const modelSlug = activeTask1ModelGroup.modelName
                          .replace(/[^a-z0-9]/gi, '_')
                          .replace(/_+/g, '_')
                          .replace(/^_|_$/g, '')
                          .toLowerCase();
                        const prefix = `${modelSlug}_p`;
                        const existingCount = current.filter((m) =>
                          String(m.memory_id ?? '').startsWith(prefix),
                        ).length;
                        const newId = `${prefix}${existingCount + 1}`;
                        const next = [...current, { ...cloneMemoryRecord(picked), memory_id: newId }];
                        updateIntegratedAnnotation(markDraft(task1Annotation, { editableGoldMemories: next }));
                      }}
                    />
                    {task1CopyWarning ? (
                      <p className="text-xs font-medium text-amber-600">{task1CopyWarning}</p>
                    ) : null}
                  </>
                ) : null}
              </div>
            ) : null}
          </TaskColumn>
        </ThreeColumnTaskLayout>
      );
    }

    if (entry.track === 'Q1' && entry.task === 'task2') {
      const record = asDictionary(original.record);
      const task2DisplayedMemories =
        linkedGoldMemories.length > 0
          ? linkedGoldMemories.map(cloneMemoryRecord)
          : getMemoryRecords(original.memory);
      // The seed for the "updated memories" editor is always the golden answer
      // (post-update state), regardless of whether Task1 has been annotated.
      // Task1 gold (linkedGoldMemories) shows the pre-update state in the display
      // panel above and must not overwrite the post-update seed here.
      const task2MemorySeed = getMemoryRecords(original.answer);
      const task2Annotation = createTask2Annotation(
        getNewDialogueSeeds(record?.new_dialogue),
        task2MemorySeed,
        activeIntegratedAnnotation,
        linkedGoldMemories,
      );

      return (
        <ThreeColumnTaskLayout>
          <TaskColumn
            step="1"
            title="New Conversation"
            helper="Read the new dialogue and decide whether it should update or add memories."
          >
            <ConversationBlock
              title="New Conversation"
              description="Dialogue that may trigger memory updates."
              turns={normalizeConversation(record?.new_dialogue)}
              translationEnabled={translationEnabled}
              evidenceMode={evidenceSelection !== null}
              selectedIndices={evidenceSelection?.selectedIndices}
              onTurnClick={(index) => {
                if (!evidenceSelection) return;
                const next = new Set(evidenceSelection.selectedIndices);
                if (next.has(index)) next.delete(index);
                else next.add(index);
                setEvidenceSelection({ ...evidenceSelection, selectedIndices: next });
              }}
            />
          </TaskColumn>
          <TaskColumn
            step="2"
            title="Existing Memories"
            helper="Review the current memories before deciding what to keep, revise, or add."
          >
            <MemoryListBlock
              title="Existing Memory Set"
              description="Current memories before applying the update."
              items={task2DisplayedMemories}
              displayMode="carousel"
              translationEnabled={translationEnabled}
            />
          </TaskColumn>
          <TaskColumn
            step="3"
            title="Updated Golden Memories"
            helper="Edit the final post-update memory records directly in this panel."
          >
            <StructuredMemoryEditor
              title="Updated Memory Editor"
              description="These fields will be saved back as the task2 golden answer."
              memories={task2Annotation.editableUpdatedMemories}
              displayMode="carousel"
              translationEnabled={translationEnabled}
              onActiveIndexChange={(nextIndex) => {
                if (evidenceSelection !== null && nextIndex !== evidenceSelection.memoryIndex) {
                  setEvidenceSelection(null);
                }
              }}
              onPickEvidence={(memoryIndex, currentIndices) =>
                setEvidenceSelection({ memoryIndex, selectedIndices: new Set(currentIndices) })
              }
              activeEvidenceMemoryIndex={evidenceSelection?.memoryIndex ?? null}
              onConfirmEvidence={(memoryIndex) => {
                if (!evidenceSelection) return;
                const turns = normalizeConversation(record?.new_dialogue);
                const sortedIndices = Array.from(evidenceSelection.selectedIndices).sort((a, b) => a - b);
                const evidenceValue = sortedIndices.length > 0
                  ? { turn_indices: sortedIndices, turns: sortedIndices.map((i) => ({ index: i, role: turns[i]?.role ?? '', text: turns[i]?.text ?? '' })) }
                  : null;
                const memories = [...task2Annotation.editableUpdatedMemories];
                if (memories[memoryIndex]) {
                  memories[memoryIndex] = { ...memories[memoryIndex], evidence: evidenceValue };
                  updateIntegratedAnnotation(markDraft(task2Annotation, { editableUpdatedMemories: memories }));
                }
                setEvidenceSelection(null);
              }}
              onCancelEvidence={() => setEvidenceSelection(null)}
              onChange={(editableUpdatedMemories) =>
                updateIntegratedAnnotation(markDraft(task2Annotation, { editableUpdatedMemories }))
              }
            />
            <IntegratedSaveBar
              error={integratedValidationError}
              buttonLabel="Save Updated Memories"
              onSave={() =>
                saveIntegratedAnnotation(
                  task2Annotation,
                  validateMemoryRecords(task2Annotation.editableUpdatedMemories),
                )
              }
            />
          </TaskColumn>
        </ThreeColumnTaskLayout>
      );
    }

    if (entry.track === 'Q1' && entry.task === 'task3') {
      const task3CandidateMemories = getMemoryRecords(original.candidate_memories);
      const task3SelectedMemorySeed = syncSelectedMemoryWithGold(
        getSelectedMemoryRecord(original.selected_memory),
        linkedGoldMemories,
      );
      const task3Annotation = createTask3Annotation(
        asString(original.query) ?? '',
        task3SelectedMemorySeed,
        activeIntegratedAnnotation,
        linkedGoldMemories,
      );
      const validateTask3 = () => {
        if (!task3Annotation.queryText.trim()) {
          return 'Query cannot be empty.';
        }

        return task3Annotation.editableSelectedMemory
          ? validateMemoryRecords([task3Annotation.editableSelectedMemory])
          : null;
      };
      const originalTask3Query = asString(original.query) ?? '';
      const isDefaultTask3Query = task3Annotation.queryText === originalTask3Query;
      const defaultTask3MemoryId = task3SelectedMemorySeed?.memory_id;
      const isDefaultTask3Memory =
        !!defaultTask3MemoryId &&
        task3Annotation.editableSelectedMemory?.memory_id === defaultTask3MemoryId;
      const task3PickerMemories =
        linkedGoldMemories.length > 0 ? linkedGoldMemories : task3CandidateMemories;

      return (
        <>
        <ThreeColumnTaskLayout>
          <TaskColumn
            step="1"
            title="Golden Query"
            helper="Edit the final query directly in this panel."
          >
            <div className="space-y-2">
              {isDefaultTask3Query ? (
                <div className="flex items-center gap-2 px-1">
                  <Badge variant="outline" className="border-slate-300 bg-slate-100 text-slate-500 text-[10px]">
                    default
                  </Badge>
                  <span className="text-xs text-slate-400">Query unchanged from original</span>
                </div>
              ) : null}
              <TextAreaField
                label="Golden Query"
                value={task3Annotation.queryText}
                onChange={(queryText) => updateIntegratedAnnotation(markDraft(task3Annotation, { queryText }))}
                placeholder="Enter the final query to keep."
                translationEnabled={translationEnabled}
              />
            </div>
          </TaskColumn>
          <TaskColumn
            step="2"
            title="Candidate Memories"
            helper="Review candidate memories one by one and decide which one best supports the query."
          >
            <MemoryListBlock
              title="Candidate Memory Pool"
              description="Candidate memories used to verify the query-memory match."
              items={task3CandidateMemories}
              displayMode="carousel"
              searchable
              translationEnabled={translationEnabled}
            />
          </TaskColumn>
          <TaskColumn
            step="3"
            title="Selected Memory"
            helper="Edit the final selected memory directly here, or swap it using Change Memory."
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {isDefaultTask3Memory ? (
                  <Badge variant="outline" className="border-slate-300 bg-slate-100 text-slate-500 text-[10px]">
                    default
                  </Badge>
                ) : null}
                <span className="text-xs text-slate-500">
                  {task3Annotation.editableSelectedMemory?.memory_id ?? 'No memory selected'}
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setTask3PickerOpen(true)}
              >
                Change Memory
              </Button>
            </div>
            {task3Annotation.editableSelectedMemory ? (
              <StructuredMemoryEditor
                title="Selected Memory Editor"
                description="Preserve the selected memory structure while editing its fields."
                memories={[task3Annotation.editableSelectedMemory]}
                displayMode="carousel"
                translationEnabled={translationEnabled}
                onChange={(nextMemories) =>
                  updateIntegratedAnnotation(
                    markDraft(task3Annotation, { editableSelectedMemory: nextMemories[0] ?? null }),
                  )
                }
                addButtonLabel="Restore Selected Memory"
              />
            ) : null}
            <IntegratedSaveBar
              error={integratedValidationError}
              buttonLabel="Save Query And Selected Memory"
              onSave={() => saveIntegratedAnnotation(task3Annotation, validateTask3())}
            />
          </TaskColumn>
        </ThreeColumnTaskLayout>
        <MemoryPickerDialog
          open={task3PickerOpen}
          onOpenChange={setTask3PickerOpen}
          memories={task3PickerMemories}
          onSelect={(picked) => setTask3PendingMemory(picked)}
        />
        <AlertDialog
          open={task3PendingMemory !== null}
          onOpenChange={(open) => { if (!open) setTask3PendingMemory(null); }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Update Selected Memory</AlertDialogTitle>
              <AlertDialogDescription>
                You selected memory{' '}
                <span className="font-mono font-semibold text-slate-800">
                  {task3PendingMemory?.memory_id}
                </span>
                . What should happen to the current query?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setTask3PendingMemory(null)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (task3PendingMemory) {
                    updateIntegratedAnnotation(
                      markDraft(task3Annotation, { editableSelectedMemory: task3PendingMemory }),
                    );
                  }
                  setTask3PendingMemory(null);
                }}
              >
                Keep Query
              </AlertDialogAction>
              <AlertDialogAction
                className={buttonVariants({ variant: 'destructive' })}
                onClick={() => {
                  if (task3PendingMemory) {
                    updateIntegratedAnnotation(
                      markDraft(task3Annotation, {
                        editableSelectedMemory: task3PendingMemory,
                        queryText: '',
                      }),
                    );
                  }
                  setTask3PendingMemory(null);
                }}
              >
                Clear Query
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        </>
      );
    }

    if (entry.track === 'Q1' && entry.task === 'task4') {
      const querySeeds = buildTask4QuerySeeds(original).map((seed) => ({
        ...seed,
        selectedMemorySeed: syncSelectedMemoryWithGold(seed.selectedMemorySeed, linkedGoldMemories),
      }));
      const selectedMemorySeed = syncSelectedMemoryWithGold(
        getTask4SelectedMemoryRecord(original),
        linkedGoldMemories,
      );
      const task4Annotation = createTask4Annotation(
        querySeeds,
        selectedMemorySeed,
        entry.ability,
        activeIntegratedAnnotation,
        linkedGoldMemories,
      );
      const candidateMemories =
        linkedGoldMemories.length > 0
          ? linkedGoldMemories.map(cloneMemoryRecord)
          : getMemoryRecords(original.extracted_memory);
      const clampedTask4QueryIndex =
        task4Annotation.subAnnotations.length > 0
          ? Math.min(activeTask4QueryIndex, task4Annotation.subAnnotations.length - 1)
          : 0;
      const activeTask4SubAnnotation = task4Annotation.subAnnotations[clampedTask4QueryIndex] ?? null;
      // Per-query selected memory — driven by whichever query is active in col3.
      const activeQueryMemory = activeTask4SubAnnotation?.editableSelectedMemory ?? null;
      const selectedMemoryItems = activeQueryMemory ? [activeQueryMemory] : [];
      const selectedMemoryIds = new Set(
        task4Annotation.subAnnotations
          .map((item) => asString(item.editableSelectedMemory?.memory_id))
          .filter(Boolean) as string[],
      );
      const otherCandidateMemories = candidateMemories.filter(
        (memory) => !selectedMemoryIds.has(String(memory.memory_id ?? '')),
      );
      const activeQuerySeed =
        querySeeds.find((s) => s.queryId === activeTask4SubAnnotation?.queryId) ?? null;
      const defaultTask4MemoryId = activeQuerySeed?.selectedMemorySeed?.memory_id;
      const isDefaultTask4Memory =
        !!defaultTask4MemoryId &&
        activeTask4SubAnnotation?.editableSelectedMemory?.memory_id === defaultTask4MemoryId;
      const task4PickerMemories =
        linkedGoldMemories.length > 0 ? linkedGoldMemories : candidateMemories;
      const updateTask4SubAnnotation = (
        queryId: string,
        patch: Partial<Q1Task4SubAnnotation>,
      ) => {
        updateIntegratedAnnotation(
          markDraft(task4Annotation, {
            subAnnotations: task4Annotation.subAnnotations.map((item) =>
              item.queryId === queryId ? { ...item, ...patch } : item,
            ),
          }),
        );
      };
      const validateTask4 = () => {
        if (task4Annotation.subAnnotations.length === 0) {
          return 'At least one ability query is required.';
        }

        const emptyQuery = task4Annotation.subAnnotations.find((item) => !item.queryText.trim());
        if (emptyQuery) {
          return `Query ${emptyQuery.queryId} cannot be empty.`;
        }

        for (const item of task4Annotation.subAnnotations) {
          const memErr = validateTask4SelectedMemoryRecord(item.editableSelectedMemory ?? null);
          if (memErr) {
            return `Query ${item.queryId}: ${memErr}`;
          }
        }

        const incompleteVerdict = task4Annotation.subAnnotations.find((item) => !item.overallVerdict);
        if (incompleteVerdict) {
          return `Query ${incompleteVerdict.queryId} requires an overall verdict.`;
        }

        const needsDetail = task4Annotation.subAnnotations.find(
          (item) =>
            item.overallVerdict !== 'reasonable' &&
            item.issueTypes.length === 0 &&
            !item.revisionSuggestion.trim(),
        );
        if (needsDetail) {
          return `Query ${needsDetail.queryId} needs issue types or a revision suggestion when it is not fully reasonable.`;
        }

        return null;
      };

      return (
        <>
        <ThreeColumnTaskLayout>
          <TaskColumn
            step="1"
            title="Conversation Evidence"
            helper="Read the dialogue and confirm whether the selected memory is actually supported."
          >
            <ConversationBlock
              title="Conversation Context"
              turns={normalizeConversation(original.conversation)}
              translationEnabled={translationEnabled}
            />
          </TaskColumn>
          <TaskColumn
            step="2"
            title="Selected Memory"
            helper="Check whether the selected memory is the right support for the current ability queries."
          >
            {activeTask4SubAnnotation ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="text-xs font-medium text-slate-500 shrink-0">
                      Query
                    </p>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setActiveTask4QueryIndex((i) => Math.max(i - 1, 0))}
                        disabled={clampedTask4QueryIndex === 0}
                        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        ‹
                      </button>
                      <span className="min-w-[36px] text-center text-xs tabular-nums text-slate-500">
                        {clampedTask4QueryIndex + 1}/{task4Annotation.subAnnotations.length}
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveTask4QueryIndex((i) => Math.min(i + 1, task4Annotation.subAnnotations.length - 1))}
                        disabled={clampedTask4QueryIndex >= task4Annotation.subAnnotations.length - 1}
                        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        ›
                      </button>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => setTask4PickerOpen(true)}
                  >
                    Change Memory
                  </Button>
                </div>
                <div className="flex items-center gap-2 px-1">
                  {isDefaultTask4Memory ? (
                    <Badge variant="outline" className="border-slate-300 bg-slate-100 text-slate-500 text-[10px]">
                      default
                    </Badge>
                  ) : null}
                  <span className="text-xs text-slate-400 truncate">
                    {activeTask4SubAnnotation.editableSelectedMemory?.memory_id ?? 'No memory selected'}
                  </span>
                </div>
              </div>
            ) : null}
            <StructuredMemoryEditor
              title="Selected Memory Editor"
              description={
                activeTask4SubAnnotation
                  ? `Memory for query ${clampedTask4QueryIndex + 1} / ${task4Annotation.subAnnotations.length}. Navigate queries to edit each one's memory.`
                  : 'No queries available. Add a selected memory if needed.'
              }
              memories={selectedMemoryItems}
              displayMode="carousel"
              translationEnabled={translationEnabled}
              onChange={(nextMemories) => {
                if (activeTask4SubAnnotation) {
                  updateIntegratedAnnotation(
                    markDraft(task4Annotation, {
                      editableSelectedMemory: nextMemories[0] ?? task4Annotation.editableSelectedMemory,
                      subAnnotations: task4Annotation.subAnnotations.map((item) =>
                        item.queryId === activeTask4SubAnnotation.queryId
                          ? { ...item, editableSelectedMemory: nextMemories[0] ?? null }
                          : item,
                      ),
                    }),
                  );
                }
              }}
              addButtonLabel="Restore Selected Memory"
            />
            <MemoryListBlock
              title="Other Candidate Memories"
              description="Review other candidate memories without leaving this column."
              items={otherCandidateMemories}
              displayMode="carousel"
              searchable
              collapsible
              collapsedByDefault
              translationEnabled={translationEnabled}
            />
          </TaskColumn>
          <TaskColumn
            step="3"
            title="Ability Queries"
            helper="Review and edit one query at a time while keeping the conversation and selected memory visible."
          >
            <div className="space-y-4">
              {activeTask4SubAnnotation ? (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
                      Ability Query
                    </p>
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {activeTask4SubAnnotation.queryId}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveTask4QueryIndex((index) => Math.max(index - 1, 0))}
                      disabled={clampedTask4QueryIndex === 0}
                    >
                      Previous
                    </Button>
                    <span className="text-xs text-slate-500">
                      {clampedTask4QueryIndex + 1} / {task4Annotation.subAnnotations.length}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setActiveTask4QueryIndex((index) =>
                          Math.min(index + 1, task4Annotation.subAnnotations.length - 1),
                        )
                      }
                      disabled={clampedTask4QueryIndex >= task4Annotation.subAnnotations.length - 1}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              ) : null}
              {task4Annotation.subAnnotations
                .slice(clampedTask4QueryIndex, clampedTask4QueryIndex + 1)
                .map((item) => (
                  <div
                    key={item.queryId}
                    className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white">
                        Query {clampedTask4QueryIndex + 1}
                      </span>
                      <span className="text-xs text-slate-500">{item.queryId}</span>
                      {entry.ability ? (
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600">
                          {entry.ability}
                        </span>
                      ) : null}
                      {item.queryText === (querySeeds.find((s) => s.queryId === item.queryId)?.queryText ?? '') ? (
                        <Badge variant="outline" className="border-slate-300 bg-slate-100 text-slate-500 text-[10px]">
                          default
                        </Badge>
                      ) : null}
                    </div>
                    <TextAreaField
                      label="Ability Query"
                      value={item.queryText}
                      onChange={(queryText) => updateTask4SubAnnotation(item.queryId, { queryText })}
                      placeholder="Enter the final ability query to keep."
                      translationEnabled={translationEnabled}
                    />
                    <RadioField
                      label="Overall Verdict"
                      value={item.overallVerdict}
                      options={TASK4_VERDICT_OPTIONS}
                      onChange={(overallVerdict) =>
                        updateTask4SubAnnotation(item.queryId, {
                          overallVerdict: overallVerdict as Q1Task4SubAnnotation['overallVerdict'],
                        })
                      }
                    />
                    <RadioField
                      label="Tests Target Ability"
                      value={item.testsTargetAbility}
                      options={TASK4_TERNARY_OPTIONS}
                      onChange={(testsTargetAbility) =>
                        updateTask4SubAnnotation(item.queryId, {
                          testsTargetAbility: testsTargetAbility as Q1Task4SubAnnotation['testsTargetAbility'],
                        })
                      }
                    />
                    <RadioField
                      label="Selected Memory Dependency"
                      value={item.memoryDependency}
                      options={TASK4_DEPENDENCY_OPTIONS}
                      onChange={(memoryDependency) =>
                        updateTask4SubAnnotation(item.queryId, {
                          memoryDependency: memoryDependency as Q1Task4SubAnnotation['memoryDependency'],
                        })
                      }
                    />
                    <RadioField
                      label="Ability Purity"
                      value={item.abilityPurity}
                      options={TASK4_PURITY_OPTIONS}
                      onChange={(abilityPurity) =>
                        updateTask4SubAnnotation(item.queryId, {
                          abilityPurity: abilityPurity as Q1Task4SubAnnotation['abilityPurity'],
                        })
                      }
                    />
                    <CheckboxField
                      label="Issue Types"
                      values={item.issueTypes}
                      options={TASK4_ISSUE_TYPE_OPTIONS}
                      onChange={(issueTypes) => updateTask4SubAnnotation(item.queryId, { issueTypes })}
                    />
                    <TextAreaField
                      label="Evidence Note"
                      value={item.evidenceNote}
                      onChange={(evidenceNote) => updateTask4SubAnnotation(item.queryId, { evidenceNote })}
                      placeholder="Explain how the conversation and selected memory support or fail to support this query."
                    />
                    <TextAreaField
                      label="Revision Suggestion"
                      value={item.revisionSuggestion}
                      onChange={(revisionSuggestion) =>
                        updateTask4SubAnnotation(item.queryId, { revisionSuggestion })
                      }
                      placeholder="If the query is not appropriate, write the suggested revision here."
                    />
                  </div>
                ))}
              <TextAreaField
                label="Sample Note"
                value={task4Annotation.annotatorNote ?? ''}
                onChange={(annotatorNote) =>
                  updateIntegratedAnnotation(markDraft(task4Annotation, { annotatorNote }))
                }
                placeholder="Optional note for the full session."
              />
              <IntegratedSaveBar
                error={integratedValidationError}
                buttonLabel="Save Task4 Annotation"
                onSave={() => saveIntegratedAnnotation(task4Annotation, validateTask4())}
              />
            </div>
          </TaskColumn>
        </ThreeColumnTaskLayout>
        <MemoryPickerDialog
          open={task4PickerOpen}
          onOpenChange={setTask4PickerOpen}
          memories={task4PickerMemories}
          onSelect={(picked) => setTask4PendingMemory(picked)}
        />
        <AlertDialog
          open={task4PendingMemory !== null}
          onOpenChange={(open) => { if (!open) setTask4PendingMemory(null); }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Update Selected Memory</AlertDialogTitle>
              <AlertDialogDescription>
                You selected memory{' '}
                <span className="font-mono font-semibold text-slate-800">
                  {task4PendingMemory?.memory_id}
                </span>
                {activeTask4SubAnnotation ? (
                  <> for query <span className="font-mono font-semibold text-slate-800">{activeTask4SubAnnotation.queryId}</span></>
                ) : null}
                . What should happen to the current query text?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setTask4PendingMemory(null)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (task4PendingMemory && activeTask4SubAnnotation) {
                    updateIntegratedAnnotation(
                      markDraft(task4Annotation, {
                        editableSelectedMemory: task4PendingMemory,
                        subAnnotations: task4Annotation.subAnnotations.map((item) =>
                          item.queryId === activeTask4SubAnnotation.queryId
                            ? { ...item, editableSelectedMemory: task4PendingMemory }
                            : item,
                        ),
                      }),
                    );
                  }
                  setTask4PendingMemory(null);
                }}
              >
                Keep Query
              </AlertDialogAction>
              <AlertDialogAction
                className={buttonVariants({ variant: 'destructive' })}
                onClick={() => {
                  if (task4PendingMemory && activeTask4SubAnnotation) {
                    updateIntegratedAnnotation(
                      markDraft(task4Annotation, {
                        editableSelectedMemory: task4PendingMemory,
                        subAnnotations: task4Annotation.subAnnotations.map((item) =>
                          item.queryId === activeTask4SubAnnotation.queryId
                            ? { ...item, editableSelectedMemory: task4PendingMemory, queryText: '' }
                            : item,
                        ),
                      }),
                    );
                  }
                  setTask4PendingMemory(null);
                }}
              >
                Clear Query
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        </>
      );
    }
    if (entry.track === 'Q2' && entry.task === 'task1') {
      const probe = asDictionary(original.probe);
      const judgeScoreItems = [
        typeof itemData.judge_score === 'number'
          ? { label: 'Judge Score', text: String(itemData.judge_score) }
          : null,
        typeof itemData.final_score === 'number'
          ? { label: 'Final Score', text: String(itemData.final_score) }
          : null,
      ].filter(Boolean) as Array<{ label?: string; text: string }>;

      return (
        <>
          <DisplaySection title="Input Context" tone="input">
            <ConversationBlock
              title="Conversation"
              description="Conversation provided to the extraction model and the reviewer."
              turns={normalizeConversation(probe?.dialogue)}
              translationEnabled={translationEnabled}
            />
            <MemoryListBlock
              title="Golden Memories"
              description="Reference memories for this extraction sample."
              items={getMemoryRecords(probe?.ground_truth_memories)}
              translationEnabled={translationEnabled}
            />
          </DisplaySection>
          <DisplaySection title="Outputs To Review" tone="output">
            {modelOutput ? <JsonPreviewBlock title="Model Output" value={modelOutput} /> : null}
            {showJudgeArtifacts && typeof judgeOutputValue !== 'undefined' ? (
              <JsonPreviewBlock title="Judge Output" value={judgeOutputValue} />
            ) : null}
            {judgeScoreItems.length > 0 ? (
              <TextBlock title="Scores" items={judgeScoreItems} translationEnabled={translationEnabled} />
            ) : null}
          </DisplaySection>
        </>
      );
    }

    if (entry.track === 'Q2' && entry.task === 'task2') {
      const record = asDictionary(original.record);
      const judgeScoreItems = [
        typeof itemData.judge_score === 'number'
          ? { label: 'Judge Score', text: String(itemData.judge_score) }
          : null,
        typeof itemData.final_score === 'number'
          ? { label: 'Final Score', text: String(itemData.final_score) }
          : null,
      ].filter(Boolean) as Array<{ label?: string; text: string }>;

      return (
        <>
          <DisplaySection title="Input Context" tone="input">
            <MemoryListBlock
              title="Existing Memories"
              description="Memory state before the update."
              items={asArray(original.memory)}
              translationEnabled={translationEnabled}
            />
            <ConversationBlock
              title="New Conversation"
              description="Dialogue used to judge whether the update is reasonable."
              turns={normalizeConversation(record?.new_dialogue)}
              translationEnabled={translationEnabled}
            />
            <MemoryListBlock
              title="Reference Updated Memories"
              description="Reference updated memories when available."
              items={getMemoryRecords(original.answer)}
              translationEnabled={translationEnabled}
            />
          </DisplaySection>
          <DisplaySection title="Outputs To Review" tone="output">
            {modelOutput ? <JsonPreviewBlock title="Model Output" value={modelOutput} /> : null}
            {showJudgeArtifacts && typeof judgeOutputValue !== 'undefined' ? (
              <JsonPreviewBlock title="Judge Output" value={judgeOutputValue} />
            ) : null}
            {judgeScoreItems.length > 0 ? (
              <TextBlock title="Scores" items={judgeScoreItems} translationEnabled={translationEnabled} />
            ) : null}
          </DisplaySection>
        </>
      );
    }

    if (entry.track === 'Q2' && entry.task === 'task3') {
      const selectedMemory = getSelectedMemoryRecord(original.selected_memory);
      const selectedMemoryItems = selectedMemory ? [selectedMemory] : [];
      const queryText = asString(original.query);
      const task3ModelItems = getTask3ModelTextItems(modelOutput);

      return (
        <>
          <DisplaySection title="Input Context" tone="input">
            {queryText ? (
              <TextBlock
                title="Query"
                items={[{ text: queryText }]}
                translationEnabled={translationEnabled}
              />
            ) : null}
            {selectedMemoryItems.length > 0 ? (
              <MemoryListBlock
                title="Selected Memory"
                description="Memory chosen for this query."
                items={selectedMemoryItems}
                translationEnabled={translationEnabled}
              />
            ) : null}
          </DisplaySection>
          <DisplaySection title="Outputs To Review" tone="output">
            {task3ModelItems.length > 0 ? (
              <TextBlock
                title="Model Responses"
                items={task3ModelItems}
                translationEnabled={translationEnabled}
              />
            ) : modelOutput ? (
              <JsonPreviewBlock title="Model Output" value={modelOutput} />
            ) : null}
            {showJudgeArtifacts && typeof judgeOutputValue !== 'undefined' ? (
              <JsonPreviewBlock title="Judge Output" value={judgeOutputValue} />
            ) : null}
          </DisplaySection>
        </>
      );
    }

    if (entry.track === 'Q2' && entry.task === 'task4') {
      const queryItems = asArray(original.queries)
        .map((item, index) => {
          const record = asDictionary(item);
          const text = record ? asString(record.query) : null;
          if (!text) {
            return null;
          }

          return {
            label: asString(record.query_id) ?? `query-${index + 1}`,
            text,
          };
        })
        .filter(Boolean) as Array<{ label?: string; text: string }>;

      return (
        <>
          <DisplaySection title="Input Context" tone="input">
            <MemoryListBlock
              title="Extracted Memories"
              items={asArray(original.extracted_memory)}
              translationEnabled={translationEnabled}
            />
            <ConversationBlock
              title="Conversation Context"
              turns={normalizeConversation(original.conversation)}
              translationEnabled={translationEnabled}
            />
          </DisplaySection>
          <DisplaySection title="Outputs To Review" tone="output">
            <TextBlock title="Ability Queries" items={queryItems} translationEnabled={translationEnabled} />
            {getResponseItems(modelOutput).length > 0 ? (
              <TextBlock
                title="Model Responses"
                items={getResponseItems(modelOutput)}
                translationEnabled={translationEnabled}
              />
            ) : modelOutput ? (
              <JsonPreviewBlock title="Model Output" value={modelOutput} />
            ) : null}
          </DisplaySection>
          {showJudgeArtifacts && typeof judgeOutputValue !== 'undefined' ? (
            <DisplaySection title="Judge Visible Output" tone="judge">
              <JsonPreviewBlock title="Judge Output" value={judgeOutputValue} />
              {typeof itemData.judge_score !== 'undefined' ? (
                <JsonPreviewBlock title="Judge Score Summary" value={itemData.judge_score} />
              ) : null}
            </DisplaySection>
          ) : null}
        </>
      );
    }

    return (
      <>
        <JsonPreviewBlock title="Original Sample Data" value={original} />
        {modelOutput ? <JsonPreviewBlock title="Model Output" value={modelOutput} /> : null}
        {showJudgeArtifacts && typeof judgeOutputValue !== 'undefined' ? (
          <JsonPreviewBlock title="Judge Output" value={judgeOutputValue} />
        ) : null}
      </>
    );
  };

  return (
    <div className="space-y-4">
      {/* Slim top bar — translation toggle only */}
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
        <span className="text-sm font-semibold text-slate-700">样本展示</span>
        <Button
          type="button"
          variant={translationEnabled ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTranslationEnabled((current) => !current)}
          className="gap-1.5 rounded-lg"
        >
          <Languages className="h-4 w-4" />
          {translationEnabled ? 'Translation On' : 'Translation Off'}
        </Button>
      </div>
      {renderTrackSpecificBlocks()}
    </div>
  );
}

