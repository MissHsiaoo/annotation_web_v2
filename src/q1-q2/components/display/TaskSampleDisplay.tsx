import { useState, type ReactNode } from 'react';
import { Languages } from 'lucide-react';

import { Button } from '../../../components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../components/ui/card';
import type { AnySupportedAnnotation, EvaluationMode, LoadedManualCheckItem } from '../../types';
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
        label: asString(record.query_id) ?? `Response ${index + 1}`,
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
            record.ok === true ? 'OK' : 'Mismatch'
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
    items.push({ label: 'Answer', text: answerText });
  }

  const reasonText = formatPossiblyStructuredString(parsedResponse?.reason);
  if (reasonText) {
    items.push({ label: 'Reason', text: reasonText });
  }

  const selectedMemoryId = asString(parsedResponse?.selected_memory_id);
  if (selectedMemoryId) {
    items.push({ label: 'Selected memory ID', text: selectedMemoryId });
  }

  const rawOutput = formatPossiblyStructuredString(modelOutput.raw_output);
  if (items.length === 0 && rawOutput) {
    items.push({ label: 'Raw model output', text: rawOutput });
  }

  return items;
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

export function TaskSampleDisplay({ loadedItem, evaluationMode, currentAnnotation }: TaskSampleDisplayProps) {
  const [translationEnabled, setTranslationEnabled] = useState(false);

  const { entry, itemData } = loadedItem;
  const original = asDictionary(itemData.original);
  const modelOutput = asDictionary(itemData.model_output);
  const judgeOutput = asDictionary(itemData.judge_output_raw);
  const judgeOutputValue = itemData.judge_output_raw;
  const showJudgeArtifacts = entry.track !== 'Q2' || evaluationMode === 'judge_visible';

  const renderTrackSpecificBlocks = () => {
    if (!original) {
      return (
        <JsonPreviewBlock
          title="Full item JSON"
          description="No normalized original payload was found."
          value={itemData}
        />
      );
    }

    if (entry.track === 'Q1' && entry.task === 'task1') {
      const probe = asDictionary(original.probe);
      return (
        <>
          <DisplaySection title="Input context" tone="input">
            <ConversationBlock
              title="Dialogue"
              description="Source conversation used to construct the benchmark memory."
              turns={normalizeConversation(probe?.dialogue)}
              translationEnabled={translationEnabled}
            />
          </DisplaySection>
          <DisplaySection title="Output under review" tone="output">
            <MemoryListBlock
              title="Gold memories"
              description="Benchmark gold memories to review against the dialogue."
              items={asArray(probe?.ground_truth_memories)}
              translationEnabled={translationEnabled}
            />
          </DisplaySection>
        </>
      );
    }

    if (entry.track === 'Q1' && entry.task === 'task2') {
      const record = asDictionary(original.record);
      const editedDialogueTurns =
        currentAnnotation?.formType === 'Q1:task2' && Array.isArray(currentAnnotation.editableNewDialogue)
          ? currentAnnotation.editableNewDialogue.filter(
              (item: any, index: number) =>
                typeof item?.text === 'string' &&
                item.text !== normalizeConversation(record?.new_dialogue)[index]?.text,
            )
          : [];
      const editedDialogue =
        currentAnnotation?.formType === 'Q1:task2' &&
        Array.isArray(currentAnnotation.editableNewDialogue) &&
        editedDialogueTurns.length > 0
          ? currentAnnotation.editableNewDialogue.map((item: any) => ({
              role: typeof item?.role === 'string' ? item.role : 'unknown',
              text: typeof item?.text === 'string' ? item.text : '',
            }))
          : [];
      const answerItems = asArray(original.answer);
      const editedMemory =
        currentAnnotation?.formType === 'Q1:task2' &&
        Array.isArray(currentAnnotation.editableUpdatedMemories) &&
        currentAnnotation.editableUpdatedMemories.some(
          (item: any) =>
            typeof item?.value === 'string' &&
            item.value !==
              (answerItems.find((candidate) => {
                const record = asDictionary(candidate);
                return (
                  (typeof record?.memory_id === 'string' ? record.memory_id : '') ===
                  (typeof item?.memoryId === 'string' ? item.memoryId : '')
                );
              }) as any)?.value,
        )
          ? currentAnnotation.editableUpdatedMemories.map((item: any) => ({
              memory_id: item.memoryId,
              value: item.value,
            }))
          : [];

      return (
        <>
          <DisplaySection title="Input context" tone="input">
            <MemoryListBlock
              title="Old memory"
              description="Existing memory state before the update."
              items={asArray(original.memory)}
              translationEnabled={translationEnabled}
            />
            <ConversationBlock
              title="New dialogue"
              description="Fresh dialogue that may trigger the update."
              turns={normalizeConversation(record?.new_dialogue)}
              translationEnabled={translationEnabled}
            />
            {editedDialogue.length > 0 ? (
              <ConversationBlock
                title="Edited new dialogue"
                description="Annotator-revised version kept alongside the original."
                turns={editedDialogue}
                translationEnabled={translationEnabled}
              />
            ) : null}
          </DisplaySection>
          <DisplaySection title="Output under review" tone="output">
            <MemoryListBlock
              title="Gold updated memory"
              description="Benchmark update result to review."
              items={asArray(original.answer)}
              translationEnabled={translationEnabled}
            />
            {editedMemory.length > 0 ? (
              <MemoryListBlock
                title="Edited updated memory"
                description="Annotator-revised memory statements."
                items={editedMemory}
                translationEnabled={translationEnabled}
              />
            ) : null}
          </DisplaySection>
        </>
      );
    }

    if (entry.track === 'Q1' && entry.task === 'task3') {
      const selectedMemory = asDictionary(original.selected_memory);
      const editedQuery =
        currentAnnotation?.formType === 'Q1:task3' &&
        typeof currentAnnotation.queryText === 'string' &&
        currentAnnotation.queryText.trim() &&
        currentAnnotation.queryText !== original.query
          ? currentAnnotation.queryText
          : null;
      return (
        <>
          <DisplaySection title="Input context" tone="input">
            <TextBlock
              title="Original query"
              items={asString(original.query) ? [{ text: original.query }] : []}
              translationEnabled={translationEnabled}
            />
            {editedQuery ? (
              <TextBlock
                title="Edited query"
                description="Annotator-revised query kept alongside the original."
                items={[{ text: editedQuery }]}
                translationEnabled={translationEnabled}
              />
            ) : null}
            <MemoryListBlock
              title="Candidate memories"
              description="Searchable candidate pool for the query-memory fit review."
              items={asArray(original.candidate_memories)}
              searchable
              collapsible
              collapsedByDefault
            />
          </DisplaySection>
          <DisplaySection title="Output under review" tone="output">
            <MemoryListBlock
              title="Selected memory"
              description="Target memory chosen for the query."
              items={selectedMemory ? [selectedMemory] : []}
              translationEnabled={translationEnabled}
            />
          </DisplaySection>
        </>
      );
    }

    if (entry.track === 'Q1' && entry.task === 'task4') {
      const queryItems = asArray(original.queries)
        .map((item) => {
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
      const editedQueryItems =
        currentAnnotation?.formType === 'Q1:task4' && Array.isArray(currentAnnotation.subAnnotations)
          ? currentAnnotation.subAnnotations
              .map((item: any) => {
                const originalItem = queryItems.find((candidate) => candidate.label === item.queryId);
                const text = typeof item?.queryText === 'string' ? item.queryText : '';

                if (!text.trim()) {
                  return null;
                }

                if (originalItem && originalItem.text === text) {
                  return null;
                }

                return {
                  label: typeof item?.queryId === 'string' ? item.queryId : undefined,
                  text,
                };
              })
              .filter(Boolean)
          : [];

      return (
        <>
          <DisplaySection title="Input context" tone="input">
            <MemoryListBlock
              title="Extracted memory"
              items={asArray(original.extracted_memory)}
              translationEnabled={translationEnabled}
            />
            <ConversationBlock
              title="Conversation context"
              turns={normalizeConversation(original.conversation)}
              translationEnabled={translationEnabled}
            />
          </DisplaySection>
          <DisplaySection title="Output under review" tone="output">
            <TextBlock
              title="Original ability query"
              description="Ability-specific prompt shown to the model or evaluator."
              items={queryItems}
              translationEnabled={translationEnabled}
            />
            {editedQueryItems.length > 0 ? (
              <TextBlock
                title="Edited ability query"
                description="Annotator-revised query text kept alongside the original."
                items={editedQueryItems as Array<{ label?: string; text: string }>}
                translationEnabled={translationEnabled}
              />
            ) : null}
          </DisplaySection>
        </>
      );
    }

    if (entry.track === 'Q2' && entry.task === 'task1') {
      const probe = asDictionary(original.probe);
      const judgeScoreItems = [
        typeof itemData.judge_score === 'number'
          ? { label: 'Judge score', text: String(itemData.judge_score) }
          : null,
        typeof itemData.final_score === 'number'
          ? { label: 'Final score', text: String(itemData.final_score) }
          : null,
      ].filter(Boolean) as Array<{ label?: string; text: string }>;
      return (
        <>
          <DisplaySection title="Input context" tone="input">
            <ConversationBlock
              title="Dialogue"
              description="Original dialogue shown to the extraction model and human judge."
              turns={normalizeConversation(probe?.dialogue)}
              translationEnabled={translationEnabled}
            />
            <MemoryListBlock
              title="Gold memories"
              items={asArray(probe?.ground_truth_memories)}
              translationEnabled={translationEnabled}
            />
          </DisplaySection>
          {modelOutput ? (
            <DisplaySection title="Output under review" tone="output">
              <JsonPreviewBlock title="Model output" description="Structured extraction output from the assigned model." value={modelOutput} />
            </DisplaySection>
          ) : null}
          {showJudgeArtifacts && typeof judgeOutputValue !== 'undefined' ? (
            <DisplaySection title="Judge-visible output" tone="judge">
              <JsonPreviewBlock title="Judge output" description="Judge-visible payload for alignment review." value={judgeOutputValue} />
              {judgeScoreItems.length > 0 ? (
                <TextBlock
                  title="Judge score summary"
                  description="Scalar scores produced by the LLM judge pipeline."
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
          ? { label: 'Judge score', text: String(itemData.judge_score) }
          : null,
        typeof itemData.final_score === 'number'
          ? { label: 'Final score', text: String(itemData.final_score) }
          : null,
      ].filter(Boolean) as Array<{ label?: string; text: string }>;
      return (
        <>
          <DisplaySection title="Input context" tone="input">
            <MemoryListBlock
              title="Existing memory"
              description="Memory state before the update."
              items={asArray(original.memory)}
              translationEnabled={translationEnabled}
            />
            <ConversationBlock
              title="New dialogue"
              description="Dialogue used to evaluate the update."
              turns={normalizeConversation(record?.new_dialogue)}
              translationEnabled={translationEnabled}
            />
            <MemoryListBlock
              title="Reference updated memory"
              items={asArray(original.answer)}
              translationEnabled={translationEnabled}
            />
          </DisplaySection>
          {modelOutput ? (
            <DisplaySection title="Output under review" tone="output">
              {modelMemoryItems.length > 0 ? (
                <MemoryListBlock
                  title="Model memory output"
                  description="Structured memory updates produced by the model."
                  items={modelMemoryItems as Array<Record<string, unknown>>}
                  translationEnabled={translationEnabled}
                />
              ) : null}
              {rawModelOutput ? (
                <TextBlock
                  title="Raw model output"
                  description="Raw generated text from the model."
                  items={[{ text: rawModelOutput }]}
                  translationEnabled={translationEnabled}
                />
              ) : !modelMemoryItems.length ? (
                <JsonPreviewBlock title="Model output" value={modelOutput} />
              ) : null}
            </DisplaySection>
          ) : null}
          {showJudgeArtifacts && typeof judgeOutputValue !== 'undefined' ? (
            <DisplaySection title="Judge-visible output" tone="judge">
              {pairReviewItems.length > 0 ? (
                <TextBlock
                  title="Pair reviews"
                  description="Judge review items for matched gold/prediction pairs."
                  items={pairReviewItems}
                  translationEnabled={translationEnabled}
                />
              ) : null}
              {missingReviewItems.length > 0 ? (
                <TextBlock
                  title="Missing reviews"
                  description="Gold items the judge thinks should have been extracted."
                  items={missingReviewItems}
                  translationEnabled={translationEnabled}
                />
              ) : null}
              {extraReviewItems.length > 0 ? (
                <TextBlock
                  title="Extra reviews"
                  description="Predicted items the judge flags as extra or hallucinated."
                  items={extraReviewItems}
                  translationEnabled={translationEnabled}
                />
              ) : null}
              {pairReviewItems.length === 0 &&
              missingReviewItems.length === 0 &&
              extraReviewItems.length === 0 ? (
                <JsonPreviewBlock title="Judge output" value={judgeOutputValue} />
              ) : null}
              {judgeScoreItems.length > 0 ? (
                <TextBlock
                  title="Judge score summary"
                  description="Scalar scores produced by the LLM judge pipeline."
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
          ? { label: 'Used selected memory', text: judgeOutput.used_memory ? 'Yes' : 'No' }
          : null,
        typeof judgeOutput?.score === 'number'
          ? { label: 'Judge score', text: String(judgeOutput.score) }
          : null,
        judgeReason ? { label: 'Judge reason', text: judgeReason } : null,
      ].filter(Boolean) as Array<{ label?: string; text: string }>;
      return (
        <>
          <DisplaySection title="Input context" tone="input">
            <TextBlock
              title="Query"
              items={asString(original.query) ? [{ text: original.query }] : []}
              translationEnabled={translationEnabled}
            />
            <MemoryListBlock
              title="Selected memory"
              items={selectedMemory ? [selectedMemory] : []}
              translationEnabled={translationEnabled}
            />
          </DisplaySection>
          {task3ModelItems.length > 0 ? (
            <DisplaySection title="Output under review" tone="output">
              <TextBlock
                title="Model response"
                description="Response that the judge evaluated for memory usage."
                items={task3ModelItems}
                translationEnabled={translationEnabled}
              />
            </DisplaySection>
          ) : getResponseItems(modelOutput).length > 0 ? (
            <DisplaySection title="Output under review" tone="output">
              <TextBlock
                title="Model response"
                description="Response that the judge evaluated for memory usage."
                items={getResponseItems(modelOutput)}
                translationEnabled={translationEnabled}
              />
            </DisplaySection>
          ) : modelOutput ? (
            <DisplaySection title="Output under review" tone="output">
              <JsonPreviewBlock title="Model output" value={modelOutput} />
            </DisplaySection>
          ) : null}
          {showJudgeArtifacts && typeof judgeOutputValue !== 'undefined' ? (
            <DisplaySection title="Judge-visible output" tone="judge">
              {judgeSummaryItems.length > 0 ? (
                <TextBlock
                  title="Judge output"
                  description="Used-memory decision, score, and explanation."
                  items={judgeSummaryItems}
                  translationEnabled={translationEnabled}
                />
              ) : (
                <JsonPreviewBlock
                  title="Judge output"
                  description="Used-memory decision, score, and explanation."
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
        .map((item) => {
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
          <DisplaySection title="Input context" tone="input">
            <MemoryListBlock
              title="Extracted memory"
              items={asArray(original.extracted_memory)}
              translationEnabled={translationEnabled}
            />
            <ConversationBlock
              title="Conversation context"
              turns={normalizeConversation(original.conversation)}
              translationEnabled={translationEnabled}
            />
          </DisplaySection>
          <DisplaySection title="Output under review" tone="output">
            <TextBlock
              title="Ability query"
              items={queryItems}
              translationEnabled={translationEnabled}
            />
            {getResponseItems(modelOutput).length > 0 ? (
              <TextBlock
                title="Model response"
                items={getResponseItems(modelOutput)}
                translationEnabled={translationEnabled}
              />
            ) : modelOutput ? (
              <JsonPreviewBlock title="Model output" value={modelOutput} />
            ) : null}
          </DisplaySection>
          {showJudgeArtifacts && typeof judgeOutputValue !== 'undefined' ? (
            <DisplaySection title="Judge-visible output" tone="judge">
              <JsonPreviewBlock title="Judge output" value={judgeOutputValue} />
              {typeof itemData.judge_score !== 'undefined' ? (
                <JsonPreviewBlock title="Judge score summary" value={itemData.judge_score} />
              ) : null}
            </DisplaySection>
          ) : null}
        </>
      );
    }

    return (
      <>
        <JsonPreviewBlock title="Original sample payload" value={original} />
        {modelOutput ? <JsonPreviewBlock title="Model output" value={modelOutput} /> : null}
        {showJudgeArtifacts && typeof judgeOutputValue !== 'undefined' ? (
          <JsonPreviewBlock title="Judge output" value={judgeOutputValue} />
        ) : null}
      </>
    );
  };

  return (
    <Card className={sampleBlockCardClass}>
      <CardHeader className={sampleBlockHeaderClass}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-lg font-semibold text-slate-900">Sample display</CardTitle>
            <CardDescription className="max-w-3xl text-slate-600">
              Task-aware display for the currently selected sample. Translation is optional and only affects the left-side display.
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
            {translationEnabled ? 'Translation on' : 'Translate'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className={`min-w-0 space-y-6 ${sampleBlockContentClass}`}>
        {renderTrackSpecificBlocks()}
      </CardContent>
    </Card>
  );
}
