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
  formatAnnotationSaveSummary,
  useAnnotationDraftSync,
  withDraftMeta,
} from './annotationFormShell';
import {
  cloneMemoryRecord,
  type EditableMemoryRecord,
  StructuredMemoryEditor,
  validateMemoryRecords,
} from './StructuredMemoryEditor';

interface DialogueSeed {
  turnId: string;
  role: string;
  text: string;
}

function createEmptyAnnotation(
  newDialogueSeed: DialogueSeed[],
  updatedMemorySeed: EditableMemoryRecord[],
): Q1Task2Annotation {
  return {
    formType: 'Q1:task2',
    status: 'draft',
    updatedAt: '',
    overallVerdict: 'reasonable',
    expectedAction: 'modification',
    newDialogueContainsUpdateSignal: 'yes',
    goldUpdateReasonable: 'yes',
    changedOnlyRelevantMemory: 'yes',
    editableNewDialogue: newDialogueSeed.map((item) => ({ ...item })),
    editableUpdatedMemories: updatedMemorySeed.map(cloneMemoryRecord),
    issueTypes: [],
    evidenceNote: '',
    revisionSuggestion: '',
    annotatorNote: '',
  };
}

function mergeSeeds(
  newDialogueSeed: DialogueSeed[],
  updatedMemorySeed: EditableMemoryRecord[],
  existing?: Q1Task2Annotation,
): Q1Task2Annotation {
  const fallback = existing ?? createEmptyAnnotation(newDialogueSeed, updatedMemorySeed);

  return {
    ...fallback,
    editableNewDialogue: fallback.editableNewDialogue.length
      ? fallback.editableNewDialogue
      : newDialogueSeed.map((item) => ({ ...item })),
  };
}

interface Q1Task2FormProps {
  initialValue?: Q1Task2Annotation;
  newDialogueSeed: DialogueSeed[];
  updatedMemorySeed: EditableMemoryRecord[];
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

  useAnnotationDraftSync(formState, startingValue, onDraftChange);

  const saveSummary = useMemo(
    () => formatAnnotationSaveSummary(formState.status, formState.updatedAt),
    [formState.status, formState.updatedAt],
  );

  const handleSave = () => {
    const cleanedMemories = formState.editableUpdatedMemories.filter((item) => String(item.value ?? '').trim());
    const nextValidationError = validateMemoryRecords(cleanedMemories);

    if (nextValidationError) {
      setValidationError(nextValidationError);
      return;
    }

    const nextAnnotation: Q1Task2Annotation = {
      ...formState,
      editableUpdatedMemories: cleanedMemories,
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
            <CardTitle className="text-slate-900">直接编辑 Golden 更新记忆 Taxonomy</CardTitle>
            <CardDescription className="text-slate-600">
              按原始 schema 修改更新后的 memory；每个字段都可展示和修改。
            </CardDescription>
          </div>
          <Badge variant="outline" className="border-slate-300 bg-slate-100 text-slate-700">
            {saveSummary}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className={annotationFormContentClass}>
        <StructuredMemoryEditor
          title="Golden 更新记忆字段编辑"
          description="这些字段会在导出 merged dataset 时原样写回 task2 的 golden_answer。"
          memories={formState.editableUpdatedMemories}
          onChange={(editableUpdatedMemories) => {
            setValidationError('');
            setFormState((current) => withDraftMeta(current, { editableUpdatedMemories }));
          }}
        />

        <div className={annotationFormFooterClass}>
          {validationError ? (
            <div className={annotationValidationErrorClass}>{validationError}</div>
          ) : null}

          <div className="flex justify-end">
            <Button type="button" onClick={handleSave} className="rounded-xl px-6 shadow-sm">
              保存 Golden 更新记忆
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
