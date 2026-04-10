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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import type { AbilityKey, Q1Task4Annotation, Q1Task4SubAnnotation } from '../../types';
import {
  annotationFormCardClass,
  annotationFormContentClass,
  annotationFormContextPanelClass,
  annotationFormFooterClass,
  annotationFormHeaderClass,
  annotationValidationErrorClass,
  formatAnnotationSaveSummary,
  useAnnotationDraftSync,
  withDraftMeta,
} from './annotationFormShell';
import { CheckboxField, RadioField, TextAreaField } from './FormFields';

interface QuerySeed {
  queryId: string;
  queryText: string;
}

const VERDICT_OPTIONS = [
  { value: 'reasonable', label: '合理' },
  { value: 'partially_reasonable', label: '部分合理' },
  { value: 'unreasonable', label: '不合理' },
];

const TERNARY_OPTIONS = [
  { value: 'yes', label: '是' },
  { value: 'partial', label: '部分' },
  { value: 'no', label: '否' },
];

const DEPENDENCY_OPTIONS = [
  { value: 'strong', label: '强' },
  { value: 'medium', label: '中' },
  { value: 'weak', label: '弱' },
];

const PURITY_OPTIONS = [
  { value: 'high', label: '高' },
  { value: 'medium', label: '中' },
  { value: 'low', label: '低' },
];

const ISSUE_TYPE_OPTIONS = [
  { value: 'ability_mismatch', label: '能力不匹配' },
  { value: 'memory_not_required', label: '记忆非必需' },
  { value: 'leakage', label: '信息泄漏' },
  { value: 'other', label: '其他' },
];

function createEmptySubAnnotation(seed: QuerySeed): Q1Task4SubAnnotation {
  return {
    queryId: seed.queryId,
    queryText: seed.queryText,
    overallVerdict: 'reasonable',
    testsTargetAbility: 'yes',
    memoryDependency: 'strong',
    abilityPurity: 'high',
    issueTypes: [],
    evidenceNote: '',
    revisionSuggestion: '',
  };
}

function createEmptyAnnotation(querySeeds: QuerySeed[], ability?: AbilityKey): Q1Task4Annotation {
  return {
    formType: 'Q1:task4',
    status: 'draft',
    updatedAt: '',
    ability,
    subAnnotations: querySeeds.map(createEmptySubAnnotation),
    annotatorNote: '',
  };
}

function mergeQuerySeeds(
  querySeeds: QuerySeed[],
  existing: Q1Task4Annotation | undefined,
  ability?: AbilityKey,
): Q1Task4Annotation {
  const fallback = existing ?? createEmptyAnnotation(querySeeds, ability);
  const byId = new Map(fallback.subAnnotations.map((item) => [item.queryId, item]));

  return {
    ...fallback,
    ability,
    subAnnotations: querySeeds.map((seed) => {
      const existingItem = byId.get(seed.queryId);
      return existingItem
        ? { ...existingItem, queryText: existingItem.queryText || seed.queryText }
        : createEmptySubAnnotation(seed);
    }),
  };
}

interface Q1Task4FormProps {
  ability?: AbilityKey;
  initialValue?: Q1Task4Annotation;
  querySeeds: QuerySeed[];
  onDraftChange?: (annotation: Q1Task4Annotation) => void;
  onSave: (annotation: Q1Task4Annotation) => void;
}

export function Q1Task4Form({ ability, initialValue, querySeeds, onDraftChange, onSave }: Q1Task4FormProps) {
  const startingValue = useMemo(
    () => mergeQuerySeeds(querySeeds, initialValue, ability),
    [ability, initialValue, querySeeds],
  );
  const [formState, setFormState] = useState<Q1Task4Annotation>(startingValue);
  const [activeQueryId, setActiveQueryId] = useState(querySeeds[0]?.queryId ?? 'query-1');
  const [validationError, setValidationError] = useState('');
  const [isEditingQuery, setIsEditingQuery] = useState(false);

  useAnnotationDraftSync(formState, startingValue, onDraftChange);

  const saveSummary = useMemo(
    () => formatAnnotationSaveSummary(formState.status, formState.updatedAt),
    [formState.status, formState.updatedAt],
  );

  const completionCount = formState.subAnnotations.filter((item) => item.overallVerdict).length;

  const updateSubAnnotation = (queryId: string, patch: Partial<Q1Task4SubAnnotation>) => {
    setFormState((current) => ({
      ...withDraftMeta(current, {}),
      subAnnotations: current.subAnnotations.map((item) =>
        item.queryId === queryId ? { ...item, ...patch } : item,
      ),
    }));
  };

  const handleSave = () => {
    const incompleteQuery = formState.subAnnotations.find((item) => !item.overallVerdict);
    if (incompleteQuery) {
      setValidationError('Complete the overall verdict for every query before saving.');
      setActiveQueryId(incompleteQuery.queryId);
      return;
    }

    const needsDetail = formState.subAnnotations.find(
      (item) =>
        item.overallVerdict !== 'reasonable' &&
        item.issueTypes.length === 0 &&
        !item.revisionSuggestion.trim(),
    );

    if (needsDetail) {
      setValidationError('Add at least one issue type or a revision suggestion for each non-reasonable query.');
      setActiveQueryId(needsDetail.queryId);
      return;
    }

    const nextAnnotation: Q1Task4Annotation = {
      ...formState,
      status: 'saved',
      updatedAt: new Date().toISOString(),
    };

    setFormState(nextAnnotation);
    setValidationError('');
    onSave(nextAnnotation);
  };

  return (
    <Card className={annotationFormCardClass}>
      <CardHeader className={annotationFormHeaderClass}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-slate-900">标注面板</CardTitle>
            <CardDescription className="text-slate-600">
              Q1 任务4能力匹配审核表单，支持按查询分别标注。
            </CardDescription>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge variant="outline" className="border-slate-300 bg-slate-100 text-slate-700">
              {saveSummary}
            </Badge>
            <Badge variant="outline" className="border-slate-300 bg-white text-slate-700">
              {completionCount} / {formState.subAnnotations.length} queries completed
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className={annotationFormContentClass}>
        <Tabs value={activeQueryId} onValueChange={setActiveQueryId} className="space-y-4">
          <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-slate-100/90 p-1.5 ring-1 ring-slate-200/40">
            {formState.subAnnotations.map((item, index) => (
              <TabsTrigger
                key={item.queryId}
                value={item.queryId}
                className="min-w-[6rem] flex-none"
              >
                Query {index + 1}
              </TabsTrigger>
            ))}
          </TabsList>

          {formState.subAnnotations.map((item, index) => (
            <TabsContent key={item.queryId} value={item.queryId} className="space-y-6">
              <div className={annotationFormContextPanelClass}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Active query
                    </p>
                    <p className="mt-3 text-xs text-slate-500">
                      Query ID: {item.queryId} | Slot {index + 1}
                    </p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => setIsEditingQuery((value) => !value)}>
                    {isEditingQuery ? 'Hide editing' : 'Edit query'}
                  </Button>
                </div>
                <div className="mt-3 space-y-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">原始查询</p>
                    <div className="mt-2 rounded-xl border border-slate-200 bg-white/80 p-3 text-sm leading-6 text-slate-800">
                      {querySeeds.find((seed) => seed.queryId === item.queryId)?.queryText ?? item.queryText}
                    </div>
                  </div>
                  {isEditingQuery ||
                  item.queryText !==
                    (querySeeds.find((seed) => seed.queryId === item.queryId)?.queryText ?? item.queryText) ? (
                    <TextAreaField
                      label="修改后的查询"
                      value={item.queryText}
                      onChange={(queryText) => updateSubAnnotation(item.queryId, { queryText })}
                      placeholder="Revise the ability query if needed."
                    />
                  ) : null}
                </div>
              </div>

              <RadioField
                label="总体结论"
                value={item.overallVerdict}
                options={VERDICT_OPTIONS}
                onChange={(value) =>
                  updateSubAnnotation(item.queryId, {
                    overallVerdict: value as Q1Task4SubAnnotation['overallVerdict'],
                  })
                }
              />

              <RadioField
                label="Does this query test the target ability?"
                value={item.testsTargetAbility}
                options={TERNARY_OPTIONS}
                onChange={(value) =>
                  updateSubAnnotation(item.queryId, {
                    testsTargetAbility: value as Q1Task4SubAnnotation['testsTargetAbility'],
                  })
                }
              />

              <RadioField
                label="How strongly does it depend on the intended memory?"
                value={item.memoryDependency}
                options={DEPENDENCY_OPTIONS}
                onChange={(value) =>
                  updateSubAnnotation(item.queryId, {
                    memoryDependency: value as Q1Task4SubAnnotation['memoryDependency'],
                  })
                }
              />

              <RadioField
                label="Ability purity"
                value={item.abilityPurity}
                options={PURITY_OPTIONS}
                onChange={(value) =>
                  updateSubAnnotation(item.queryId, {
                    abilityPurity: value as Q1Task4SubAnnotation['abilityPurity'],
                  })
                }
              />

              <CheckboxField
                label="问题类型"
                values={item.issueTypes}
                options={ISSUE_TYPE_OPTIONS}
                onChange={(issueTypes) => updateSubAnnotation(item.queryId, { issueTypes })}
              />

              <TextAreaField
                label="证据说明"
                value={item.evidenceNote}
                onChange={(evidenceNote) => updateSubAnnotation(item.queryId, { evidenceNote })}
                placeholder="Explain why the query does or does not fit the intended ability."
              />

              <TextAreaField
                label="Revision suggestion"
                value={item.revisionSuggestion}
                onChange={(revisionSuggestion) =>
                  updateSubAnnotation(item.queryId, { revisionSuggestion })
                }
                placeholder="Suggest how to improve the ability probe if needed."
              />
            </TabsContent>
          ))}
        </Tabs>

        <TextAreaField
          label="Session-level annotator note"
          value={formState.annotatorNote ?? ''}
          onChange={(annotatorNote) => setFormState((current) => withDraftMeta(current, { annotatorNote }))}
          placeholder="Optional note across all queries in this session."
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
