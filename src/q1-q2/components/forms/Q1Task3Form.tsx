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
import type { Q1Task3Annotation } from '../../types';
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
import { RadioField, TextAreaField } from './FormFields';

const RELEVANCE_OPTIONS = [
  { value: 'strong', label: 'Strong' },
  { value: 'medium', label: 'Medium' },
  { value: 'weak', label: 'Weak' },
  { value: 'irrelevant', label: 'Irrelevant' },
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

function createEmptyAnnotation(): Q1Task3Annotation {
  return {
    formType: 'Q1:task3',
    status: 'draft',
    updatedAt: '',
    queryText: '',
    relevanceLevel: 'strong',
    hardWithoutTargetMemory: 'yes',
    answerableByCommonSense: 'no',
    multipleMemoriesCouldSupport: 'no',
    evidenceNote: '',
    revisionSuggestion: '',
    annotatorNote: '',
  };
}

interface Q1Task3FormProps {
  initialValue?: Q1Task3Annotation;
  querySeed: string;
  onDraftChange?: (annotation: Q1Task3Annotation) => void;
  onSave: (annotation: Q1Task3Annotation) => void;
}

function createAnnotationFromSeed(querySeed: string, initialValue?: Q1Task3Annotation): Q1Task3Annotation {
  const fallback = initialValue ?? createEmptyAnnotation();
  return {
    ...fallback,
    queryText: fallback.queryText || querySeed,
  };
}

export function Q1Task3Form({ initialValue, querySeed, onDraftChange, onSave }: Q1Task3FormProps) {
  const startingValue = useMemo(() => createAnnotationFromSeed(querySeed, initialValue), [initialValue, querySeed]);
  const [formState, setFormState] = useState<Q1Task3Annotation>(startingValue);
  const [validationError, setValidationError] = useState('');
  const [isEditingQuery, setIsEditingQuery] = useState(false);

  useAnnotationDraftSync(formState, startingValue, onDraftChange);

  const saveSummary = useMemo(
    () => formatAnnotationSaveSummary(formState.status, formState.updatedAt),
    [formState.status, formState.updatedAt],
  );

  const handleSave = () => {
    if (!formState.relevanceLevel) {
      setValidationError('Relevance level is required.');
      return;
    }

    const nextAnnotation: Q1Task3Annotation = {
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
              Q1 Task 3 query-to-memory relevance review form.
            </CardDescription>
          </div>
          <Badge variant="outline" className="border-slate-300 bg-slate-100 text-slate-700">
            {saveSummary}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className={annotationFormContentClass}>
        <div className={annotationFormContextPanelClass}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Editable query under review</p>
              <p className="text-xs leading-5 text-slate-500">
                Keep the original query visible, and revise it only if the generated wording is weak.
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setIsEditingQuery((value) => !value)}>
              {isEditingQuery ? 'Hide editing' : 'Edit query'}
            </Button>
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Original query</p>
              <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                {querySeed}
              </div>
            </div>

            {isEditingQuery || formState.queryText !== querySeed ? (
              <TextAreaField
                label="Edited query"
                value={formState.queryText}
                onChange={(queryText) => setFormState((current) => withDraftMeta(current, { queryText }))}
                placeholder="Revise the query if needed."
              />
            ) : null}
          </div>
        </div>

        <RadioField
          label="Relevance level"
          value={formState.relevanceLevel}
          options={RELEVANCE_OPTIONS}
          onChange={(value) =>
            setFormState((current) => ({
              ...withDraftMeta(current, {}),
              relevanceLevel: value as Q1Task3Annotation['relevanceLevel'],
            }))
          }
        />

        <RadioField
          label="Would the query be hard without the target memory?"
          value={formState.hardWithoutTargetMemory}
          options={TERNARY_OPTIONS}
          onChange={(value) =>
            setFormState((current) => ({
              ...withDraftMeta(current, {}),
              hardWithoutTargetMemory: value as Q1Task3Annotation['hardWithoutTargetMemory'],
            }))
          }
        />

        <RadioField
          label="Could the query be answered by common sense alone?"
          value={formState.answerableByCommonSense}
          options={BINARY_OPTIONS}
          onChange={(value) =>
            setFormState((current) => ({
              ...withDraftMeta(current, {}),
              answerableByCommonSense: value as Q1Task3Annotation['answerableByCommonSense'],
            }))
          }
        />

        <RadioField
          label="Could multiple memories support this query?"
          value={formState.multipleMemoriesCouldSupport}
          options={BINARY_OPTIONS}
          onChange={(value) =>
            setFormState((current) => ({
              ...withDraftMeta(current, {}),
              multipleMemoriesCouldSupport:
                value as Q1Task3Annotation['multipleMemoriesCouldSupport'],
            }))
          }
        />

        <TextAreaField
          label="Evidence note"
          value={formState.evidenceNote ?? ''}
          onChange={(evidenceNote) => setFormState((current) => withDraftMeta(current, { evidenceNote }))}
          placeholder="Explain why the selected memory is or is not essential for the query."
        />

        <TextAreaField
          label="Revision suggestion"
          value={formState.revisionSuggestion ?? ''}
          onChange={(revisionSuggestion) => setFormState((current) => withDraftMeta(current, { revisionSuggestion }))}
          placeholder="Suggest how to sharpen the query-memory pairing if needed."
        />

        <TextAreaField
          label="Annotator note"
          value={formState.annotatorNote ?? ''}
          onChange={(annotatorNote) => setFormState((current) => withDraftMeta(current, { annotatorNote }))}
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
