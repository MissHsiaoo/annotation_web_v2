import { useMemo, useState } from 'react';

import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../components/ui/card';
import { Label } from '../../../components/ui/label';
import { Switch } from '../../../components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import type {
  AbilityKey,
  EvaluationMode,
  Q2Task4AnnotationRecord,
  Q2Task4BlindModeAnnotation,
  Q2Task4SubAnnotation,
  Q2Task4VisibleModeAnnotation,
} from '../../types';
import {
  annotationFormArtifactPanelClass,
  annotationFormCardClass,
  annotationFormContentClass,
  annotationFormContextPanelClass,
  annotationFormFooterClass,
  annotationFormHeaderClass,
  annotationValidationErrorClass,
  formatAnnotationSaveSummary,
  isBoundedInteger,
  useAnnotationDraftSync,
  withDraftMeta,
} from './annotationFormShell';
import { TranslatedText } from '../display/TranslatedText';
import { CheckboxField, NumberField, RadioField, TextAreaField } from './FormFields';

interface QuerySeed {
  queryId: string;
  queryText: string;
  responseText: string;
  judgeVisiblePayload?: unknown;
}

const ALIGNMENT_OPTIONS = [
  { value: 'aligned', label: '一致' },
  { value: 'partially_aligned', label: '部分一致' },
  { value: 'not_aligned', label: '不一致' },
];

const ISSUE_TYPE_OPTIONS = [
  { value: 'score_too_high', label: '分数过高' },
  { value: 'score_too_low', label: '分数过低' },
  { value: 'wrong_dimension_focus', label: '关注维度错误' },
  { value: 'reasoning_mismatch', label: '推理不匹配' },
  { value: 'other', label: '其他' },
];

const ABILITY5_DIMENSIONS = ['resonation', 'expression', 'reception'] as const;

function createEmptyVisibleModeAnnotation(): Q2Task4VisibleModeAnnotation {
  return {
    mode: 'judge_visible',
    status: 'draft',
    updatedAt: '',
    alignmentVerdict: 'aligned',
    issueTypes: [],
    evidenceNote: '',
    revisionSuggestion: '',
    annotatorNote: '',
  };
}

function createEmptyBlindModeAnnotation(ability?: AbilityKey): Q2Task4BlindModeAnnotation {
  return {
    mode: 'blind_human_scoring',
    status: 'draft',
    updatedAt: '',
    humanScore: 100,
    humanRationale: '',
    annotatorNote: '',
    dimensionScores:
      ability === 'ability5'
        ? {
            resonation: 100,
            expression: 100,
            reception: 100,
          }
        : undefined,
  };
}

function createEmptySubAnnotation(seed: QuerySeed, ability?: AbilityKey): Q2Task4SubAnnotation {
  void ability;
  return {
    queryId: seed.queryId,
    queryText: seed.queryText,
    responseText: seed.responseText,
    annotationsByMode: {},
  };
}

function createEmptyRecord(querySeeds: QuerySeed[], ability?: AbilityKey): Q2Task4AnnotationRecord {
  return {
    formType: 'Q2:task4',
    status: 'draft',
    updatedAt: '',
    ability,
    subAnnotations: querySeeds.map((seed) => createEmptySubAnnotation(seed, ability)),
    annotatorNote: '',
  };
}

function mergeQuerySeeds(
  querySeeds: QuerySeed[],
  existing: Q2Task4AnnotationRecord | undefined,
  ability?: AbilityKey,
): Q2Task4AnnotationRecord {
  const fallback = existing ?? createEmptyRecord(querySeeds, ability);
  const byId = new Map(fallback.subAnnotations.map((item) => [item.queryId, item]));

  return {
    ...fallback,
    ability,
    subAnnotations: querySeeds.map((seed) => {
      const existingItem = byId.get(seed.queryId);
      if (!existingItem) {
        return createEmptySubAnnotation(seed, ability);
      }

      return {
        ...existingItem,
        queryText: seed.queryText,
        responseText: seed.responseText,
        annotationsByMode: existingItem.annotationsByMode ?? {},
      };
    }),
  };
}

interface Q2Task4FormProps {
  ability?: AbilityKey;
  initialValue?: Q2Task4AnnotationRecord;
  mode: EvaluationMode;
  querySeeds: QuerySeed[];
  onModeChange: (mode: EvaluationMode) => void;
  onDraftChange?: (annotation: Q2Task4AnnotationRecord) => void;
  onSave: (annotation: Q2Task4AnnotationRecord) => void;
}

export function Q2Task4Form({
  ability,
  initialValue,
  mode,
  querySeeds,
  onModeChange,
  onDraftChange,
  onSave,
}: Q2Task4FormProps) {
  const startingValue = useMemo(
    () => mergeQuerySeeds(querySeeds, initialValue, ability),
    [ability, initialValue, querySeeds],
  );
  const [record, setRecord] = useState<Q2Task4AnnotationRecord>(startingValue);
  const [activeQueryId, setActiveQueryId] = useState(querySeeds[0]?.queryId ?? 'query-1');
  const [validationError, setValidationError] = useState('');

  useAnnotationDraftSync(record, startingValue, onDraftChange);

  const saveSummary = useMemo(
    () => formatAnnotationSaveSummary(record.status, record.updatedAt),
    [record.status, record.updatedAt],
  );

  const completedCount = record.subAnnotations.filter((item) => {
    if (mode === 'judge_visible') {
      return Boolean(item.annotationsByMode.judge_visible?.alignmentVerdict);
    }

    const blind = item.annotationsByMode.blind_human_scoring;
    return isBoundedInteger(blind?.humanScore ?? null) && Boolean(blind?.humanRationale.trim());
  }).length;

  const updateSubAnnotation = (queryId: string, patch: Partial<Q2Task4SubAnnotation>) => {
    setRecord((current) => ({
      ...withDraftMeta(current, {}),
      subAnnotations: current.subAnnotations.map((item) =>
        item.queryId === queryId ? { ...item, ...patch } : item,
      ),
    }));
  };

  const updateVisibleMode = (
    queryId: string,
    patch: Partial<Q2Task4VisibleModeAnnotation>,
  ) => {
    const updatedAt = new Date().toISOString();
    setRecord((current) => ({
      ...current,
      status: 'draft',
      updatedAt,
      subAnnotations: current.subAnnotations.map((item) =>
        item.queryId === queryId
          ? {
              ...item,
              annotationsByMode: {
                ...item.annotationsByMode,
                judge_visible: {
                  ...(item.annotationsByMode.judge_visible ?? createEmptyVisibleModeAnnotation()),
                  ...patch,
                  status: 'draft',
                  updatedAt,
                },
              },
            }
          : item,
      ),
    }));
  };

  const updateBlindMode = (
    queryId: string,
    patch: Partial<Q2Task4BlindModeAnnotation>,
  ) => {
    const updatedAt = new Date().toISOString();
    setRecord((current) => ({
      ...current,
      status: 'draft',
      updatedAt,
      subAnnotations: current.subAnnotations.map((item) =>
        item.queryId === queryId
          ? {
              ...item,
              annotationsByMode: {
                ...item.annotationsByMode,
                blind_human_scoring: {
                  ...(item.annotationsByMode.blind_human_scoring ??
                    createEmptyBlindModeAnnotation(ability)),
                  ...patch,
                  status: 'draft',
                  updatedAt,
                },
              },
            }
          : item,
      ),
    }));
  };

  const handleSave = () => {
    if (mode === 'judge_visible') {
      const incomplete = record.subAnnotations.find(
        (item) => !item.annotationsByMode.judge_visible?.alignmentVerdict,
      );

      if (incomplete) {
        setValidationError('Complete the alignment verdict for every query before saving.');
        setActiveQueryId(incomplete.queryId);
        return;
      }

      const nextTimestamp = new Date().toISOString();
      const nextRecord: Q2Task4AnnotationRecord = {
        ...record,
        status: 'saved',
        updatedAt: nextTimestamp,
        subAnnotations: record.subAnnotations.map((item) => ({
          ...item,
          annotationsByMode: {
            ...(Object.fromEntries(
              Object.entries(item.annotationsByMode).map(([modeKey, modeAnnotation]) => [
                modeKey,
                {
                  ...modeAnnotation,
                  status: 'saved',
                  updatedAt: nextTimestamp,
                },
              ]),
            ) as Q2Task4SubAnnotation['annotationsByMode']),
            judge_visible: {
              ...(item.annotationsByMode.judge_visible ?? createEmptyVisibleModeAnnotation()),
              status: 'saved',
              updatedAt: nextTimestamp,
            },
          },
        })),
      };

      setRecord(nextRecord);
      setValidationError('');
      onSave(nextRecord);
      return;
    }

    const incomplete = record.subAnnotations.find((item) => {
      const blind = item.annotationsByMode.blind_human_scoring;
      return !isBoundedInteger(blind?.humanScore ?? null) || !blind?.humanRationale.trim();
    });

    if (incomplete) {
      setValidationError(
        'Complete the human score (0-100) and rationale for every query before saving.',
      );
      setActiveQueryId(incomplete.queryId);
      return;
    }

    const nextTimestamp = new Date().toISOString();
      const nextRecord: Q2Task4AnnotationRecord = {
        ...record,
        status: 'saved',
        updatedAt: nextTimestamp,
        subAnnotations: record.subAnnotations.map((item) => ({
          ...item,
          annotationsByMode: {
            ...(Object.fromEntries(
              Object.entries(item.annotationsByMode).map(([modeKey, modeAnnotation]) => [
                modeKey,
                {
                  ...modeAnnotation,
                  status: 'saved',
                  updatedAt: nextTimestamp,
                },
              ]),
            ) as Q2Task4SubAnnotation['annotationsByMode']),
            blind_human_scoring: {
              ...(item.annotationsByMode.blind_human_scoring ??
                createEmptyBlindModeAnnotation(ability)),
            status: 'saved',
            updatedAt: nextTimestamp,
          },
        },
      })),
    };

    setRecord(nextRecord);
    setValidationError('');
    onSave(nextRecord);
  };

  return (
    <Card className={annotationFormCardClass}>
      <CardHeader className={annotationFormHeaderClass}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-slate-900">标注面板</CardTitle>
            <CardDescription className="text-slate-600">
              Q2 任务4个性化利用审核表单，支持按查询分别标注。
            </CardDescription>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge variant="outline" className="border-slate-300 bg-slate-100 text-slate-700">
              {saveSummary}
            </Badge>
            <Badge variant="outline" className="border-slate-300 bg-white text-slate-700">
              {completedCount} / {record.subAnnotations.length} completed in this mode
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className={annotationFormContentClass}>
        <div className={annotationFormContextPanelClass}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-900">评估模式</p>
              <p className="text-xs leading-5 text-slate-500">
                Switch between visible judge alignment and blind human scoring.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Label className="text-sm text-slate-600">评审可见</Label>
              <Switch
                checked={mode === 'blind_human_scoring'}
                onCheckedChange={(checked) =>
                  onModeChange(checked ? 'blind_human_scoring' : 'judge_visible')
                }
              />
              <Label className="text-sm text-slate-600">盲评打分</Label>
            </div>
          </div>
        </div>

        <Tabs value={activeQueryId} onValueChange={setActiveQueryId} className="space-y-4">
          <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-slate-100/90 p-1.5 ring-1 ring-slate-200/40">
            {record.subAnnotations.map((item, index) => (
              <TabsTrigger
                key={item.queryId}
                value={item.queryId}
                className="min-w-[6rem] flex-none"
              >
                Query {index + 1}
              </TabsTrigger>
            ))}
          </TabsList>

          {record.subAnnotations.map((item, index) => {
            const seed = querySeeds.find((candidate) => candidate.queryId === item.queryId);
            const visible = item.annotationsByMode.judge_visible ?? createEmptyVisibleModeAnnotation();
            const blind =
              item.annotationsByMode.blind_human_scoring ?? createEmptyBlindModeAnnotation(ability);

            return (
              <TabsContent key={item.queryId} value={item.queryId} className="space-y-6">
                <div className={`space-y-3 ${annotationFormContextPanelClass}`}>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Active query
                    </p>
                    <div className="mt-2">
                      <TranslatedText
                        text={item.queryText}
                        translationEnabled
                        className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-800"
                      />
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Model response
                    </p>
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-800">
                      {item.responseText || '未找到模型回答。'}
                    </p>
                  </div>
                  <p className="text-xs text-slate-500">
                    Query ID: {item.queryId} | Slot {index + 1}
                  </p>
                </div>

                {mode === 'judge_visible' ? (
                  <>
                    {typeof seed?.judgeVisiblePayload !== 'undefined' ? (
                      <div className={annotationFormArtifactPanelClass}>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Visible judge payload
                        </p>
                        <pre className="mt-3 max-h-52 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-slate-950 p-4 text-xs leading-relaxed text-slate-100">
                          {JSON.stringify(seed.judgeVisiblePayload, null, 2)}
                        </pre>
                      </div>
                    ) : null}

                    <RadioField
                      label="Alignment verdict"
                      value={visible.alignmentVerdict}
                      options={ALIGNMENT_OPTIONS}
                      onChange={(value) =>
                        updateVisibleMode(item.queryId, {
                          alignmentVerdict: value as Q2Task4VisibleModeAnnotation['alignmentVerdict'],
                        })
                      }
                    />

                    <CheckboxField
                      label="问题类型"
                      values={visible.issueTypes}
                      options={ISSUE_TYPE_OPTIONS}
                      onChange={(issueTypes) => updateVisibleMode(item.queryId, { issueTypes })}
                    />

                    <TextAreaField
                      label="证据说明"
                      value={visible.evidenceNote ?? ''}
                      onChange={(evidenceNote) => updateVisibleMode(item.queryId, { evidenceNote })}
                      placeholder="Explain why the visible judge aligns or fails to align with human review."
                    />

                    <TextAreaField
                      label="修正建议"
                      value={visible.revisionSuggestion ?? ''}
                      onChange={(revisionSuggestion) =>
                        updateVisibleMode(item.queryId, { revisionSuggestion })
                      }
                      placeholder="Write the corrected human judgment if needed."
                    />
                  </>
                ) : (
                  <>
                    <NumberField
                      label="人工分数"
                      value={blind.humanScore}
                      onChange={(humanScore) => updateBlindMode(item.queryId, { humanScore })}
                    />

                    {ability === 'ability5' ? (
                      <div className="grid gap-4 sm:grid-cols-3">
                        {ABILITY5_DIMENSIONS.map((dimension) => (
                          <NumberField
                            key={dimension}
                            label={dimension[0].toUpperCase() + dimension.slice(1)}
                            value={blind.dimensionScores?.[dimension] ?? null}
                            onChange={(value) =>
                              updateBlindMode(item.queryId, {
                                dimensionScores: {
                                  ...(blind.dimensionScores ?? {}),
                                  [dimension]: value,
                                },
                              })
                            }
                          />
                        ))}
                      </div>
                    ) : null}

                    <TextAreaField
                      label="人工理由"
                      value={blind.humanRationale}
                      onChange={(humanRationale) =>
                        updateBlindMode(item.queryId, { humanRationale })
                      }
                      placeholder="Score the answer directly from the task requirement without visible judge output."
                    />
                  </>
                )}
              </TabsContent>
            );
          })}
        </Tabs>

        <TextAreaField
          label="Session-level annotator note"
          value={record.annotatorNote ?? ''}
          onChange={(annotatorNote) => setRecord((current) => withDraftMeta(current, { annotatorNote }))}
          placeholder="Optional note across all responses in this session."
        />

        <div className={annotationFormFooterClass}>
          {validationError ? (
            <div className={annotationValidationErrorClass}>{validationError}</div>
          ) : null}

          <div className="flex justify-end">
            <Button type="button" onClick={handleSave} className="rounded-xl px-6 shadow-sm">
              保存标注
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
