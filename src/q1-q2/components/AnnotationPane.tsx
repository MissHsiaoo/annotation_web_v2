import type {
  AnySupportedAnnotation,
  EvaluationMode,
  LoadedManualCheckItem,
  ManualCheckDatasetEntry,
} from '../types';
import {
  asRecord,
  buildQ1Task1GoldMemorySeeds,
  buildQ1Task2NewDialogueSeeds,
  buildQ1Task2UpdatedMemorySeeds,
  buildQuerySeeds,
  buildReviewSeeds,
  buildTask4QuerySeeds,
  getQ1Task3QuerySeed,
  getQ1Task3SelectedMemorySeed,
} from '../utils/annotationSeeds';
import { Q1Task1Form } from './forms/Q1Task1Form';
import { Q1Task2Form } from './forms/Q1Task2Form';
import { Q1Task3Form } from './forms/Q1Task3Form';
import { Q1Task4Form } from './forms/Q1Task4Form';
import { Q2Task1Form } from './forms/Q2Task1Form';
import { Q2Task2Form } from './forms/Q2Task2Form';
import { Q2Task3Form } from './forms/Q2Task3Form';
import { Q2Task4Form } from './forms/Q2Task4Form';
import { UnsupportedTaskForm } from './forms/UnsupportedTaskForm';

interface AnnotationPaneProps {
  entry: ManualCheckDatasetEntry;
  loadedItem?: LoadedManualCheckItem | null;
  currentAnnotation?: AnySupportedAnnotation;
  evaluationMode: EvaluationMode;
  onEvaluationModeChange: (mode: EvaluationMode) => void;
  onDraftChange: (annotation: AnySupportedAnnotation) => void;
  onSave: (annotation: AnySupportedAnnotation) => void;
}

export function AnnotationPane({
  entry,
  loadedItem,
  currentAnnotation,
  evaluationMode,
  onEvaluationModeChange,
  onDraftChange,
  onSave,
}: AnnotationPaneProps) {
  if (entry.track === 'Q1' && entry.task === 'task1') {
    return (
      <Q1Task1Form
        key={`${entry.id}-q1-task1`}
        initialValue={currentAnnotation?.formType === 'Q1:task1' ? currentAnnotation : undefined}
        goldMemorySeed={buildQ1Task1GoldMemorySeeds(loadedItem)}
        onDraftChange={onDraftChange}
        onSave={onSave}
      />
    );
  }

  if (entry.track === 'Q1' && entry.task === 'task2') {
    return (
      <Q1Task2Form
        key={`${entry.id}-q1-task2`}
        initialValue={currentAnnotation?.formType === 'Q1:task2' ? currentAnnotation : undefined}
        newDialogueSeed={buildQ1Task2NewDialogueSeeds(loadedItem)}
        updatedMemorySeed={buildQ1Task2UpdatedMemorySeeds(loadedItem)}
        onDraftChange={onDraftChange}
        onSave={onSave}
      />
    );
  }

  if (entry.track === 'Q1' && entry.task === 'task3') {
    return (
      <Q1Task3Form
        key={`${entry.id}-q1-task3`}
        initialValue={currentAnnotation?.formType === 'Q1:task3' ? currentAnnotation : undefined}
        querySeed={getQ1Task3QuerySeed(loadedItem)}
        selectedMemorySeed={getQ1Task3SelectedMemorySeed(loadedItem)}
        onDraftChange={onDraftChange}
        onSave={onSave}
      />
    );
  }

  if (entry.track === 'Q1' && entry.task === 'task4') {
    return (
      <Q1Task4Form
        key={`${entry.id}-q1-task4`}
        ability={entry.ability}
        initialValue={currentAnnotation?.formType === 'Q1:task4' ? currentAnnotation : undefined}
        querySeeds={buildQuerySeeds(loadedItem)}
        onDraftChange={onDraftChange}
        onSave={onSave}
      />
    );
  }

  if (entry.track === 'Q2' && entry.task === 'task1') {
    const judgeOutput = asRecord(loadedItem?.itemData?.judge_output_raw);
    return (
      <Q2Task1Form
        key={`${entry.id}-q2-task1`}
        initialValue={currentAnnotation?.formType === 'Q2:task1' ? currentAnnotation : undefined}
        reviewSeeds={buildReviewSeeds(judgeOutput)}
        mode={evaluationMode}
        onModeChange={onEvaluationModeChange}
        onDraftChange={onDraftChange}
        onSave={onSave}
      />
    );
  }

  if (entry.track === 'Q2' && entry.task === 'task2') {
    const judgeOutput = asRecord(loadedItem?.itemData?.judge_output_raw);
    return (
      <Q2Task2Form
        key={`${entry.id}-q2-task2`}
        initialValue={currentAnnotation?.formType === 'Q2:task2' ? currentAnnotation : undefined}
        reviewSeeds={buildReviewSeeds(judgeOutput)}
        mode={evaluationMode}
        onModeChange={onEvaluationModeChange}
        onDraftChange={onDraftChange}
        onSave={onSave}
      />
    );
  }

  if (entry.track === 'Q2' && entry.task === 'task3') {
    return (
      <Q2Task3Form
        key={`${entry.id}-q2-task3`}
        initialValue={currentAnnotation?.formType === 'Q2:task3' ? currentAnnotation : undefined}
        mode={evaluationMode}
        onModeChange={onEvaluationModeChange}
        onDraftChange={onDraftChange}
        onSave={onSave}
      />
    );
  }

  if (entry.track === 'Q2' && entry.task === 'task4') {
    return (
      <Q2Task4Form
        key={`${entry.id}-q2-task4`}
        ability={entry.ability}
        initialValue={currentAnnotation?.formType === 'Q2:task4' ? currentAnnotation : undefined}
        mode={evaluationMode}
        querySeeds={buildTask4QuerySeeds(loadedItem)}
        onModeChange={onEvaluationModeChange}
        onDraftChange={onDraftChange}
        onSave={onSave}
      />
    );
  }

  return (
    <UnsupportedTaskForm label={`${entry.track} ${entry.task}${entry.ability ? ` ${entry.ability}` : ''}`} />
  );
}
