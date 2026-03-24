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
import { Switch } from '../../../components/ui/switch';
import { Label } from '../../../components/ui/label';
import type {
  EvaluationMode,
  Q2Task3AnnotationRecord,
  Q2Task3BlindModeAnnotation,
  Q2Task3VisibleModeAnnotation,
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

const ALIGNMENT_OPTIONS = [
  { value: 'aligned', label: 'Aligned' },
  { value: 'partially_aligned', label: 'Partially aligned' },
  { value: 'not_aligned', label: 'Not aligned' },
];

const TERNARY_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'partial', label: 'Partial' },
  { value: 'no', label: 'No' },
];

const BINARY_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
];

const USED_MEMORY_OPTIONS = [
  { value: 'used', label: 'Used' },
  { value: 'not_used', label: 'Not used' },
  { value: 'uncertain', label: 'Uncertain' },
];

const ISSUE_TYPE_OPTIONS = [
  { value: 'used_memory_error', label: 'Used memory error' },
  { value: 'score_error', label: 'Score error' },
  { value: 'unsupported_reason', label: 'Unsupported reason' },
  { value: 'inconsistency', label: 'Inconsistency' },
  { value: 'other', label: 'Other' },
];

function createEmptyVisibleAnnotation(): Q2Task3VisibleModeAnnotation {
  return {
    mode: 'judge_visible',
    status: 'draft',
    updatedAt: '',
    alignmentVerdict: 'aligned',
    usedMemoryCorrect: 'yes',
    scoreReasonable: 'yes',
    reasonSupportsJudgment: 'yes',
    scoreConsistentWithUsedMemory: 'yes',
    issueTypes: [],
    evidenceNote: '',
    revisionSuggestion: '',
    annotatorNote: '',
  };
}

function createEmptyBlindAnnotation(): Q2Task3BlindModeAnnotation {
  return {
    mode: 'blind_human_scoring',
    status: 'draft',
    updatedAt: '',
    humanScore: 100,
    usedMemoryHumanJudgment: 'used',
    humanRationale: '',
    annotatorNote: '',
  };
}

function createEmptyRecord(): Q2Task3AnnotationRecord {
  return {
    formType: 'Q2:task3',
    status: 'draft',
    updatedAt: '',
    annotationsByMode: {},
  };
}

interface Q2Task3FormProps {
  initialValue?: Q2Task3AnnotationRecord;
  mode: EvaluationMode;
  onModeChange: (mode: EvaluationMode) => void;
  onDraftChange?: (annotation: Q2Task3AnnotationRecord) => void;
  onSave: (annotation: Q2Task3AnnotationRecord) => void;
}

export function Q2Task3Form({
  initialValue,
  mode,
  onModeChange,
  onDraftChange,
  onSave,
}: Q2Task3FormProps) {
  const startingValue = useMemo(() => initialValue ?? createEmptyRecord(), [initialValue]);
  const [record, setRecord] = useState<Q2Task3AnnotationRecord>(startingValue);
  const [validationError, setValidationError] = useState('');

  const visibleAnnotation = record.annotationsByMode.judge_visible ?? createEmptyVisibleAnnotation();
  const blindAnnotation = record.annotationsByMode.blind_human_scoring ?? createEmptyBlindAnnotation();

  useAnnotationDraftSync(record, startingValue, onDraftChange);

  const saveSummary = useMemo(
    () => formatAnnotationSaveSummary(record.status, record.updatedAt),
    [record.status, record.updatedAt],
  );

  const updateVisibleAnnotation = (patch: Partial<Q2Task3VisibleModeAnnotation>) => {
    const updatedAt = new Date().toISOString();
    setRecord((current) => ({
      ...current,
      status: 'draft',
      updatedAt,
      annotationsByMode: {
        ...current.annotationsByMode,
        judge_visible: {
          ...(current.annotationsByMode.judge_visible ?? createEmptyVisibleAnnotation()),
          ...patch,
          status: 'draft',
          updatedAt,
        },
      },
    }));
  };

  const updateBlindAnnotation = (patch: Partial<Q2Task3BlindModeAnnotation>) => {
    const updatedAt = new Date().toISOString();
    setRecord((current) => ({
      ...current,
      status: 'draft',
      updatedAt,
      annotationsByMode: {
        ...current.annotationsByMode,
        blind_human_scoring: {
          ...(current.annotationsByMode.blind_human_scoring ?? createEmptyBlindAnnotation()),
          ...patch,
          status: 'draft',
          updatedAt,
        },
      },
    }));
  };

  const handleSave = () => {
    if (mode === 'judge_visible') {
      if (!visibleAnnotation.alignmentVerdict) {
        setValidationError('Alignment verdict is required in judge-visible mode.');
        return;
      }

      const nextTimestamp = new Date().toISOString();
      const nextVisible: Q2Task3VisibleModeAnnotation = {
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
      ) as Q2Task3AnnotationRecord['annotationsByMode'];

      const nextRecord: Q2Task3AnnotationRecord = {
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
    const nextBlind: Q2Task3BlindModeAnnotation = {
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
    ) as Q2Task3AnnotationRecord['annotationsByMode'];

    const nextRecord: Q2Task3AnnotationRecord = {
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
              Q2 Task 3 judge alignment review with dual evaluation modes.
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
                  alignmentVerdict: value as Q2Task3VisibleModeAnnotation['alignmentVerdict'],
                })
              }
            />

            <RadioField
              label="Did the judge correctly identify memory usage?"
              value={visibleAnnotation.usedMemoryCorrect}
              options={BINARY_OPTIONS}
              onChange={(value) =>
                updateVisibleAnnotation({
                  usedMemoryCorrect: value as Q2Task3VisibleModeAnnotation['usedMemoryCorrect'],
                })
              }
            />

            <RadioField
              label="Is the score reasonable?"
              value={visibleAnnotation.scoreReasonable}
              options={TERNARY_OPTIONS}
              onChange={(value) =>
                updateVisibleAnnotation({
                  scoreReasonable: value as Q2Task3VisibleModeAnnotation['scoreReasonable'],
                })
              }
            />

            <RadioField
              label="Does the judge reason support the judgment?"
              value={visibleAnnotation.reasonSupportsJudgment}
              options={TERNARY_OPTIONS}
              onChange={(value) =>
                updateVisibleAnnotation({
                  reasonSupportsJudgment:
                    value as Q2Task3VisibleModeAnnotation['reasonSupportsJudgment'],
                })
              }
            />

            <RadioField
              label="Is the score consistent with the used-memory decision?"
              value={visibleAnnotation.scoreConsistentWithUsedMemory}
              options={BINARY_OPTIONS}
              onChange={(value) =>
                updateVisibleAnnotation({
                  scoreConsistentWithUsedMemory:
                    value as Q2Task3VisibleModeAnnotation['scoreConsistentWithUsedMemory'],
                })
              }
            />

            <CheckboxField
              label="Issue types"
              values={visibleAnnotation.issueTypes}
              options={ISSUE_TYPE_OPTIONS}
              onChange={(issueTypes) => updateVisibleAnnotation({ issueTypes })}
            />

            <TextAreaField
              label="Evidence note"
              value={visibleAnnotation.evidenceNote ?? ''}
              onChange={(evidenceNote) => updateVisibleAnnotation({ evidenceNote })}
              placeholder="Explain why the judge is aligned or misaligned."
            />

            <TextAreaField
              label="Suggested correction"
              value={visibleAnnotation.revisionSuggestion ?? ''}
              onChange={(revisionSuggestion) => updateVisibleAnnotation({ revisionSuggestion })}
              placeholder="Write the corrected human judgment if needed."
            />
          </>
        ) : (
          <>
            <NumberField
              label="Human score"
              value={blindAnnotation.humanScore}
              onChange={(humanScore) => updateBlindAnnotation({ humanScore })}
            />

            <RadioField
              label="Human judgment on memory usage"
              value={blindAnnotation.usedMemoryHumanJudgment}
              options={USED_MEMORY_OPTIONS}
              onChange={(value) =>
                updateBlindAnnotation({
                  usedMemoryHumanJudgment:
                    value as Q2Task3BlindModeAnnotation['usedMemoryHumanJudgment'],
                })
              }
            />

            <TextAreaField
              label="Human rationale"
              value={blindAnnotation.humanRationale}
              onChange={(humanRationale) => updateBlindAnnotation({ humanRationale })}
              placeholder="Give your independent reasoning without relying on the visible judge output."
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
