import { useEffect, useRef } from 'react';

type AnnotationStatus = 'draft' | 'saved';

/** Shared layout tokens for task annotation forms (right pane). Keeps cards, headers, and footers visually aligned. */
export const annotationFormCardClass =
  'min-w-0 overflow-hidden border border-slate-200 bg-white shadow-sm';

export const annotationFormHeaderClass =
  'border-b border-slate-100 bg-slate-50 px-5 py-4 sm:px-6';

export const annotationFormContentClass = 'space-y-5 px-5 pb-0 pt-5 sm:px-6';

export const annotationFormFooterClass =
  'mt-4 space-y-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-4 sm:px-5';

export const annotationFormContextPanelClass =
  'rounded-lg border border-slate-200 bg-slate-50 p-4';

export const annotationFormArtifactPanelClass =
  'rounded-lg border border-slate-200 bg-white p-4';

export const annotationValidationErrorClass =
  'rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700';

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
