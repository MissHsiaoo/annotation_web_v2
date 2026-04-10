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
  { value: 'aligned', label: '一致' },
  { value: 'partially_aligned', label: '部分一致' },
  { value: 'not_aligned', label: '不一致' },
];

const TERNARY_OPTIONS = [
  { value: 'yes', label: '是' },
  { value: 'partial', label: '部分' },
  { value: 'no', label: '否' },
];

const BINARY_OPTIONS = [
  { value: 'yes', label: '是' },
  { value: 'no', label: '否' },
];

const USED_MEMORY_OPTIONS = [
  { value: 'used', label: '已使用' },
  { value: 'not_used', label: '未使用' },
  { value: 'uncertain', label: '不确定' },
];

const ISSUE_TYPE_OPTIONS = [
  { value: 'used_memory_error', label: '记忆使用判断错误' },
  { value: 'score_error', label: '分数判断错误' },
  { value: 'unsupported_reason', label: '理由缺乏支撑' },
  { value: 'inconsistency', label: '内部不一致' },
  { value: 'other', label: '其他' },
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
      setValidationError('人工分数必须是 0 到 100 之间的整数，并且必须填写理由。');
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
            <CardTitle className="text-slate-900">标注面板</CardTitle>
            <CardDescription className="text-slate-600">
              Q2 任务3记忆使用评审对齐审核表单。
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
              <p className="text-sm font-semibold text-slate-900">评估模式</p>
              <p className="text-xs leading-5 text-slate-500">
                在评审可见一致性审核与盲评人工打分之间切换。
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Label className="text-sm text-slate-600">评审可见</Label>
              <Switch
                checked={mode === 'blind_human_scoring'}
                onCheckedChange={(checked) =>
                  onModeChange(checked ? 'blind_human_scoring' : 'judge_visible')
                }
              />
              <Label className="text-sm text-slate-600">盲评打分</Label>
            </div>
          </div>
        </div>

        {mode === 'judge_visible' ? (
          <>
            <RadioField
              label="一致性结论"
              value={visibleAnnotation.alignmentVerdict}
              options={ALIGNMENT_OPTIONS}
              onChange={(value) =>
                updateVisibleAnnotation({
                  alignmentVerdict: value as Q2Task3VisibleModeAnnotation['alignmentVerdict'],
                })
              }
            />

            <RadioField
              label="评审器是否正确识别了记忆使用情况？"
              value={visibleAnnotation.usedMemoryCorrect}
              options={BINARY_OPTIONS}
              onChange={(value) =>
                updateVisibleAnnotation({
                  usedMemoryCorrect: value as Q2Task3VisibleModeAnnotation['usedMemoryCorrect'],
                })
              }
            />

            <RadioField
              label="分数是否合理？"
              value={visibleAnnotation.scoreReasonable}
              options={TERNARY_OPTIONS}
              onChange={(value) =>
                updateVisibleAnnotation({
                  scoreReasonable: value as Q2Task3VisibleModeAnnotation['scoreReasonable'],
                })
              }
            />

            <RadioField
              label="评审理由是否支持该判断？"
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
              label="分数是否与记忆使用判断一致？"
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
              label="问题类型"
              values={visibleAnnotation.issueTypes}
              options={ISSUE_TYPE_OPTIONS}
              onChange={(issueTypes) => updateVisibleAnnotation({ issueTypes })}
            />

            <TextAreaField
              label="证据说明"
              value={visibleAnnotation.evidenceNote ?? ''}
              onChange={(evidenceNote) => updateVisibleAnnotation({ evidenceNote })}
              placeholder="说明评审器为何与人工判断一致或不一致。"
            />

            <TextAreaField
              label="修正建议"
              value={visibleAnnotation.revisionSuggestion ?? ''}
              onChange={(revisionSuggestion) => updateVisibleAnnotation({ revisionSuggestion })}
              placeholder="如有需要，写出修正后的人工判断。"
            />
          </>
        ) : (
          <>
            <NumberField
              label="人工分数"
              value={blindAnnotation.humanScore}
              onChange={(humanScore) => updateBlindAnnotation({ humanScore })}
            />

            <RadioField
              label="人工对记忆使用的判断"
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
              label="人工理由"
              value={blindAnnotation.humanRationale}
              onChange={(humanRationale) => updateBlindAnnotation({ humanRationale })}
              placeholder="不依赖可见评审输出，写下你的独立判断理由。"
            />
          </>
        )}

        <div className={annotationFormFooterClass}>
          {validationError ? (
            <div className={annotationValidationErrorClass}>{validationError}</div>
          ) : null}

          <div className="flex justify-end">
            <Button type="button" onClick={handleSave} className="rounded-xl px-6 shadow-sm">
              保存标注
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
