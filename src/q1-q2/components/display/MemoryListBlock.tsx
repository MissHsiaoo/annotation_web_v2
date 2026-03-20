import { useMemo, useState } from 'react';
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
  searchable?: boolean;
  collapsible?: boolean;
  collapsedByDefault?: boolean;
  translationEnabled?: boolean;
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
  searchable = false,
  collapsible = false,
  collapsedByDefault = false,
  translationEnabled = false,
}: MemoryListBlockProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isExpanded, setIsExpanded] = useState(!collapsedByDefault);

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) {
      return items;
    }

    const query = searchQuery.toLowerCase();

    return items.filter((item) =>
      JSON.stringify(item).toLowerCase().includes(query),
    );
  }, [items, searchQuery]);

  if (items.length === 0) {
    return null;
  }

  return (
    <Card className={sampleBlockCardClass}>
      <CardHeader className={sampleBlockHeaderClass}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-base text-slate-900">{title}</CardTitle>
            {description ? <CardDescription className="text-slate-600">{description}</CardDescription> : null}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Badge variant="outline" className="border-slate-300 bg-slate-100 text-slate-700">
              {filteredItems.length} shown
            </Badge>
            {collapsible ? (
              <button
                type="button"
                onClick={() => setIsExpanded((current) => !current)}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 font-medium text-slate-600 transition-colors hover:bg-slate-100"
              >
                {isExpanded ? 'Collapse' : 'Expand'}
              </button>
            ) : null}
          </div>
        </div>
      </CardHeader>

      {isExpanded ? (
        <CardContent className={`space-y-4 ${sampleBlockContentClass}`}>
          {searchable ? (
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search this list"
                className="rounded-xl border-slate-300 bg-white pl-9 shadow-sm"
              />
            </div>
          ) : null}

          <div className="max-h-[560px] space-y-3 overflow-y-auto pr-1">
            {filteredItems.map((item, index) => {
              const value = stringifyField(item.value) ?? stringifyField(item.query) ?? stringifyField(item.response);
              const reasoning = stringifyField(item.reasoning);
              const label = stringifyField(item.label);
              const evidenceText =
                typeof item.evidence === 'object' && item.evidence !== null
                  ? stringifyField((item.evidence as Record<string, unknown>).text)
                  : null;

              return (
                <div key={`${label ?? 'item'}-${index}`} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    {label ? (
                      <Badge variant="outline" className="border-slate-300 bg-slate-100 text-slate-700">
                        {label}
                      </Badge>
                    ) : null}
                    {stringifyField(item.memory_id) ? (
                      <span className="text-xs text-slate-400">{stringifyField(item.memory_id)}</span>
                    ) : null}
                  </div>

                  {value ? (
                    <TranslatedText text={value} translationEnabled={translationEnabled} />
                  ) : (
                    <pre className="overflow-auto rounded-xl bg-slate-950 p-3 text-xs text-slate-100">
                      {JSON.stringify(item, null, 2)}
                    </pre>
                  )}

                  {reasoning ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Reasoning</p>
                      <TranslatedText text={reasoning} translationEnabled={translationEnabled} />
                    </div>
                  ) : null}

                  {evidenceText ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Evidence</p>
                      <TranslatedText text={evidenceText} translationEnabled={translationEnabled} />
                    </div>
                  ) : null}

                  <details className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <summary className="cursor-pointer text-xs font-medium text-slate-600">
                      Show raw item
                    </summary>
                    <pre className="mt-3 overflow-auto whitespace-pre-wrap break-all text-xs text-slate-600">
                      {JSON.stringify(item, null, 2)}
                    </pre>
                  </details>
                </div>
              );
            })}
          </div>
        </CardContent>
      ) : null}
    </Card>
  );
}
