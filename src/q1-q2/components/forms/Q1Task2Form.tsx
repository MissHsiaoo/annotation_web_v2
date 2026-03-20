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
import type { Q1Task2Annotation } from '../../types';
import {
  annotationFormCardClass,
  annotationFormContentClass,
  annotationFormFooterClass,
  annotationFormHeaderClass,
  annotationValidationErrorClass,
} from './annotationFormShell';
import { CheckboxField, RadioField, TextAreaField } from './FormFields';

const VERDICT_OPTIONS = [
  { value: 'reasonable', label: 'Reasonable' },
  { value: 'partially_reasonable', label: 'Partially reasonable' },
  { value: 'unreasonable', label: 'Unreasonable' },
];

const ACTION_OPTIONS = [
  { value: 'retention', label: 'Retention' },
  { value: 'addition', label: 'Addition' },
  { value: 'modification', label: 'Modification' },
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

const ISSUE_TYPE_OPTIONS = [
  { value: 'insufficient_signal', label: 'Insufficient signal' },
  { value: 'wrong_update', label: 'Wrong update' },
  { value: 'over_update', label: 'Over-update' },
  { value: 'unrelated_memory_changed', label: 'Unrelated memory changed' },
  { value: 'other', label: 'Other' },
];

function createEmptyAnnotation(): Q1Task2Annotation {
  return {
    formType: 'Q1:task2',
    status: 'draft',
    updatedAt: '',
    overallVerdict: '',
    expectedAction: '',
    newDialogueContainsUpdateSignal: '',
    goldUpdateReasonable: '',
    changedOnlyRelevantMemory: '',
    issueTypes: [],
    evidenceNote: '',
    revisionSuggestion: '',
    annotatorNote: '',
  };
}

interface Q1Task2FormProps {
  initialValue?: Q1Task2Annotation;
  onSave: (annotation: Q1Task2Annotation) => void;
}

export function Q1Task2Form({ initialValue, onSave }: Q1Task2FormProps) {
  const [formState, setFormState] = useState<Q1Task2Annotation>(initialValue ?? createEmptyAnnotation());
  const [validationError, setValidationError] = useState('');

  const saveSummary = useMemo(() => {
    if (formState.updatedAt) {
      return `Saved at ${new Date(formState.updatedAt).toLocaleString()}`;
    }

    return 'Not saved yet';
  }, [formState.updatedAt]);

  const handleSave = () => {
    if (!formState.overallVerdict) {
      setValidationError('Overall verdict is required.');
      return;
    }

    if (!formState.expectedAction) {
      setValidationError('Expected action is required.');
      return;
    }

    if (
      formState.overallVerdict !== 'reasonable' &&
      formState.issueTypes.length === 0 &&
      !formState.revisionSuggestion?.trim()
    ) {
      setValidationError('Add at least one issue type or a revision suggestion for non-reasonable cases.');
      return;
    }

    const nextAnnotation: Q1Task2Annotation = {
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
            <CardTitle className="text-slate-900">Annotation panel</CardTitle>
            <CardDescription className="text-slate-600">
              Q1 Task 2 benchmark update review form.
            </CardDescription>
          </div>
          <Badge variant="outline" className="border-slate-300 bg-slate-100 text-slate-700">
            {saveSummary}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className={annotationFormContentClass}>
        <RadioField
          label="Overall verdict"
          value={formState.overallVerdict}
          options={VERDICT_OPTIONS}
          onChange={(value) => setFormState((current) => ({ ...current, overallVerdict: value as Q1Task2Annotation['overallVerdict'] }))}
        />

        <RadioField
          label="Expected action"
          value={formState.expectedAction}
          options={ACTION_OPTIONS}
          onChange={(value) => setFormState((current) => ({ ...current, expectedAction: value as Q1Task2Annotation['expectedAction'] }))}
        />

        <RadioField
          label="Does the new dialogue contain a true update signal?"
          value={formState.newDialogueContainsUpdateSignal}
          options={TERNARY_OPTIONS}
          onChange={(value) => setFormState((current) => ({ ...current, newDialogueContainsUpdateSignal: value as Q1Task2Annotation['newDialogueContainsUpdateSignal'] }))}
        />

        <RadioField
          label="Is the gold update reasonable?"
          value={formState.goldUpdateReasonable}
          options={TERNARY_OPTIONS}
          onChange={(value) => setFormState((current) => ({ ...current, goldUpdateReasonable: value as Q1Task2Annotation['goldUpdateReasonable'] }))}
        />

        <RadioField
          label="Did the benchmark change only relevant memory?"
          value={formState.changedOnlyRelevantMemory}
          options={BINARY_OPTIONS}
          onChange={(value) => setFormState((current) => ({ ...current, changedOnlyRelevantMemory: value as Q1Task2Annotation['changedOnlyRelevantMemory'] }))}
        />

        <CheckboxField
          label="Issue types"
          values={formState.issueTypes}
          options={ISSUE_TYPE_OPTIONS}
          onChange={(issueTypes) => setFormState((current) => ({ ...current, issueTypes }))}
        />

        <TextAreaField
          label="Evidence note"
          value={formState.evidenceNote ?? ''}
          onChange={(evidenceNote) => setFormState((current) => ({ ...current, evidenceNote }))}
          placeholder="Explain what in the new dialogue supports or weakens the update."
        />

        <TextAreaField
          label="Revision suggestion"
          value={formState.revisionSuggestion ?? ''}
          onChange={(revisionSuggestion) => setFormState((current) => ({ ...current, revisionSuggestion }))}
          placeholder="Suggest how to revise the benchmark update if needed."
        />

        <TextAreaField
          label="Annotator note"
          value={formState.annotatorNote ?? ''}
          onChange={(annotatorNote) => setFormState((current) => ({ ...current, annotatorNote }))}
          placeholder="Optional extra note."
        />

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
