import { useEffect, useState, type ReactNode } from 'react';
import { Languages } from 'lucide-react';

import { Button } from '../../../components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../components/ui/card';
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
        label: asString(record.query_id) ?? `回答 ${index + 1}`,
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
          label: `${asString(record.gold_id) ?? '金标准'} -> ${asString(record.pred_id) ?? '预测'} | ${
            record.ok === true ? '一致' : '不一致'
          } | 严重度 ${typeof record.severity === 'number' ? record.severity : '?'}`,
          text: rationale,
        };
      }

      if (reviewKind === 'missing_reviews') {
        return {
          label: `${asString(record.id) ?? `缺失-${index + 1}`} | 应抽取 ${
            record.should_have_extracted === true ? '是' : '否'
          } | 严重度 ${typeof record.severity === 'number' ? record.severity : '?'}`,
          text: rationale,
        };
      }

      return {
        label: `${asString(record.id) ?? `多余-${index + 1}`} | 幻觉 ${
          record.hallucinated === true ? '是' : '否'
        } | 严重度 ${typeof record.severity === 'number' ? record.severity : '?'}`,
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
    items.push({ label: '回答', text: answerText });
  }

  const reasonText = formatPossiblyStructuredString(parsedResponse?.reason);
  if (reasonText) {
    items.push({ label: '原因', text: reasonText });
  }

  const selectedMemoryId = asString(parsedResponse?.selected_memory_id);
  if (selectedMemoryId) {
    items.push({ label: '选中记忆 ID', text: selectedMemoryId });
  }

  const rawOutput = formatPossiblyStructuredString(modelOutput.raw_output);
  if (items.length === 0 && rawOutput) {
    items.push({ label: '模型原始输出', text: rawOutput });
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
  if (existing?.formType === 'Q1:task1' && existing.editableGoldMemories?.length) {
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

function createTask2Annotation(
  newDialogueSeed: Array<{ turnId: string; role: string; text: string }>,
  updatedMemorySeed: EditableMemoryRecord[],
  existing?: AnySupportedAnnotation,
): Q1Task2Annotation {
  if (existing?.formType === 'Q1:task2' && existing.editableUpdatedMemories.length) {
    return existing;
  }

  return {
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
}

function createTask3Annotation(
  querySeed: string,
  selectedMemorySeed: EditableMemoryRecord | null,
  existing?: AnySupportedAnnotation,
): Q1Task3Annotation {
  if (existing?.formType === 'Q1:task3') {
    return {
      ...existing,
      queryText: existing.queryText || querySeed,
      editableSelectedMemory:
        existing.editableSelectedMemory ?? (selectedMemorySeed ? cloneMemoryRecord(selectedMemorySeed) : null),
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
  { value: 'reasonable', label: '合理' },
  { value: 'partially_reasonable', label: '部分合理' },
  { value: 'unreasonable', label: '不合理' },
];

const TASK4_TERNARY_OPTIONS = [
  { value: 'yes', label: '是' },
  { value: 'partial', label: '部分' },
  { value: 'no', label: '否' },
];

const TASK4_DEPENDENCY_OPTIONS = [
  { value: 'strong', label: '强' },
  { value: 'medium', label: '中' },
  { value: 'weak', label: '弱' },
];

const TASK4_PURITY_OPTIONS = [
  { value: 'high', label: '高' },
  { value: 'medium', label: '中' },
  { value: 'low', label: '低' },
];

const TASK4_ISSUE_TYPE_OPTIONS = [
  { value: 'ability_mismatch', label: '能力不匹配' },
  { value: 'memory_not_required', label: '记忆非必需' },
  { value: 'selected_memory_wrong', label: '选中记忆不合适' },
  { value: 'query_unclear', label: '查询不清楚' },
  { value: 'leakage', label: '信息泄漏' },
  { value: 'other', label: '其他' },
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
): Q1Task4Annotation {
  const existingTask4 = existing?.formType === 'Q1:task4' ? existing : null;
  const existingById = new Map(existingTask4?.subAnnotations.map((item) => [item.queryId, item]) ?? []);

  return {
    formType: 'Q1:task4',
    status: existingTask4?.status ?? 'draft',
    updatedAt: existingTask4?.updatedAt ?? '',
    ability,
    editableSelectedMemory:
      existingTask4?.editableSelectedMemory ?? (selectedMemorySeed ? cloneMemoryRecord(selectedMemorySeed) : null),
    subAnnotations: querySeeds.map((seed) => {
      const existingItem = existingById.get(seed.queryId);
      return existingItem
        ? {
            ...existingItem,
            queryText: existingItem.queryText || seed.queryText,
            ability: existingItem.ability ?? seed.ability,
            task4RecordIndex: existingItem.task4RecordIndex ?? seed.task4RecordIndex,
            editableSelectedMemory:
              existingItem.editableSelectedMemory ??
              (seed.selectedMemorySeed ? cloneMemoryRecord(seed.selectedMemorySeed) : null),
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
    return 'Selected Memory 不能为空。';
  }

  if (!String(record.value ?? '').trim()) {
    return 'Selected Memory 的 value 不能为空。';
  }

  if (typeof record.evidence === 'string') {
    return 'Selected Memory 的 evidence 必须是 JSON object/null，不能是普通字符串。';
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
      className={`rounded-3xl border p-6 shadow-md ring-1 ring-black/[0.05] sm:p-7 ${toneClasses}`}
    >
      <div className="mb-6">
        <span className="inline-flex rounded-full border border-white/70 bg-white/95 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700 shadow-sm">
          {title}
        </span>
      </div>
      <div className="space-y-6">{children}</div>
    </section>
  );
}

function ThreeColumnTaskLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-3">
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
    <section className="min-w-0 rounded-3xl border border-slate-200 bg-slate-50/80 p-3 shadow-sm ring-1 ring-black/[0.03]">
      <div className="mb-3 rounded-2xl border border-white/80 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white">{step}</span>
          <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
        </div>
        <p className="mt-2 text-xs leading-5 text-slate-600">{helper}</p>
      </div>
      <div className="min-w-0 space-y-3">{children}</div>
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
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      {error ? (
        <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}
      <div className="flex justify-end">
        <Button type="button" onClick={onSave} className="rounded-xl px-6 shadow-sm">
          {buttonLabel}
        </Button>
      </div>
    </div>
  );
}

export function TaskSampleDisplay({
  loadedItem,
  evaluationMode,
  currentAnnotation,
  onDraftChange,
  onSave,
}: TaskSampleDisplayProps) {
  const [translationEnabled, setTranslationEnabled] = useState(false);
  const [integratedAnnotation, setIntegratedAnnotation] = useState<AnySupportedAnnotation | undefined>(
    currentAnnotation,
  );
  const [integratedValidationError, setIntegratedValidationError] = useState('');

  useEffect(() => {
    setIntegratedAnnotation(currentAnnotation);
    setIntegratedValidationError('');
  }, [loadedItem.itemPath, currentAnnotation]);

  const { entry, itemData } = loadedItem;
  const original = asDictionary(itemData.original);
  const modelOutput = asDictionary(itemData.model_output);
  const judgeOutput = asDictionary(itemData.judge_output_raw);
  const judgeOutputValue = itemData.judge_output_raw;
  const showJudgeArtifacts = entry.track !== 'Q2' || evaluationMode === 'judge_visible';
  const activeIntegratedAnnotation = integratedAnnotation ?? currentAnnotation;

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
          title="完整样本 JSON"
          description="未找到规范化后的原始数据。"
          value={itemData}
        />
      );
    }

    if (entry.track === 'Q1' && entry.task === 'task1') {
      const probe = asDictionary(original.probe);
      const task1ModelGroups = getTask1ModelMemoryGroups(probe?.llm_outputs);
      const originalGoldMemories = getMemoryRecords(probe?.ground_truth_memories);
      const task1Annotation = createTask1Annotation(originalGoldMemories, activeIntegratedAnnotation);
      return (
        <ThreeColumnTaskLayout>
          <TaskColumn step="1" title="原对话" helper="先读完整对话，判断哪些内容应该形成长期记忆。">
            <ConversationBlock
              title="对话"
              description="用于构建基准记忆的原始对话。"
              turns={normalizeConversation(probe?.dialogue)}
              translationEnabled={translationEnabled}
            />
          </TaskColumn>
          <TaskColumn step="2" title="编辑 Golden Memory" helper="在这里直接改最终要保存的 memory 字段，不需要去下面找表单。">
            <StructuredMemoryEditor
              title="Golden Memory 字段编辑"
              description="保留原始 taxonomy；每条 memory 的每个字段都可以直接修改。"
              memories={task1Annotation.editableGoldMemories ?? []}
              translationEnabled={translationEnabled}
              onChange={(editableGoldMemories) =>
                updateIntegratedAnnotation(markDraft(task1Annotation, { editableGoldMemories }))
              }
            />
            <IntegratedSaveBar
              error={integratedValidationError}
              buttonLabel="保存 Golden Memory"
              onSave={() =>
                saveIntegratedAnnotation(
                  task1Annotation,
                  validateMemoryRecords(task1Annotation.editableGoldMemories ?? []),
                )
              }
            />
          </TaskColumn>
          <TaskColumn step="3" title="多模型抽取结果" helper="横向看各模型抽取的 memory，把 golden 中遗漏的重要记忆补上。">
            {task1ModelGroups.length > 0 ? (
              <div className="space-y-4">
                {task1ModelGroups.map((group) => (
                  <MemoryListBlock
                    key={group.modelName}
                    title={`多模型候选记忆: ${group.modelName}`}
                    description="用于补充检查金标准是否遗漏。"
                    items={group.items}
                    searchable
                    translationEnabled={translationEnabled}
                  />
                ))}
              </div>
            ) : null}
          </TaskColumn>
        </ThreeColumnTaskLayout>
      );
    }

    if (entry.track === 'Q1' && entry.task === 'task2') {
      const record = asDictionary(original.record);
      const task2Annotation = createTask2Annotation(
        getNewDialogueSeeds(record?.new_dialogue),
        getMemoryRecords(original.answer),
        activeIntegratedAnnotation,
      );

      return (
        <ThreeColumnTaskLayout>
          <TaskColumn step="1" title="新对话" helper="先看这段新对话，判断它会不会改变或新增用户记忆。">
            <ConversationBlock
              title="新对话"
              description="可能触发记忆更新的新对话。"
              turns={normalizeConversation(record?.new_dialogue)}
              translationEnabled={translationEnabled}
            />
          </TaskColumn>
          <TaskColumn step="2" title="更新前旧记忆" helper="对照旧记忆，判断新对话应该修改哪条、保留哪条或新增哪条。">
            <MemoryListBlock
              title="旧记忆"
              description="更新前已有的记忆状态。"
              items={asArray(original.memory)}
              translationEnabled={translationEnabled}
            />
          </TaskColumn>
          <TaskColumn step="3" title="编辑 Golden 更新结果" helper="在这里直接改最终要保存的更新后 memory 字段。">
            <StructuredMemoryEditor
              title="Golden 更新记忆字段编辑"
              description="这些字段会按原始 taxonomy 写回 task2 golden_answer。"
              memories={task2Annotation.editableUpdatedMemories}
              translationEnabled={translationEnabled}
              onChange={(editableUpdatedMemories) =>
                updateIntegratedAnnotation(markDraft(task2Annotation, { editableUpdatedMemories }))
              }
            />
            <IntegratedSaveBar
              error={integratedValidationError}
              buttonLabel="保存 Golden 更新记忆"
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
      const task3Annotation = createTask3Annotation(
        asString(original.query) ?? '',
        getSelectedMemoryRecord(original.selected_memory),
        activeIntegratedAnnotation,
      );
      const validateTask3 = () => {
        if (!task3Annotation.queryText.trim()) {
          return 'Query 不能为空。';
        }

        return task3Annotation.editableSelectedMemory
          ? validateMemoryRecords([task3Annotation.editableSelectedMemory])
          : null;
      };

      return (
        <ThreeColumnTaskLayout>
          <TaskColumn step="1" title="编辑 Query" helper="直接修改最终要保存的 query。">
            <TextAreaField
              label="Golden Query"
              value={task3Annotation.queryText}
              onChange={(queryText) => updateIntegratedAnnotation(markDraft(task3Annotation, { queryText }))}
              placeholder="填写最终应保留的 query。"
            />
          </TaskColumn>
          <TaskColumn step="2" title="候选记忆" helper="横向查看候选记忆池，判断哪条最能支持当前查询。">
            <MemoryListBlock
              title="候选记忆"
              description="用于审核查询与记忆匹配关系的候选记忆池。"
              items={asArray(original.candidate_memories)}
              searchable
              translationEnabled={translationEnabled}
            />
          </TaskColumn>
          <TaskColumn step="3" title="编辑 Golden 选中记忆" helper="直接修改 selected memory 的完整字段并保存。">
            {task3Annotation.editableSelectedMemory ? (
              <StructuredMemoryEditor
                title="Golden 选中记忆字段编辑"
                description="保留 selected memory 的原始字段。"
                memories={[task3Annotation.editableSelectedMemory]}
                translationEnabled={translationEnabled}
                onChange={(nextMemories) =>
                  updateIntegratedAnnotation(
                    markDraft(task3Annotation, { editableSelectedMemory: nextMemories[0] ?? null }),
                  )
                }
                addButtonLabel="补回 Selected Memory"
              />
            ) : null}
            <IntegratedSaveBar
              error={integratedValidationError}
              buttonLabel="保存 Query 和选中记忆"
              onSave={() => saveIntegratedAnnotation(task3Annotation, validateTask3())}
            />
          </TaskColumn>
        </ThreeColumnTaskLayout>
      );
    }

    if (entry.track === 'Q1' && entry.task === 'task4') {
      const querySeeds = buildTask4QuerySeeds(original);
      const selectedMemorySeed = getTask4SelectedMemoryRecord(original);
      const task4Annotation = createTask4Annotation(
        querySeeds,
        selectedMemorySeed,
        entry.ability,
        activeIntegratedAnnotation,
      );
      const candidateMemories = getMemoryRecords(original.extracted_memory);
      const selectedMemoryItems = task4Annotation.editableSelectedMemory
        ? [task4Annotation.editableSelectedMemory]
        : [];
      const selectedMemoryIds = new Set(
        task4Annotation.subAnnotations
          .map((item) => asString(item.editableSelectedMemory?.memory_id))
          .filter(Boolean) as string[],
      );
      const otherCandidateMemories = candidateMemories.filter(
        (memory) => !selectedMemoryIds.has(String(memory.memory_id ?? '')),
      );
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
      const updateTask4SelectedMemory = (selectedMemory: EditableMemoryRecord | null) => {
        updateIntegratedAnnotation(
          markDraft(task4Annotation, {
            editableSelectedMemory: selectedMemory,
            subAnnotations: task4Annotation.subAnnotations.map((item) => ({
              ...item,
              editableSelectedMemory: selectedMemory ? cloneMemoryRecord(selectedMemory) : null,
            })),
          }),
        );
      };
      const validateTask4 = () => {
        if (task4Annotation.subAnnotations.length === 0) {
          return '至少需要一个 ability query。';
        }

        const emptyQuery = task4Annotation.subAnnotations.find((item) => !item.queryText.trim());
        if (emptyQuery) {
          return `Query ${emptyQuery.queryId} 不能为空。`;
        }

        const memoryValidation = validateTask4SelectedMemoryRecord(task4Annotation.editableSelectedMemory);
        if (memoryValidation) {
          return memoryValidation;
        }

        const incompleteVerdict = task4Annotation.subAnnotations.find((item) => !item.overallVerdict);
        if (incompleteVerdict) {
          return `Query ${incompleteVerdict.queryId} 需要填写总体结论。`;
        }

        const needsDetail = task4Annotation.subAnnotations.find(
          (item) =>
            item.overallVerdict !== 'reasonable' &&
            item.issueTypes.length === 0 &&
            !item.revisionSuggestion.trim(),
        );
        if (needsDetail) {
          return `Query ${needsDetail.queryId} 不完全合理时，需要选择问题类型或填写修改建议。`;
        }

        return null;
      };

      return (
        <ThreeColumnTaskLayout>
          <TaskColumn step="1" title="对话依据" helper="先读用户对话，确认 selected memory 是否真的由对话支持。">
            <ConversationBlock
              title="对话上下文"
              turns={normalizeConversation(original.conversation)}
              translationEnabled={translationEnabled}
            />
          </TaskColumn>
          <TaskColumn step="2" title="编辑 Selected Memory" helper="确认目标记忆是否支撑当前 ability query，必要时直接修改字段。">
            {selectedMemoryItems.length > 0 ? (
              <StructuredMemoryEditor
                title="Selected Memory 字段编辑"
                description="这条记忆是 task4 query 应该依赖的目标记忆。"
                memories={selectedMemoryItems}
                translationEnabled={translationEnabled}
                onChange={(nextMemories) => updateTask4SelectedMemory(nextMemories[0] ?? null)}
                addButtonLabel="补回 Selected Memory"
              />
            ) : (
              <StructuredMemoryEditor
                title="Selected Memory 字段编辑"
                description="当前样本缺少 selected memory，可以在这里补回。"
                memories={[]}
                translationEnabled={translationEnabled}
                onChange={(nextMemories) => updateTask4SelectedMemory(nextMemories[0] ?? null)}
                addButtonLabel="补回 Selected Memory"
              />
            )}
            <MemoryListBlock
              title="其他候选记忆"
              description="用于检查 selected memory 是否选对。"
              items={otherCandidateMemories}
              searchable
              collapsible
              collapsedByDefault
              translationEnabled={translationEnabled}
            />
          </TaskColumn>
          <TaskColumn
            step="3"
            title="标注 Ability Query"
            helper="依据对话和 selected memory，判断每个 query 是否测试当前 ability，并可直接修改 query。"
          >
            <div className="space-y-6">
              {task4Annotation.subAnnotations.map((item, index) => (
                <div key={item.queryId} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white">
                      Query {index + 1}
                    </span>
                    <span className="text-xs text-slate-500">{item.queryId}</span>
                    {entry.ability ? (
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600">
                        {entry.ability}
                      </span>
                    ) : null}
                  </div>
                  <TextAreaField
                    label="Ability Query"
                    value={item.queryText}
                    onChange={(queryText) => updateTask4SubAnnotation(item.queryId, { queryText })}
                    placeholder="填写最终应保留的 ability query。"
                  />
                  <RadioField
                    label="总体结论"
                    value={item.overallVerdict}
                    options={TASK4_VERDICT_OPTIONS}
                    onChange={(overallVerdict) =>
                      updateTask4SubAnnotation(item.queryId, {
                        overallVerdict: overallVerdict as Q1Task4SubAnnotation['overallVerdict'],
                      })
                    }
                  />
                  <RadioField
                    label="是否测试目标 ability"
                    value={item.testsTargetAbility}
                    options={TASK4_TERNARY_OPTIONS}
                    onChange={(testsTargetAbility) =>
                      updateTask4SubAnnotation(item.queryId, {
                        testsTargetAbility: testsTargetAbility as Q1Task4SubAnnotation['testsTargetAbility'],
                      })
                    }
                  />
                  <RadioField
                    label="对 selected memory 的依赖强度"
                    value={item.memoryDependency}
                    options={TASK4_DEPENDENCY_OPTIONS}
                    onChange={(memoryDependency) =>
                      updateTask4SubAnnotation(item.queryId, {
                        memoryDependency: memoryDependency as Q1Task4SubAnnotation['memoryDependency'],
                      })
                    }
                  />
                  <RadioField
                    label="Ability 纯度"
                    value={item.abilityPurity}
                    options={TASK4_PURITY_OPTIONS}
                    onChange={(abilityPurity) =>
                      updateTask4SubAnnotation(item.queryId, {
                        abilityPurity: abilityPurity as Q1Task4SubAnnotation['abilityPurity'],
                      })
                    }
                  />
                  <CheckboxField
                    label="问题类型"
                    values={item.issueTypes}
                    options={TASK4_ISSUE_TYPE_OPTIONS}
                    onChange={(issueTypes) => updateTask4SubAnnotation(item.queryId, { issueTypes })}
                  />
                  <TextAreaField
                    label="证据说明"
                    value={item.evidenceNote}
                    onChange={(evidenceNote) => updateTask4SubAnnotation(item.queryId, { evidenceNote })}
                    placeholder="说明对话和 selected memory 如何支持或不支持这个 query。"
                  />
                  <TextAreaField
                    label="修改建议"
                    value={item.revisionSuggestion}
                    onChange={(revisionSuggestion) => updateTask4SubAnnotation(item.queryId, { revisionSuggestion })}
                    placeholder="如果 query 不合适，写出建议改法。"
                  />
                </div>
              ))}
              <TextAreaField
                label="样本备注"
                value={task4Annotation.annotatorNote ?? ''}
                onChange={(annotatorNote) =>
                  updateIntegratedAnnotation(markDraft(task4Annotation, { annotatorNote }))
                }
                placeholder="可选：记录整个 session 的备注。"
              />
              <IntegratedSaveBar
                error={integratedValidationError}
                buttonLabel="保存 Task4 标注"
                onSave={() => saveIntegratedAnnotation(task4Annotation, validateTask4())}
              />
            </div>
          </TaskColumn>
        </ThreeColumnTaskLayout>
      );
    }

    if (entry.track === 'Q2' && entry.task === 'task1') {
      const probe = asDictionary(original.probe);
      const judgeScoreItems = [
        typeof itemData.judge_score === 'number'
          ? { label: '评审分数', text: String(itemData.judge_score) }
          : null,
        typeof itemData.final_score === 'number'
          ? { label: '最终分数', text: String(itemData.final_score) }
          : null,
      ].filter(Boolean) as Array<{ label?: string; text: string }>;
      return (
        <>
          <DisplaySection title="输入上下文" tone="input">
            <ConversationBlock
              title="对话"
              description="展示给抽取模型和人工评审者的原始对话。"
              turns={normalizeConversation(probe?.dialogue)}
              translationEnabled={translationEnabled}
            />
            <MemoryListBlock
              title="金标准记忆"
              items={asArray(probe?.ground_truth_memories)}
              translationEnabled={translationEnabled}
            />
          </DisplaySection>
          {modelOutput ? (
            <DisplaySection title="待审核输出" tone="output">
              <JsonPreviewBlock title="模型输出" description="指定模型生成的结构化抽取结果。" value={modelOutput} />
            </DisplaySection>
          ) : null}
          {showJudgeArtifacts && typeof judgeOutputValue !== 'undefined' ? (
            <DisplaySection title="评审可见输出" tone="judge">
              <JsonPreviewBlock title="评审输出" description="用于一致性审核的评审可见载荷。" value={judgeOutputValue} />
              {judgeScoreItems.length > 0 ? (
                <TextBlock
                  title="评审分数摘要"
                  description="LLM 评审流水线输出的标量分数。"
                  items={judgeScoreItems}
                  translationEnabled={translationEnabled}
                />
              ) : null}
            </DisplaySection>
          ) : null}
        </>
      );
    }

    if (entry.track === 'Q2' && entry.task === 'task2') {
      const record = asDictionary(original.record);
      const modelMemoryItems = Array.isArray(modelOutput?.memory_items) ? modelOutput.memory_items : [];
      const rawModelOutput = formatPossiblyStructuredString(modelOutput?.raw_output);
      const pairReviewItems = buildJudgeReviewTextItems(judgeOutput?.pair_reviews, 'pair_reviews');
      const missingReviewItems = buildJudgeReviewTextItems(judgeOutput?.missing_reviews, 'missing_reviews');
      const extraReviewItems = buildJudgeReviewTextItems(judgeOutput?.extra_reviews, 'extra_reviews');
      const judgeScoreItems = [
        typeof itemData.judge_score === 'number'
          ? { label: '评审分数', text: String(itemData.judge_score) }
          : null,
        typeof itemData.final_score === 'number'
          ? { label: '最终分数', text: String(itemData.final_score) }
          : null,
      ].filter(Boolean) as Array<{ label?: string; text: string }>;
      return (
        <>
          <DisplaySection title="输入上下文" tone="input">
            <MemoryListBlock
              title="现有记忆"
              description="更新前的记忆状态。"
              items={asArray(original.memory)}
              translationEnabled={translationEnabled}
            />
            <ConversationBlock
              title="新对话"
              description="用于评估更新是否合理的对话。"
              turns={normalizeConversation(record?.new_dialogue)}
              translationEnabled={translationEnabled}
            />
            <MemoryListBlock
              title="参考更新记忆"
              items={asArray(original.answer)}
              translationEnabled={translationEnabled}
            />
          </DisplaySection>
          {modelOutput ? (
            <DisplaySection title="待审核输出" tone="output">
              {modelMemoryItems.length > 0 ? (
                <MemoryListBlock
                  title="模型记忆输出"
                  description="模型生成的结构化记忆更新结果。"
                  items={modelMemoryItems as Array<Record<string, unknown>>}
                  translationEnabled={translationEnabled}
                />
              ) : null}
              {rawModelOutput ? (
                <TextBlock
                  title="模型原始输出"
                  description="模型生成的原始文本。"
                  items={[{ text: rawModelOutput }]}
                  translationEnabled={translationEnabled}
                />
              ) : !modelMemoryItems.length ? (
                <JsonPreviewBlock title="模型输出" value={modelOutput} />
              ) : null}
            </DisplaySection>
          ) : null}
          {showJudgeArtifacts && typeof judgeOutputValue !== 'undefined' ? (
            <DisplaySection title="评审可见输出" tone="judge">
              {pairReviewItems.length > 0 ? (
                <TextBlock
                  title="配对审核项"
                  description="评审器对已匹配金标准/预测对的审核结果。"
                  items={pairReviewItems}
                  translationEnabled={translationEnabled}
                />
              ) : null}
              {missingReviewItems.length > 0 ? (
                <TextBlock
                  title="缺失审核项"
                  description="评审器认为本应被抽取出的金标准条目。"
                  items={missingReviewItems}
                  translationEnabled={translationEnabled}
                />
              ) : null}
              {extraReviewItems.length > 0 ? (
                <TextBlock
                  title="多余审核项"
                  description="评审器标记为多余或幻觉的预测条目。"
                  items={extraReviewItems}
                  translationEnabled={translationEnabled}
                />
              ) : null}
              {pairReviewItems.length === 0 &&
              missingReviewItems.length === 0 &&
              extraReviewItems.length === 0 ? (
                <JsonPreviewBlock title="评审输出" value={judgeOutputValue} />
              ) : null}
              {judgeScoreItems.length > 0 ? (
                <TextBlock
                  title="评审分数摘要"
                  description="LLM 评审流水线输出的标量分数。"
                  items={judgeScoreItems}
                  translationEnabled={translationEnabled}
                />
              ) : null}
            </DisplaySection>
          ) : null}
        </>
      );
    }

    if (entry.track === 'Q2' && entry.task === 'task3') {
      const selectedMemory = asDictionary(original.selected_memory);
      const task3ModelItems = getTask3ModelTextItems(modelOutput);
      const judgeReason = formatPossiblyStructuredString(judgeOutput?.reason);
      const judgeSummaryItems = [
        typeof judgeOutput?.used_memory === 'boolean'
          ? { label: '是否使用选中记忆', text: judgeOutput.used_memory ? '是' : '否' }
          : null,
        typeof judgeOutput?.score === 'number'
          ? { label: '评审分数', text: String(judgeOutput.score) }
          : null,
        judgeReason ? { label: '评审理由', text: judgeReason } : null,
      ].filter(Boolean) as Array<{ label?: string; text: string }>;
      return (
        <>
          <DisplaySection title="输入上下文" tone="input">
            <TextBlock
              title="查询"
              items={asString(original.query) ? [{ text: original.query }] : []}
              translationEnabled={translationEnabled}
            />
            <MemoryListBlock
              title="选中记忆"
              items={selectedMemory ? [selectedMemory] : []}
              translationEnabled={translationEnabled}
            />
          </DisplaySection>
          {task3ModelItems.length > 0 ? (
            <DisplaySection title="待审核输出" tone="output">
              <TextBlock
                title="模型回答"
                description="评审器用来判断记忆使用情况的回答。"
                items={task3ModelItems}
                translationEnabled={translationEnabled}
              />
            </DisplaySection>
          ) : getResponseItems(modelOutput).length > 0 ? (
            <DisplaySection title="待审核输出" tone="output">
              <TextBlock
                title="模型回答"
                description="评审器用来判断记忆使用情况的回答。"
                items={getResponseItems(modelOutput)}
                translationEnabled={translationEnabled}
              />
            </DisplaySection>
          ) : modelOutput ? (
            <DisplaySection title="待审核输出" tone="output">
              <JsonPreviewBlock title="模型输出" value={modelOutput} />
            </DisplaySection>
          ) : null}
          {showJudgeArtifacts && typeof judgeOutputValue !== 'undefined' ? (
            <DisplaySection title="评审可见输出" tone="judge">
              {judgeSummaryItems.length > 0 ? (
                <TextBlock
                  title="评审输出"
                  description="包含是否使用记忆、分数与解释。"
                  items={judgeSummaryItems}
                  translationEnabled={translationEnabled}
                />
              ) : (
                <JsonPreviewBlock
                  title="评审输出"
                  description="包含是否使用记忆、分数与解释。"
                  value={judgeOutputValue}
                />
              )}
            </DisplaySection>
          ) : null}
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
            label: asString(record.query_id) ?? `查询-${index + 1}`,
            text,
          };
        })
        .filter(Boolean) as Array<{ label?: string; text: string }>;

      return (
        <>
          <DisplaySection title="输入上下文" tone="input">
            <MemoryListBlock
              title="抽取出的记忆"
              items={asArray(original.extracted_memory)}
              translationEnabled={translationEnabled}
            />
            <ConversationBlock
              title="对话上下文"
              turns={normalizeConversation(original.conversation)}
              translationEnabled={translationEnabled}
            />
          </DisplaySection>
          <DisplaySection title="待审核输出" tone="output">
            <TextBlock
              title="能力查询"
              items={queryItems}
              translationEnabled={translationEnabled}
            />
            {getResponseItems(modelOutput).length > 0 ? (
              <TextBlock
                title="模型回答"
                items={getResponseItems(modelOutput)}
                translationEnabled={translationEnabled}
              />
            ) : modelOutput ? (
              <JsonPreviewBlock title="模型输出" value={modelOutput} />
            ) : null}
          </DisplaySection>
          {showJudgeArtifacts && typeof judgeOutputValue !== 'undefined' ? (
            <DisplaySection title="评审可见输出" tone="judge">
              <JsonPreviewBlock title="评审输出" value={judgeOutputValue} />
              {typeof itemData.judge_score !== 'undefined' ? (
                <JsonPreviewBlock title="评审分数摘要" value={itemData.judge_score} />
              ) : null}
            </DisplaySection>
          ) : null}
        </>
      );
    }

    return (
      <>
        <JsonPreviewBlock title="原始样本数据" value={original} />
        {modelOutput ? <JsonPreviewBlock title="模型输出" value={modelOutput} /> : null}
        {showJudgeArtifacts && typeof judgeOutputValue !== 'undefined' ? (
          <JsonPreviewBlock title="评审输出" value={judgeOutputValue} />
        ) : null}
      </>
    );
  };

  return (
    <Card className={sampleBlockCardClass}>
      <CardHeader className={sampleBlockHeaderClass}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-lg font-semibold text-slate-900">样本展示</CardTitle>
            <CardDescription className="max-w-3xl text-slate-600">
              面向当前样本的任务感知展示。翻译功能为可选项，只影响左侧展示内容。
            </CardDescription>
          </div>
          <Button
            type="button"
            variant={translationEnabled ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTranslationEnabled((current) => !current)}
            className="gap-2 rounded-xl"
          >
            <Languages className="h-4 w-4" />
            {translationEnabled ? '翻译已开启' : '开启翻译'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className={`min-w-0 space-y-6 ${sampleBlockContentClass}`}>
        {renderTrackSpecificBlocks()}
      </CardContent>
    </Card>
  );
}
