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
import type { Q1Task1Annotation } from '../../types';
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
  { value: 'no_evidence', label: 'No evidence' },
  { value: 'over_inference', label: 'Over-inference' },
  { value: 'inaccurate_wording', label: 'Inaccurate wording' },
  { value: 'other', label: 'Other' },
];

interface Q1Task1FormProps {
  initialValue?: Q1Task1Annotation;
  onSave: (annotation: Q1Task1Annotation) => void;
}

function createEmptyAnnotation(): Q1Task1Annotation {
  return {
    formType: 'Q1:task1',
    status: 'draft',
    updatedAt: '',
    overallVerdict: '',
    hasDialogueEvidence: '',
    overInference: '',
    faithfulToOriginalMeaning: '',
    issueTypes: [],
    evidenceNote: '',
    revisionSuggestion: '',
    annotatorNote: '',
  };
}

export function Q1Task1Form({ initialValue, onSave }: Q1Task1FormProps) {
  const [formState, setFormState] = useState<Q1Task1Annotation>(initialValue ?? createEmptyAnnotation());
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

    if (
      formState.overallVerdict !== 'reasonable' &&
      formState.issueTypes.length === 0 &&
      !formState.revisionSuggestion?.trim()
    ) {
      setValidationError('Add at least one issue type or a revision suggestion for non-reasonable cases.');
      return;
    }

    const nextAnnotation: Q1Task1Annotation = {
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
              Q1 Task 1 benchmark construction review form.
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
          onChange={(value) => setFormState((current) => ({ ...current, overallVerdict: value as Q1Task1Annotation['overallVerdict'] }))}
        />

        <RadioField
          label="Does the memory have dialogue evidence?"
          value={formState.hasDialogueEvidence}
          options={TERNARY_OPTIONS}
          onChange={(value) => setFormState((current) => ({ ...current, hasDialogueEvidence: value as Q1Task1Annotation['hasDialogueEvidence'] }))}
        />

        <RadioField
          label="Does the memory over-infer?"
          value={formState.overInference}
          options={BINARY_OPTIONS}
          onChange={(value) => setFormState((current) => ({ ...current, overInference: value as Q1Task1Annotation['overInference'] }))}
        />

        <RadioField
          label="Is the memory faithful to the original meaning?"
          value={formState.faithfulToOriginalMeaning}
          options={TERNARY_OPTIONS}
          onChange={(value) => setFormState((current) => ({ ...current, faithfulToOriginalMeaning: value as Q1Task1Annotation['faithfulToOriginalMeaning'] }))}
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
          placeholder="Explain which part of the dialogue supports or conflicts with the memory."
        />

        <TextAreaField
          label="Revision suggestion"
          value={formState.revisionSuggestion ?? ''}
          onChange={(revisionSuggestion) => setFormState((current) => ({ ...current, revisionSuggestion }))}
          placeholder="Suggest how to revise the benchmark item if needed."
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
