import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';

import { Badge } from '../../../components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { sampleBlockCardClass, sampleBlockContentClass, sampleBlockHeaderClass } from './sampleBlockStyles';
import { TranslatedText } from './TranslatedText';

interface MemoryListBlockProps {
  title: string;
  description?: string;
  items: Array<Record<string, unknown>>;
  activeIndex?: number;
  onActiveIndexChange?: (index: number) => void;
  onCopyItem?: (item: Record<string, unknown>) => void;
  searchable?: boolean;
  collapsible?: boolean;
  collapsedByDefault?: boolean;
  translationEnabled?: boolean;
  displayMode?: 'list' | 'carousel';
}

function stringifyField(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return null;
}

export function MemoryListBlock({
  title,
  description,
  items,
  activeIndex,
  onActiveIndexChange,
  onCopyItem,
  searchable = false,
  collapsible = false,
  collapsedByDefault = false,
  translationEnabled = false,
  displayMode = 'list',
}: MemoryListBlockProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isExpanded, setIsExpanded] = useState(!collapsedByDefault);
  const [internalActiveItemIndex, setInternalActiveItemIndex] = useState(0);

  const setInternalActiveItemIndexAndNotify = (updater: number | ((prev: number) => number)) => {
    setInternalActiveItemIndex((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      onActiveIndexChange?.(next);
      return next;
    });
  };

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const query = searchQuery.toLowerCase();
    return items.filter((item) => JSON.stringify(item).toLowerCase().includes(query));
  }, [items, searchQuery]);

  useEffect(() => {
    setInternalActiveItemIndex((current) => {
      if (filteredItems.length === 0) return 0;
      return Math.min(current, filteredItems.length - 1);
    });
  }, [filteredItems.length]);

  const activeItemIndex =
    activeIndex !== undefined
      ? Math.min(Math.max(activeIndex, 0), Math.max(filteredItems.length - 1, 0))
      : internalActiveItemIndex;

  if (items.length === 0) return null;

  const renderMemoryCard = (item: Record<string, unknown>, index: number) => {
    const value = stringifyField(item.value) ?? stringifyField(item.query) ?? stringifyField(item.response);
    const reasoning = stringifyField(item.reasoning);
    const label = stringifyField(item.label);
    const evidenceText =
      typeof item.evidence === 'object' && item.evidence !== null
        ? stringifyField((item.evidence as Record<string, unknown>).text)
        : null;

    return (
      <div
        key={`${label ?? 'item'}-${index}`}
        className="space-y-2.5 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
      >
        {/* Header row: label + id + copy button */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {label ? (
              <Badge variant="outline" className="border-slate-300 bg-slate-100 text-xs text-slate-700">
                {label}
              </Badge>
            ) : null}
            {stringifyField(item.memory_id) ? (
              <span className="truncate text-xs text-slate-400">{stringifyField(item.memory_id)}</span>
            ) : null}
          </div>
          {onCopyItem ? (
            <button
              type="button"
              onClick={() => onCopyItem(item)}
              className="shrink-0 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-100"
            >
              Add to Golden
            </button>
          ) : null}
        </div>

        {/* Value */}
        {value ? (
          <TranslatedText text={value} translationEnabled={translationEnabled} />
        ) : (
          <pre className="overflow-auto rounded-lg bg-slate-950 p-2.5 text-xs text-slate-100">
            {JSON.stringify(item, null, 2)}
          </pre>
        )}

        {/* Reasoning */}
        {reasoning ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Reasoning</p>
            <TranslatedText text={reasoning} translationEnabled={translationEnabled} />
          </div>
        ) : null}

        {/* Evidence */}
        {evidenceText ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Evidence</p>
            <TranslatedText text={evidenceText} translationEnabled={translationEnabled} />
          </div>
        ) : null}

        {/* Raw JSON (collapsed by default) */}
        <details className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <summary className="cursor-pointer text-xs font-medium text-slate-500">Raw JSON</summary>
          <pre className="mt-2 overflow-auto whitespace-pre-wrap break-all text-xs text-slate-600">
            {JSON.stringify(item, null, 2)}
          </pre>
        </details>
      </div>
    );
  };

  return (
    <Card className={sampleBlockCardClass}>
      <CardHeader className={sampleBlockHeaderClass}>
        {/* Single row: title+desc on left, controls on right */}
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="truncate text-sm font-semibold text-slate-900">{title}</CardTitle>
            {description ? (
              <CardDescription className="mt-0.5 text-xs text-slate-500">{description}</CardDescription>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Badge variant="outline" className="border-slate-200 bg-white text-xs text-slate-500">
              {filteredItems.length}
            </Badge>
            {displayMode === 'carousel' && filteredItems.length > 0 ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    if (activeIndex !== undefined) {
                      onActiveIndexChange?.(Math.max(activeItemIndex - 1, 0));
                    } else {
                      setInternalActiveItemIndexAndNotify((c) => Math.max(c - 1, 0));
                    }
                  }}
                  disabled={activeItemIndex === 0}
                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  ‹
                </button>
                <span className="min-w-[36px] text-center text-xs tabular-nums text-slate-500">
                  {activeItemIndex + 1}/{filteredItems.length}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (activeIndex !== undefined) {
                      onActiveIndexChange?.(Math.min(activeItemIndex + 1, filteredItems.length - 1));
                    } else {
                      setInternalActiveItemIndexAndNotify((c) => Math.min(c + 1, filteredItems.length - 1));
                    }
                  }}
                  disabled={activeItemIndex >= filteredItems.length - 1}
                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  ›
                </button>
              </>
            ) : null}
            {collapsible ? (
              <button
                type="button"
                onClick={() => setIsExpanded((c) => !c)}
                className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
              >
                {isExpanded ? '收起' : '展开'}
              </button>
            ) : null}
          </div>
        </div>
      </CardHeader>

      {isExpanded ? (
        <CardContent className={`space-y-3 ${sampleBlockContentClass}`}>
          {searchable ? (
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search memories…"
                className="h-8 rounded-lg border-slate-200 bg-white pl-8 text-sm"
              />
            </div>
          ) : null}

          <div
            className={`space-y-2.5 ${displayMode === 'carousel' ? '' : 'max-h-[520px] overflow-y-auto pr-1'}`}
          >
            {displayMode === 'carousel'
              ? filteredItems[activeItemIndex]
                ? renderMemoryCard(filteredItems[activeItemIndex], activeItemIndex)
                : null
              : filteredItems.map((item, index) => renderMemoryCard(item, index))}
          </div>
        </CardContent>
      ) : null}
    </Card>
  );
}
