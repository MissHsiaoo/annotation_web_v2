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

interface Q1Task1FormProps {
  initialValue?: Q1Task1Annotation;
  goldMemorySeed: EditableMemoryRecord[];
  onDraftChange?: (annotation: Q1Task1Annotation) => void;
  onSave: (annotation: Q1Task1Annotation) => void;
}

function createEmptyAnnotation(goldMemorySeed: EditableMemoryRecord[]): Q1Task1Annotation {
  return {
    formType: 'Q1:task1',
    status: 'draft',
    updatedAt: '',
    overallVerdict: 'reasonable',
    hasDialogueEvidence: 'yes',
    overInference: 'no',
    faithfulToOriginalMeaning: 'yes',
    editableGoldMemories: goldMemorySeed.map(cloneMemoryRecord),
    issueTypes: [],
    evidenceNote: '',
    revisionSuggestion: '',
    annotatorNote: '',
  };
}

function mergeSeeds(goldMemorySeed: EditableMemoryRecord[], existing?: Q1Task1Annotation): Q1Task1Annotation {
  const fallback = existing ?? createEmptyAnnotation(goldMemorySeed);

  if (fallback.editableGoldMemories?.length) {
    return fallback;
  }

  return {
    ...fallback,
    editableGoldMemories: goldMemorySeed.map(cloneMemoryRecord),
  };
}

export function Q1Task1Form({ initialValue, goldMemorySeed, onDraftChange, onSave }: Q1Task1FormProps) {
  const startingValue = useMemo(
    () => mergeSeeds(goldMemorySeed, initialValue),
    [initialValue, goldMemorySeed],
  );
  const [formState, setFormState] = useState<Q1Task1Annotation>(startingValue);
  const [validationError, setValidationError] = useState('');

  useAnnotationDraftSync(formState, startingValue, onDraftChange);

  const saveSummary = useMemo(
    () => formatAnnotationSaveSummary(formState.status, formState.updatedAt),
    [formState.status, formState.updatedAt],
  );

  const editableGoldMemories = formState.editableGoldMemories ?? [];

  const handleSave = () => {
    const cleanedMemories = editableGoldMemories.filter((item) => String(item.value ?? '').trim());
    const nextValidationError = validateMemoryRecords(cleanedMemories);

    if (nextValidationError) {
      setValidationError(nextValidationError);
      return;
    }

    const nextAnnotation: Q1Task1Annotation = {
      ...formState,
      editableGoldMemories: cleanedMemories,
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
            <CardTitle className="text-slate-900">直接编辑 Golden Memory Taxonomy</CardTitle>
            <CardDescription className="text-slate-600">
              保留原始 schema，每条 memory 的每个字段都可展示和修改。
            </CardDescription>
          </div>
          <Badge variant="outline" className="border-slate-300 bg-slate-100 text-slate-700">
            {saveSummary}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className={annotationFormContentClass}>
        <StructuredMemoryEditor
          title="Golden Memory 字段编辑"
          description="不要改成简化 schema。需要新增 memory 时，会按当前 taxonomy 自动创建完整字段。"
          memories={editableGoldMemories}
          onChange={(editableGoldMemories) => {
            setValidationError('');
            setFormState((current) => withDraftMeta(current, { editableGoldMemories }));
          }}
        />

        <div className={annotationFormFooterClass}>
          {validationError ? (
            <div className={annotationValidationErrorClass}>{validationError}</div>
          ) : null}

          <div className="flex justify-end">
            <Button type="button" onClick={handleSave} className="rounded-xl px-6 shadow-sm">
              保存 Golden Memory
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
