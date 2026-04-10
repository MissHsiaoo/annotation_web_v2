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
  annotationFormFooterClass,
  annotationFormHeaderClass,
  annotationValidationErrorClass,
  formatAnnotationSaveSummary,
  useAnnotationDraftSync,
  withDraftMeta,
} from './annotationFormShell';
import { TextAreaField } from './FormFields';
import {
  cloneMemoryRecord,
  type EditableMemoryRecord,
  StructuredMemoryEditor,
  validateMemoryRecords,
} from './StructuredMemoryEditor';

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
  selectedMemorySeed: EditableMemoryRecord | null;
  onDraftChange?: (annotation: Q1Task3Annotation) => void;
  onSave: (annotation: Q1Task3Annotation) => void;
}

function createAnnotationFromSeed(
  querySeed: string,
  selectedMemorySeed: EditableMemoryRecord | null,
  initialValue?: Q1Task3Annotation,
): Q1Task3Annotation {
  const fallback = initialValue ?? createEmptyAnnotation();
  return {
    ...fallback,
    queryText: fallback.queryText || querySeed,
    editableSelectedMemory:
      fallback.editableSelectedMemory ??
      (selectedMemorySeed ? cloneMemoryRecord(selectedMemorySeed) : null),
  };
}

export function Q1Task3Form({
  initialValue,
  querySeed,
  selectedMemorySeed,
  onDraftChange,
  onSave,
}: Q1Task3FormProps) {
  const startingValue = useMemo(
    () => createAnnotationFromSeed(querySeed, selectedMemorySeed, initialValue),
    [initialValue, querySeed, selectedMemorySeed],
  );
  const [formState, setFormState] = useState<Q1Task3Annotation>(startingValue);
  const [validationError, setValidationError] = useState('');

  useAnnotationDraftSync(formState, startingValue, onDraftChange);

  const saveSummary = useMemo(
    () => formatAnnotationSaveSummary(formState.status, formState.updatedAt),
    [formState.status, formState.updatedAt],
  );

  const handleSave = () => {
    if (!formState.queryText.trim()) {
      setValidationError('Query 不能为空。');
      return;
    }

    if (formState.editableSelectedMemory) {
      const selectedMemoryError = validateMemoryRecords([formState.editableSelectedMemory]);
      if (selectedMemoryError) {
        setValidationError(selectedMemoryError);
        return;
      }
    }

    const nextAnnotation: Q1Task3Annotation = {
      ...formState,
      queryText: formState.queryText.trim(),
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
            <CardTitle className="text-slate-900">直接编辑 Query</CardTitle>
            <CardDescription className="text-slate-600">
              只改最终要保存的查询；不需要填写相关性判断维度。
            </CardDescription>
          </div>
          <Badge variant="outline" className="border-slate-300 bg-slate-100 text-slate-700">
            {saveSummary}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className={annotationFormContentClass}>
        <TextAreaField
          label="Golden Query"
          value={formState.queryText}
          onChange={(queryText) => setFormState((current) => withDraftMeta(current, { queryText }))}
          placeholder="填写最终应保留的 query。"
        />

        {formState.editableSelectedMemory ? (
          <StructuredMemoryEditor
            title="Golden 选中记忆字段编辑"
            description="保留 selected memory 的原始字段；导出 merged dataset 时会写回 task3.selected_memory。"
            memories={[formState.editableSelectedMemory]}
            onChange={(nextMemories) =>
              setFormState((current) =>
                withDraftMeta(current, { editableSelectedMemory: nextMemories[0] ?? null }),
              )
            }
            addButtonLabel="补回 Selected Memory"
          />
        ) : null}

        <div className={annotationFormFooterClass}>
          {validationError ? (
            <div className={annotationValidationErrorClass}>{validationError}</div>
          ) : null}

          <div className="flex justify-end">
            <Button type="button" onClick={handleSave} className="rounded-xl px-6 shadow-sm">
              保存 Query
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
