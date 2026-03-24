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
import type {
  EvaluationMode,
  Q2Task1AnnotationRecord,
  Q2Task1BlindModeAnnotation,
  Q2Task1ReviewItemAnnotation,
  Q2Task1VisibleModeAnnotation,
} from '../../types';
import {
  annotationFormCardClass,
  annotationFormContentClass,
  annotationFormContextPanelClass,
  annotationFormFooterClass,
  annotationFormHeaderClass,
  annotationValidationErrorClass,
  formatAnnotationSaveSummary,
  isBoundedInteger,
  useAnnotationDraftSync,
} from './annotationFormShell';
import { CheckboxField, NumberField, RadioField, TextAreaField } from './FormFields';

interface ReviewSeed {
  reviewKind: 'pair_reviews' | 'missing_reviews' | 'extra_reviews';
  reviewId: string;
  title: string;
  rationale: string;
}

const ALIGNMENT_OPTIONS = [
  { value: 'aligned', label: 'Aligned' },
  { value: 'partially_aligned', label: 'Partially aligned' },
  { value: 'not_aligned', label: 'Not aligned' },
];

const HUMAN_VERDICT_OPTIONS = [
  { value: 'supported', label: 'Supported' },
  { value: 'partially_supported', label: 'Partially supported' },
  { value: 'not_supported', label: 'Not supported' },
];

const ISSUE_TYPE_OPTIONS = [
  { value: 'ok_error', label: 'OK classification error' },
  { value: 'error_type_error', label: 'Error type error' },
  { value: 'severity_error', label: 'Severity error' },
  { value: 'missing_error', label: 'Missing review error' },
  { value: 'extra_error', label: 'Extra review error' },
  { value: 'algo_bias', label: 'Algorithm bias' },
  { value: 'other', label: 'Other' },
];

function createEmptyVisibleAnnotation(reviewSeeds: ReviewSeed[]): Q2Task1VisibleModeAnnotation {
  return {
    mode: 'judge_visible',
    status: 'draft',
    updatedAt: '',
    alignmentVerdict: 'aligned',
    issueTypes: [],
    evidenceNote: '',
    revisionSuggestion: '',
    annotatorNote: '',
    reviewItemAnnotations: reviewSeeds.map((seed) => ({
      reviewKind: seed.reviewKind,
      reviewId: seed.reviewId,
      humanVerdict: 'supported',
      note: '',
      suggestedCorrection: '',
    })),
  };
}

function createEmptyBlindAnnotation(): Q2Task1BlindModeAnnotation {
  return {
    mode: 'blind_human_scoring',
    status: 'draft',
    updatedAt: '',
    humanScore: 100,
    humanRationale: '',
    annotatorNote: '',
  };
}

function createEmptyRecord(reviewSeeds: ReviewSeed[]): Q2Task1AnnotationRecord {
  void reviewSeeds;
  return {
    formType: 'Q2:task1',
    status: 'draft',
    updatedAt: '',
    annotationsByMode: {},
  };
}

function mergeReviewSeeds(
  reviewSeeds: ReviewSeed[],
  existing?: Q2Task1VisibleModeAnnotation,
): Q2Task1VisibleModeAnnotation {
  const fallback = existing ?? createEmptyVisibleAnnotation(reviewSeeds);
  const byKey = new Map(
    fallback.reviewItemAnnotations.map((item) => [`${item.reviewKind}:${item.reviewId}`, item]),
  );

  return {
    ...fallback,
    reviewItemAnnotations: reviewSeeds.map((seed) => {
      const existingItem = byKey.get(`${seed.reviewKind}:${seed.reviewId}`);
      return (
        existingItem ?? {
          reviewKind: seed.reviewKind,
          reviewId: seed.reviewId,
          humanVerdict: 'supported',
          note: '',
          suggestedCorrection: '',
        }
      );
    }),
  };
}

interface Q2Task1FormProps {
  initialValue?: Q2Task1AnnotationRecord;
  mode: EvaluationMode;
  reviewSeeds: ReviewSeed[];
  onModeChange: (mode: EvaluationMode) => void;
  onDraftChange?: (annotation: Q2Task1AnnotationRecord) => void;
  onSave: (annotation: Q2Task1AnnotationRecord) => void;
}

export function Q2Task1Form({
  initialValue,
  mode,
  reviewSeeds,
  onModeChange,
  onDraftChange,
  onSave,
}: Q2Task1FormProps) {
  const startingValue = useMemo(() => initialValue ?? createEmptyRecord(reviewSeeds), [initialValue, reviewSeeds]);
  const [record, setRecord] = useState<Q2Task1AnnotationRecord>(startingValue);
  const [validationError, setValidationError] = useState('');

  const visibleAnnotation = mergeReviewSeeds(reviewSeeds, record.annotationsByMode.judge_visible);
  const blindAnnotation = record.annotationsByMode.blind_human_scoring ?? createEmptyBlindAnnotation();

  useAnnotationDraftSync(record, startingValue, onDraftChange);

  const saveSummary = useMemo(
    () => formatAnnotationSaveSummary(record.status, record.updatedAt),
    [record.status, record.updatedAt],
  );

  const updateVisibleAnnotation = (next: Q2Task1VisibleModeAnnotation) => {
    const updatedAt = new Date().toISOString();
    setRecord((current) => ({
      ...current,
      status: 'draft',
      updatedAt,
      annotationsByMode: {
        ...current.annotationsByMode,
        judge_visible: {
          ...next,
          status: 'draft',
          updatedAt,
        },
      },
    }));
  };

  const handleReviewItemChange = (
    reviewKind: Q2Task1ReviewItemAnnotation['reviewKind'],
    reviewId: string,
    patch: Partial<Q2Task1ReviewItemAnnotation>,
  ) => {
    const nextVisible: Q2Task1VisibleModeAnnotation = {
      ...visibleAnnotation,
      reviewItemAnnotations: visibleAnnotation.reviewItemAnnotations.map((item) =>
        item.reviewKind === reviewKind && item.reviewId === reviewId ? { ...item, ...patch } : item,
      ),
    };
    updateVisibleAnnotation(nextVisible);
  };

  const handleSave = () => {
    if (mode === 'judge_visible') {
      if (!visibleAnnotation.alignmentVerdict) {
        setValidationError('Alignment verdict is required in judge-visible mode.');
        return;
      }

      const nextTimestamp = new Date().toISOString();
      const nextVisible: Q2Task1VisibleModeAnnotation = {
        ...visibleAnnotation,
        status: 'saved',
        updatedAt: nextTimestamp,
      };
      const nextModes = Object.fromEntries(
        Object.entries(record.annotationsByMode).map(([modeKey, modeAnnotation]) => [
          modeKey,
          {
            ...modeAnnotation,
            status: 'saved',
            updatedAt: nextTimestamp,
          },
        ]),
      ) as Q2Task1AnnotationRecord['annotationsByMode'];

      const nextRecord: Q2Task1AnnotationRecord = {
        ...record,
        status: 'saved',
        updatedAt: nextTimestamp,
        annotationsByMode: {
          ...nextModes,
          judge_visible: nextVisible,
        },
      };

      setRecord(nextRecord);
      setValidationError('');
      onSave(nextRecord);
      return;
    }

    if (!isBoundedInteger(blindAnnotation.humanScore) || !blindAnnotation.humanRationale.trim()) {
      setValidationError('Human score must be an integer between 0 and 100, and rationale is required.');
      return;
    }

    const nextTimestamp = new Date().toISOString();
    const nextBlind: Q2Task1BlindModeAnnotation = {
      ...blindAnnotation,
      status: 'saved',
      updatedAt: nextTimestamp,
    };
    const nextModes = Object.fromEntries(
      Object.entries(record.annotationsByMode).map(([modeKey, modeAnnotation]) => [
        modeKey,
        {
          ...modeAnnotation,
          status: 'saved',
          updatedAt: nextTimestamp,
        },
      ]),
    ) as Q2Task1AnnotationRecord['annotationsByMode'];

    const nextRecord: Q2Task1AnnotationRecord = {
      ...record,
      status: 'saved',
      updatedAt: nextTimestamp,
      annotationsByMode: {
        ...nextModes,
        blind_human_scoring: nextBlind,
      },
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
            <CardTitle className="text-slate-900">Annotation panel</CardTitle>
            <CardDescription className="text-slate-600">
              Q2 Task 1 judge alignment review with extraction-specific review items.
            </CardDescription>
          </div>
          <Badge variant="outline" className="border-slate-300 bg-slate-100 text-slate-700">
            {saveSummary}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className={annotationFormContentClass}>
        <div className={annotationFormContextPanelClass}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-900">Evaluation mode</p>
              <p className="text-xs leading-5 text-slate-500">
                Switch between visible judge alignment and blind human scoring.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Label className="text-sm text-slate-600">Judge-visible</Label>
              <Switch
                checked={mode === 'blind_human_scoring'}
                onCheckedChange={(checked) =>
                  onModeChange(checked ? 'blind_human_scoring' : 'judge_visible')
                }
              />
              <Label className="text-sm text-slate-600">Blind scoring</Label>
            </div>
          </div>
        </div>

        {mode === 'judge_visible' ? (
          <>
            <RadioField
              label="Alignment verdict"
              value={visibleAnnotation.alignmentVerdict}
              options={ALIGNMENT_OPTIONS}
              onChange={(value) =>
                updateVisibleAnnotation({
                  ...visibleAnnotation,
                  alignmentVerdict: value as Q2Task1VisibleModeAnnotation['alignmentVerdict'],
                })
              }
            />

            <CheckboxField
              label="Issue types"
              values={visibleAnnotation.issueTypes}
              options={ISSUE_TYPE_OPTIONS}
              onChange={(issueTypes) =>
                updateVisibleAnnotation({
                  ...visibleAnnotation,
                  issueTypes,
                })
              }
            />

            <TextAreaField
              label="Evidence note"
              value={visibleAnnotation.evidenceNote ?? ''}
              onChange={(evidenceNote) =>
                updateVisibleAnnotation({
                  ...visibleAnnotation,
                  evidenceNote,
                })
              }
              placeholder="Explain why the judge aligns or fails to align with human judgment."
            />

            <TextAreaField
              label="Suggested correction"
              value={visibleAnnotation.revisionSuggestion ?? ''}
              onChange={(revisionSuggestion) =>
                updateVisibleAnnotation({
                  ...visibleAnnotation,
                  revisionSuggestion,
                })
              }
              placeholder="Write the corrected overall judgment if needed."
            />

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Review items</p>
              <div className="space-y-3">
                {reviewSeeds.map((seed) => {
                  const annotation =
                    visibleAnnotation.reviewItemAnnotations.find(
                      (item) => item.reviewKind === seed.reviewKind && item.reviewId === seed.reviewId,
                    ) ?? {
                      reviewKind: seed.reviewKind,
                      reviewId: seed.reviewId,
                      humanVerdict: '',
                      note: '',
                      suggestedCorrection: '',
                    };

                  return (
                    <div
                      key={`${seed.reviewKind}:${seed.reviewId}`}
                      className="rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-sm ring-1 ring-slate-200/25"
                    >
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="border-slate-300 bg-slate-100 text-slate-700">
                          {seed.reviewKind}
                        </Badge>
                        <span className="text-sm font-medium text-slate-900">{seed.title}</span>
                      </div>
                      <p className="mb-4 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">
                        {seed.rationale}
                      </p>

                      <RadioField
                        label="Human verdict on this review item"
                        value={annotation.humanVerdict}
                        options={HUMAN_VERDICT_OPTIONS}
                        onChange={(value) =>
                          handleReviewItemChange(seed.reviewKind, seed.reviewId, {
                            humanVerdict: value as Q2Task1ReviewItemAnnotation['humanVerdict'],
                          })
                        }
                      />

                      <div className="mt-4 space-y-4">
                        <TextAreaField
                          label="Item note"
                          value={annotation.note}
                          onChange={(note) =>
                            handleReviewItemChange(seed.reviewKind, seed.reviewId, { note })
                          }
                          placeholder="Explain your review of this item."
                        />
                        <TextAreaField
                          label="Suggested correction"
                          value={annotation.suggestedCorrection}
                          onChange={(suggestedCorrection) =>
                            handleReviewItemChange(seed.reviewKind, seed.reviewId, { suggestedCorrection })
                          }
                          placeholder="Optional correction for this item."
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <>
            <NumberField
              label="Human score"
              value={blindAnnotation.humanScore}
              onChange={(humanScore) =>
                setRecord((current) => ({
                  ...current,
                  status: 'draft',
                  updatedAt: new Date().toISOString(),
                  annotationsByMode: {
                    ...current.annotationsByMode,
                    blind_human_scoring: {
                      ...blindAnnotation,
                      status: 'draft',
                      updatedAt: new Date().toISOString(),
                      humanScore,
                    },
                  },
                }))
              }
            />

            <TextAreaField
              label="Human rationale"
              value={blindAnnotation.humanRationale}
              onChange={(humanRationale) =>
                setRecord((current) => ({
                  ...current,
                  status: 'draft',
                  updatedAt: new Date().toISOString(),
                  annotationsByMode: {
                    ...current.annotationsByMode,
                    blind_human_scoring: {
                      ...blindAnnotation,
                      status: 'draft',
                      updatedAt: new Date().toISOString(),
                      humanRationale,
                    },
                  },
                }))
              }
              placeholder="Score the model extraction without looking at the judge output."
            />
          </>
        )}

        <div className={annotationFormFooterClass}>
          {validationError ? (
            <div className={annotationValidationErrorClass}>{validationError}</div>
          ) : null}

          <div className="flex justify-end">
            <Button type="button" onClick={handleSave} className="rounded-xl px-6 shadow-sm">
              Save annotation
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
