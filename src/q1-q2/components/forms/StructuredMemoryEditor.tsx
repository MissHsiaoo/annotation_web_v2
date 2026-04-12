import { useEffect, useState } from 'react';

import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Textarea } from '../../../components/ui/textarea';
import { TranslatedText } from '../display/TranslatedText';

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

interface StructuredMemoryEditorProps {
  title: string;
  description: string;
  memories: EditableMemoryRecord[];
  onChange: (nextMemories: EditableMemoryRecord[]) => void;
  addButtonLabel?: string;
  translationEnabled?: boolean;
  displayMode?: 'list' | 'carousel';
}

export function StructuredMemoryEditor({
  title,
  description,
  memories,
  onChange,
  addButtonLabel = 'Add Memory',
  translationEnabled = false,
  displayMode = 'list',
}: StructuredMemoryEditorProps) {
  const [activeMemoryIndex, setActiveMemoryIndex] = useState(0);

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
    setActiveMemoryIndex(memories.length);
    onChange([
      ...memories,
      {
        memory_id: `new-memory-${memories.length + 1}`,
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
    <div key={`${String(memory.memory_id ?? 'memory')}-${memoryIndex}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-slate-300 bg-slate-100 text-slate-700">
            {String(memory.memory_id ?? `memory-${memoryIndex + 1}`)}
          </Badge>
          <Badge variant="outline" className="border-slate-300 bg-white text-slate-600">
            {String(memory.label ?? 'Label Missing')}
          </Badge>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => removeMemory(memoryIndex)}>
          Remove
        </Button>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
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

          return (
            <label
              key={field}
              className={`space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3 ${
                isLongField ? 'lg:col-span-2' : ''
              }`}
            >
              <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                {field}
              </span>
              <Textarea
                value={formattedValue}
                onChange={(event) => updateField(memoryIndex, field, event.target.value)}
                className={`rounded-xl border-slate-300 bg-white text-sm ${isLongField ? 'min-h-24' : 'min-h-12'}`}
              />
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

      <div className="space-y-5">
        {displayMode === 'carousel' && memories.length > 1 ? (
          <div className="flex flex-wrap items-center justify-end gap-2 text-xs text-slate-500">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setActiveMemoryIndex((current) => Math.max(current - 1, 0))}
              disabled={activeMemoryIndex === 0}
            >
              Previous
            </Button>
            <Badge variant="outline" className="border-slate-300 bg-white text-slate-600">
              {activeMemoryIndex + 1} / {memories.length}
            </Badge>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setActiveMemoryIndex((current) => Math.min(current + 1, memories.length - 1))}
              disabled={activeMemoryIndex >= memories.length - 1}
            >
              Next
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
