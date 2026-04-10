import { useEffect, useRef } from 'react';

type AnnotationStatus = 'draft' | 'saved';

/** Shared layout tokens for task annotation forms (right pane). Keeps cards, headers, and footers visually aligned. */
export const annotationFormCardClass =
  'min-w-0 overflow-hidden border-slate-200/90 bg-white/95 shadow-md ring-1 ring-slate-200/35';

export const annotationFormHeaderClass =
  'border-b border-slate-100/80 bg-gradient-to-r from-white via-white to-indigo-50/60 px-5 py-5 sm:px-6';

export const annotationFormContentClass = 'space-y-6 px-5 pb-0 pt-6 sm:px-6';

export const annotationFormFooterClass =
  'mt-4 space-y-4 rounded-2xl border border-slate-200/70 bg-gradient-to-br from-slate-50/90 to-white px-4 py-5 shadow-inner ring-1 ring-slate-200/25 sm:px-5';

export const annotationFormContextPanelClass =
  'rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-50 to-white p-5 shadow-sm ring-1 ring-slate-200/25';

export const annotationFormArtifactPanelClass =
  'rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm ring-1 ring-slate-200/20';

export const annotationValidationErrorClass =
  'rounded-xl border border-red-200/90 bg-red-50/95 px-4 py-3 text-sm text-red-800 shadow-sm';

export function formatAnnotationSaveSummary(status: AnnotationStatus, updatedAt: string): string {
  if (!updatedAt) {
    return '尚未保存';
  }

  return `${status === 'saved' ? '已保存' : '草稿已自动保存'}：${new Date(updatedAt).toLocaleString()}`;
}

export function withDraftMeta<T extends { status: AnnotationStatus; updatedAt: string }>(
  value: T,
  patch: Partial<T>,
): T {
  return {
    ...value,
    ...patch,
    status: 'draft',
    updatedAt: new Date().toISOString(),
  };
}

export function normalizeBoundedInteger(
  value: number | null,
  min = 0,
  max = 100,
): number | null {
  if (value === null || Number.isNaN(value)) {
    return null;
  }

  return Math.min(max, Math.max(min, Math.trunc(value)));
}

export function isBoundedInteger(
  value: number | null,
  min = 0,
  max = 100,
): value is number {
  return value !== null && Number.isInteger(value) && value >= min && value <= max;
}

export function useAnnotationDraftSync<T>(
  value: T,
  initialValue: T,
  onDraftChange?: (value: T) => void,
) {
  const initialSerializedRef = useRef(JSON.stringify(initialValue));
  const lastEmittedSerializedRef = useRef(initialSerializedRef.current);

  useEffect(() => {
    const serialized = JSON.stringify(initialValue);
    initialSerializedRef.current = serialized;
    lastEmittedSerializedRef.current = serialized;
  }, [initialValue]);

  useEffect(() => {
    if (!onDraftChange) {
      return;
    }

    const serialized = JSON.stringify(value);
    if (
      serialized === initialSerializedRef.current ||
      serialized === lastEmittedSerializedRef.current
    ) {
      return;
    }

    lastEmittedSerializedRef.current = serialized;
    onDraftChange(value);
  }, [onDraftChange, value]);
}
