import { useEffect, useState } from 'react';

import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog';
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

interface StructuredMemoryEditorProps {
  title: string;
  description: string;
  memories: EditableMemoryRecord[];
  onChange: (nextMemories: EditableMemoryRecord[]) => void;
  onActiveIndexChange?: (index: number) => void;
  addButtonLabel?: string;
  translationEnabled?: boolean;
  displayMode?: 'list' | 'carousel';
  dialogueTurns?: DialogueTurn[];
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
  dialogueTurns,
}: StructuredMemoryEditorProps) {
  const [activeMemoryIndex, setActiveMemoryIndex] = useState(0);
  const [evidencePickerOpen, setEvidencePickerOpen] = useState(false);
  const [evidencePickerMemoryIndex, setEvidencePickerMemoryIndex] = useState(0);
  const [pickerSelectedIndices, setPickerSelectedIndices] = useState<Set<number>>(new Set());

  const openEvidencePicker = (memIdx: number) => {
    const memory = memories[memIdx];
    let initial = new Set<number>();
    const ev = memory?.evidence;
    if (isRecord(ev) && Array.isArray((ev as Record<string, unknown>).turn_indices)) {
      for (const n of (ev as Record<string, unknown>).turn_indices as unknown[]) {
        if (typeof n === 'number') initial.add(n);
      }
    }
    setPickerSelectedIndices(initial);
    setEvidencePickerMemoryIndex(memIdx);
    setEvidencePickerOpen(true);
  };

  const saveEvidenceFromPicker = () => {
    if (!dialogueTurns) return;
    const sorted = Array.from(pickerSelectedIndices).sort((a, b) => a - b);
    const evidenceValue =
      sorted.length > 0
        ? {
            turn_indices: sorted,
            turns: sorted.map((idx) => ({
              index: idx,
              role: dialogueTurns[idx]?.role ?? '',
              text: dialogueTurns[idx]?.text ?? '',
            })),
          }
        : null;
    updateField(evidencePickerMemoryIndex, 'evidence', JSON.stringify(evidenceValue, null, 2));
    setEvidencePickerOpen(false);
  };

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
              {field === 'evidence' && dialogueTurns && dialogueTurns.length > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => openEvidencePicker(memoryIndex)}
                >
                  Pick from Dialogue
                </Button>
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

      {/* Evidence picker dialog */}
      {dialogueTurns && (
        <Dialog open={evidencePickerOpen} onOpenChange={setEvidencePickerOpen}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Select Evidence from Dialogue</DialogTitle>
              <DialogDescription>
                Single-click to mark a turn as evidence · Double-click to remove ·{' '}
                {pickerSelectedIndices.size} turn{pickerSelectedIndices.size !== 1 ? 's' : ''} selected
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[26rem] space-y-1.5 overflow-y-auto pr-1">
              {dialogueTurns.map((turn, index) => {
                const isSelected = pickerSelectedIndices.has(index);
                return (
                  <div
                    key={index}
                    className={`cursor-pointer select-none rounded-lg border px-3 py-2 transition-colors ${
                      isSelected
                        ? 'border-pink-300 bg-pink-100/30'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                    onClick={() =>
                      setPickerSelectedIndices((prev) => {
                        const next = new Set(prev);
                        next.add(index);
                        return next;
                      })
                    }
                    onDoubleClick={(e) => {
                      e.preventDefault();
                      setPickerSelectedIndices((prev) => {
                        const next = new Set(prev);
                        next.delete(index);
                        return next;
                      });
                    }}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      {turn.role} · {index + 1}
                    </p>
                    <p className="mt-0.5 text-sm leading-5 text-slate-800">{turn.text}</p>
                  </div>
                );
              })}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEvidencePickerOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={saveEvidenceFromPicker}>
                Save ({pickerSelectedIndices.size} selected)
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

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
