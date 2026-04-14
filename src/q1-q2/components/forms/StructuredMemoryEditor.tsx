import { useEffect, useRef, useState } from 'react';

import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Textarea } from '../../../components/ui/textarea';
import { TranslatedText } from '../display/TranslatedText';

export interface DialogueTurn {
  role: string;
  text: string;
}

export type EditableMemoryRecord = Record<string, unknown>;

const PREFERRED_FIELD_ORDER = [
  'memory_id',
  'type',
  'label',
  'label_suggestion',
  'value',
  'reasoning',
  'evidence',
  'evidence_text',
  'confidence',
  'time_scope',
  'emotion',
  'preference_attitude',
  'updated_at',
];

const TRANSLATABLE_FIELD_NAMES = new Set([
  'value',
  'reasoning',
  'evidence_text',
]);

const JSON_OBJECT_OR_NULL_FIELDS = new Set(['evidence']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function cloneMemoryRecord(value: EditableMemoryRecord): EditableMemoryRecord {
  return structuredClone(value) as EditableMemoryRecord;
}

function getFieldOrder(record: EditableMemoryRecord): string[] {
  const knownFields = PREFERRED_FIELD_ORDER.filter((field) => field in record);
  const extraFields = Object.keys(record)
    .filter((field) => !PREFERRED_FIELD_ORDER.includes(field))
    .sort();
  return [...knownFields, ...extraFields];
}

function formatFieldValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'undefined') {
    return '';
  }

  if (isRecord(value) || Array.isArray(value)) {
    return JSON.stringify(value, null, 2);
  }

  return JSON.stringify(value);
}

function parseFieldValue(field: string, previousValue: unknown, nextValue: string): unknown {
  if (JSON_OBJECT_OR_NULL_FIELDS.has(field)) {
    const trimmed = nextValue.trim();
    if (!trimmed || trimmed === 'null') {
      return null;
    }
    try {
      return JSON.parse(trimmed);
    } catch {
      return nextValue;
    }
  }

  if (typeof previousValue === 'string') {
    return nextValue;
  }

  if (typeof previousValue === 'number') {
    const parsed = Number(nextValue);
    return Number.isFinite(parsed) ? parsed : nextValue;
  }

  if (typeof previousValue === 'boolean') {
    const normalized = nextValue.trim().toLowerCase();
    if (normalized === 'true') {
      return true;
    }
    if (normalized === 'false') {
      return false;
    }
    return nextValue;
  }

  if (previousValue === null) {
    const trimmed = nextValue.trim();
    if (!trimmed || trimmed === 'null') {
      return null;
    }
    try {
      return JSON.parse(trimmed);
    } catch {
      return nextValue;
    }
  }

  if (isRecord(previousValue) || Array.isArray(previousValue)) {
    try {
      return JSON.parse(nextValue);
    } catch {
      return nextValue;
    }
  }

  return nextValue;
}

export function validateMemoryRecords(records: EditableMemoryRecord[]): string | null {
  if (records.length === 0) {
    return 'At least one memory record is required.';
  }

  for (const [index, record] of records.entries()) {
    if (!String(record.value ?? '').trim()) {
      return `Memory ${index + 1} value cannot be empty.`;
    }

    if (!String(record.label ?? '').trim()) {
      return `Memory ${index + 1} label cannot be empty.`;
    }

    if (typeof record.evidence !== 'undefined' && record.evidence !== null && !isRecord(record.evidence)) {
      return `Memory ${index + 1} evidence must be a JSON object or null, not a plain string.`;
    }
  }

  return null;
}

/** Extract previously saved turn indices from an evidence field value. */
export function getEvidenceTurnIndices(evidence: unknown): number[] {
  if (!isRecord(evidence)) return [];
  const arr = (evidence as Record<string, unknown>).turn_indices;
  if (!Array.isArray(arr)) return [];
  return arr.filter((n): n is number => typeof n === 'number');
}

/**
 * A textarea that keeps local state while the user is typing and only commits
 * to the parent on blur. This prevents controlled-input clobbering of
 * intermediate values like "0." when editing numeric fields such as confidence.
 */
function LocalTextarea({
  value,
  onCommit,
  className,
}: {
  value: string;
  onCommit: (value: string) => void;
  className?: string;
}) {
  const [local, setLocal] = useState(value);
  const isEditing = useRef(false);

  useEffect(() => {
    if (!isEditing.current) {
      setLocal(value);
    }
  }, [value]);

  return (
    <Textarea
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onFocus={() => {
        isEditing.current = true;
      }}
      onBlur={() => {
        isEditing.current = false;
        onCommit(local);
      }}
      className={className}
    />
  );
}

interface StructuredMemoryEditorProps {
  title: string;
  description: string;
  memories: EditableMemoryRecord[];
  onChange: (nextMemories: EditableMemoryRecord[]) => void;
  onActiveIndexChange?: (index: number) => void;
  addButtonLabel?: string;
  translationEnabled?: boolean;
  displayMode?: 'list' | 'carousel';
  /** Called when user clicks "Pick from Dialogue" on a memory's evidence field. */
  onPickEvidence?: (memoryIndex: number, currentIndices: number[]) => void;
  /** Index of the memory currently being evidence-picked (highlights the field). */
  activeEvidenceMemoryIndex?: number | null;
  /** Called when user confirms the evidence selection (Save Evidence). */
  onConfirmEvidence?: (memoryIndex: number) => void;
  /** Called when user cancels the evidence selection. */
  onCancelEvidence?: () => void;
}

export function StructuredMemoryEditor({
  title,
  description,
  memories,
  onChange,
  onActiveIndexChange,
  addButtonLabel = 'Add Memory',
  translationEnabled = false,
  displayMode = 'list',
  onPickEvidence,
  activeEvidenceMemoryIndex,
  onConfirmEvidence,
  onCancelEvidence,
}: StructuredMemoryEditorProps) {
  const [activeMemoryIndex, setActiveMemoryIndex] = useState(0);

  const setActiveMemoryIndexAndNotify = (updater: number | ((prev: number) => number)) => {
    setActiveMemoryIndex((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      onActiveIndexChange?.(next);
      return next;
    });
  };

  useEffect(() => {
    setActiveMemoryIndex((current) => {
      if (memories.length === 0) {
        return 0;
      }
      return Math.min(current, memories.length - 1);
    });
  }, [memories.length]);

  const updateField = (memoryIndex: number, field: string, value: string) => {
    onChange(
      memories.map((memory, index) =>
        index === memoryIndex
          ? {
              ...memory,
              [field]: parseFieldValue(field, memory[field], value),
            }
          : memory,
      ),
    );
  };

  const removeMemory = (memoryIndex: number) => {
    onChange(memories.filter((_, index) => index !== memoryIndex));
  };

  const addMemory = () => {
    setActiveMemoryIndexAndNotify(memories.length);
    onChange([
      ...memories,
      {
        memory_id: `new-memory-${Date.now()}`,
        type: 'direct',
        label: 'UNMAPPED',
        label_suggestion: null,
        value: '',
        reasoning: '',
        evidence: null,
        confidence: 0.8,
        time_scope: 'unknown',
        emotion: null,
        preference_attitude: null,
        updated_at: new Date().toISOString(),
      },
    ]);
  };

  const renderMemoryEditor = (memory: EditableMemoryRecord, memoryIndex: number) => (
    <div key={`${String(memory.memory_id ?? 'memory')}-${memoryIndex}`} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="border-slate-300 bg-slate-100 text-xs text-slate-700">
            {String(memory.memory_id ?? `memory-${memoryIndex + 1}`)}
          </Badge>
          <Badge variant="outline" className="border-slate-200 bg-white text-xs text-slate-500">
            {String(memory.label ?? 'Label Missing')}
          </Badge>
        </div>
        <Button type="button" variant="outline" size="sm" className="h-7 shrink-0 px-2 text-xs" onClick={() => removeMemory(memoryIndex)}>
          Remove
        </Button>
      </div>

      <div className="grid gap-2 lg:grid-cols-2">
        {getFieldOrder(memory).map((field) => {
          const value = memory[field];
          const formattedValue = formatFieldValue(value);
          const isLongField =
            field === 'value' ||
            field === 'reasoning' ||
            field === 'evidence' ||
            field === 'evidence_text' ||
            isRecord(value) ||
            Array.isArray(value);
          const isActiveEvidenceField =
            field === 'evidence' && activeEvidenceMemoryIndex === memoryIndex;

          return (
            <label
              key={field}
              className={`space-y-2 rounded-xl border p-3 ${
                isLongField ? 'lg:col-span-2' : ''
              } ${
                isActiveEvidenceField
                  ? 'border-pink-300 bg-pink-50/40'
                  : 'border-slate-200 bg-slate-50/70'
              }`}
            >
              <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                {field}
              </span>
              <LocalTextarea
                value={formattedValue}
                onCommit={(val) => updateField(memoryIndex, field, val)}
                className={`rounded-xl border-slate-300 bg-white text-sm ${isLongField ? 'min-h-24' : 'min-h-12'}`}
              />
              {field === 'evidence' && onPickEvidence ? (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant={isActiveEvidenceField ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => onPickEvidence(memoryIndex, getEvidenceTurnIndices(memory.evidence))}
                  >
                    {isActiveEvidenceField ? 'Picking…' : 'Pick from Dialogue'}
                  </Button>
                  {isActiveEvidenceField && onConfirmEvidence && onCancelEvidence ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => onConfirmEvidence(memoryIndex)}
                      >
                        Save Evidence
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={onCancelEvidence}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : null}
                </div>
              ) : null}
              {translationEnabled &&
              TRANSLATABLE_FIELD_NAMES.has(field) &&
              typeof value === 'string' &&
              value.trim() ? (
                <TranslatedText
                  text={formattedValue}
                  translationEnabled
                  className="hidden"
                />
              ) : null}
            </label>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-4 shadow-inner">
        <p className="text-sm font-semibold text-slate-950">{title}</p>
        <p className="mt-1 text-xs leading-5 text-slate-600">{description}</p>
      </div>

      <div className="space-y-4">
        {displayMode === 'carousel' && memories.length > 1 ? (
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setActiveMemoryIndexAndNotify((current) => Math.max(current - 1, 0))}
              disabled={activeMemoryIndex === 0}
            >
              ‹ Prev
            </Button>
            <Badge variant="outline" className="border-slate-300 bg-white text-xs text-slate-600">
              {activeMemoryIndex + 1} / {memories.length}
            </Badge>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setActiveMemoryIndexAndNotify((current) => Math.min(current + 1, memories.length - 1))}
              disabled={activeMemoryIndex >= memories.length - 1}
            >
              Next ›
            </Button>
          </div>
        ) : null}

        {displayMode === 'carousel'
          ? memories[activeMemoryIndex]
            ? renderMemoryEditor(memories[activeMemoryIndex], activeMemoryIndex)
            : null
          : memories.map((memory, memoryIndex) => renderMemoryEditor(memory, memoryIndex))}
      </div>

      <div className="flex justify-end">
        <Button type="button" variant="outline" onClick={addMemory} className="rounded-xl px-5 shadow-sm">
          {addButtonLabel}
        </Button>
      </div>
    </div>
  );
}
