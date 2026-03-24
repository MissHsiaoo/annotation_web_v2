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
import type { Q1Task2Annotation } from '../../types';
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

interface DialogueSeed {
  turnId: string;
  role: string;
  text: string;
}

interface MemorySeed {
  memoryId: string;
  value: string;
}

function createEmptyAnnotation(
  newDialogueSeed: DialogueSeed[],
  updatedMemorySeed: MemorySeed[],
): Q1Task2Annotation {
  return {
    formType: 'Q1:task2',
    status: 'draft',
    updatedAt: '',
    overallVerdict: 'reasonable',
    expectedAction: '',
    newDialogueContainsUpdateSignal: 'yes',
    goldUpdateReasonable: 'yes',
    changedOnlyRelevantMemory: 'yes',
    editableNewDialogue: newDialogueSeed.map((item) => ({ ...item })),
    editableUpdatedMemories: updatedMemorySeed.map((item) => ({ ...item })),
    issueTypes: [],
    evidenceNote: '',
    revisionSuggestion: '',
    annotatorNote: '',
  };
}

function mergeSeeds(
  newDialogueSeed: DialogueSeed[],
  updatedMemorySeed: MemorySeed[],
  existing?: Q1Task2Annotation,
): Q1Task2Annotation {
  const fallback = existing ?? createEmptyAnnotation(newDialogueSeed, updatedMemorySeed);
  const dialogueById = new Map(fallback.editableNewDialogue.map((item) => [item.turnId, item]));
  const memoryById = new Map(fallback.editableUpdatedMemories.map((item) => [item.memoryId, item]));

  return {
    ...fallback,
    editableNewDialogue: newDialogueSeed.map((seed) => ({
      ...seed,
      ...(dialogueById.get(seed.turnId) ?? {}),
    })),
    editableUpdatedMemories: updatedMemorySeed.map((seed) => ({
      ...seed,
      ...(memoryById.get(seed.memoryId) ?? {}),
    })),
  };
}

interface Q1Task2FormProps {
  initialValue?: Q1Task2Annotation;
  newDialogueSeed: DialogueSeed[];
  updatedMemorySeed: MemorySeed[];
  onDraftChange?: (annotation: Q1Task2Annotation) => void;
  onSave: (annotation: Q1Task2Annotation) => void;
}

export function Q1Task2Form({
  initialValue,
  newDialogueSeed,
  updatedMemorySeed,
  onDraftChange,
  onSave,
}: Q1Task2FormProps) {
  const startingValue = useMemo(
    () => mergeSeeds(newDialogueSeed, updatedMemorySeed, initialValue),
    [initialValue, newDialogueSeed, updatedMemorySeed],
  );
  const [formState, setFormState] = useState<Q1Task2Annotation>(startingValue);
  const [validationError, setValidationError] = useState('');
  const [isEditingDialogue, setIsEditingDialogue] = useState(false);
  const [isEditingMemory, setIsEditingMemory] = useState(false);

  useAnnotationDraftSync(formState, startingValue, onDraftChange);

  const saveSummary = useMemo(
    () => formatAnnotationSaveSummary(formState.status, formState.updatedAt),
    [formState.status, formState.updatedAt],
  );

  const hasDialogueEdits = useMemo(
    () =>
      formState.editableNewDialogue.some((item) => {
        const original = newDialogueSeed.find((seed) => seed.turnId === item.turnId);
        return original ? original.text !== item.text : false;
      }),
    [formState.editableNewDialogue, newDialogueSeed],
  );

  const hasMemoryEdits = useMemo(
    () =>
      formState.editableUpdatedMemories.some((item) => {
        const original = updatedMemorySeed.find((seed) => seed.memoryId === item.memoryId);
        return original ? original.value !== item.value : false;
      }),
    [formState.editableUpdatedMemories, updatedMemorySeed],
  );

  const updateDialogueTurn = (turnId: string, text: string) => {
    setFormState((current) => ({
      ...withDraftMeta(current, {}),
      editableNewDialogue: current.editableNewDialogue.map((item) =>
        item.turnId === turnId ? { ...item, text } : item,
      ),
    }));
  };

  const updateMemoryValue = (memoryId: string, value: string) => {
    setFormState((current) => ({
      ...withDraftMeta(current, {}),
      editableUpdatedMemories: current.editableUpdatedMemories.map((item) =>
        item.memoryId === memoryId ? { ...item, value } : item,
      ),
    }));
  };

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
        <div className={annotationFormContextPanelClass}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Editable reviewed content</p>
              <p className="text-xs leading-5 text-slate-500">
                Keep the original sample visible, and revise only the generated dialogue or memory when needed.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="border-slate-300 bg-white text-slate-700">
                Dialogue {hasDialogueEdits ? 'edited' : 'unchanged'}
              </Badge>
              <Badge variant="outline" className="border-slate-300 bg-white text-slate-700">
                Memory {hasMemoryEdits ? 'edited' : 'unchanged'}
              </Badge>
            </div>
          </div>
        </div>

        <div className={annotationFormContextPanelClass}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">New dialogue under review</p>
              <p className="text-xs leading-5 text-slate-500">Original turns stay visible. Edit the rewritten version only when needed.</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setIsEditingDialogue((value) => !value)}>
              {isEditingDialogue ? 'Hide editing' : 'Edit dialogue'}
            </Button>
          </div>
          <div className="space-y-4">
            {newDialogueSeed.map((seed, index) => {
              const currentTurn =
                formState.editableNewDialogue.find((item) => item.turnId === seed.turnId) ?? seed;
              const isModified = currentTurn.text !== seed.text;

              return (
                <div key={seed.turnId} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-2 flex items-center gap-2">
                    <Badge variant="outline" className="border-slate-300 bg-slate-100 text-slate-700">
                      {seed.role}
                    </Badge>
                    <span className="text-xs text-slate-500">Turn {index + 1}</span>
                    {isModified ? (
                      <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700">
                        Edited
                      </Badge>
                    ) : null}
                  </div>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs uppercase tracking-wide text-slate-500">Original</Label>
                      <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                        {seed.text}
                      </div>
                    </div>
                    {isEditingDialogue || isModified ? (
                      <TextAreaField
                        label="Edited version"
                        value={currentTurn.text}
                        onChange={(text) => updateDialogueTurn(seed.turnId, text)}
                        placeholder="Revise this dialogue turn if needed."
                      />
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className={annotationFormContextPanelClass}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Updated memory under review</p>
              <p className="text-xs leading-5 text-slate-500">You can rewrite the memory statement while keeping the original visible.</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setIsEditingMemory((value) => !value)}>
              {isEditingMemory ? 'Hide editing' : 'Edit memory'}
            </Button>
          </div>
          <div className="space-y-4">
            {updatedMemorySeed.map((seed, index) => {
              const currentMemory =
                formState.editableUpdatedMemories.find((item) => item.memoryId === seed.memoryId) ?? seed;
              const isModified = currentMemory.value !== seed.value;

              return (
                <div key={seed.memoryId} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="mb-2 flex items-center gap-2">
                    <Badge variant="outline" className="border-slate-300 bg-slate-100 text-slate-700">
                      {seed.memoryId || `memory-${index + 1}`}
                    </Badge>
                    {isModified ? (
                      <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700">
                        Edited
                      </Badge>
                    ) : null}
                  </div>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs uppercase tracking-wide text-slate-500">Original</Label>
                      <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                        {seed.value}
                      </div>
                    </div>
                    {isEditingMemory || isModified ? (
                      <TextAreaField
                        label="Edited version"
                        value={currentMemory.value}
                        onChange={(value) => updateMemoryValue(seed.memoryId, value)}
                        placeholder="Revise the memory statement if needed."
                      />
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <RadioField
          label="Overall verdict"
          value={formState.overallVerdict}
          options={VERDICT_OPTIONS}
          onChange={(value) =>
            setFormState((current) =>
              withDraftMeta(current, {
                overallVerdict: value as Q1Task2Annotation['overallVerdict'],
              }),
            )
          }
        />

        <RadioField
          label="Expected action"
          value={formState.expectedAction}
          options={ACTION_OPTIONS}
          onChange={(value) =>
            setFormState((current) =>
              withDraftMeta(current, {
                expectedAction: value as Q1Task2Annotation['expectedAction'],
              }),
            )
          }
        />

        <RadioField
          label="Does the new dialogue contain a true update signal?"
          value={formState.newDialogueContainsUpdateSignal}
          options={TERNARY_OPTIONS}
          onChange={(value) =>
            setFormState((current) =>
              withDraftMeta(current, {
                newDialogueContainsUpdateSignal:
                  value as Q1Task2Annotation['newDialogueContainsUpdateSignal'],
              }),
            )
          }
        />

        <RadioField
          label="Is the gold update reasonable?"
          value={formState.goldUpdateReasonable}
          options={TERNARY_OPTIONS}
          onChange={(value) =>
            setFormState((current) =>
              withDraftMeta(current, {
                goldUpdateReasonable: value as Q1Task2Annotation['goldUpdateReasonable'],
              }),
            )
          }
        />

        <RadioField
          label="Did the benchmark change only relevant memory?"
          value={formState.changedOnlyRelevantMemory}
          options={BINARY_OPTIONS}
          onChange={(value) =>
            setFormState((current) =>
              withDraftMeta(current, {
                changedOnlyRelevantMemory: value as Q1Task2Annotation['changedOnlyRelevantMemory'],
              }),
            )
          }
        />

        <CheckboxField
          label="Issue types"
          values={formState.issueTypes}
          options={ISSUE_TYPE_OPTIONS}
          onChange={(issueTypes) => setFormState((current) => withDraftMeta(current, { issueTypes }))}
        />

        <TextAreaField
          label="Evidence note"
          value={formState.evidenceNote ?? ''}
          onChange={(evidenceNote) => setFormState((current) => withDraftMeta(current, { evidenceNote }))}
          placeholder="Explain what in the new dialogue supports or weakens the update."
        />

        <TextAreaField
          label="Revision suggestion"
          value={formState.revisionSuggestion ?? ''}
          onChange={(revisionSuggestion) =>
            setFormState((current) => withDraftMeta(current, { revisionSuggestion }))
          }
          placeholder="Suggest how to revise the benchmark update if needed."
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
