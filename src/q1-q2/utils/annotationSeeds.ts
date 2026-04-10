import type { LoadedManualCheckItem } from '../types';

export function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function buildReviewSeeds(judgeOutput: Record<string, unknown> | undefined) {
  return [
    ...(Array.isArray(judgeOutput?.pair_reviews)
      ? judgeOutput.pair_reviews.map((item: Record<string, unknown>, index: number) => ({
          reviewKind: 'pair_reviews' as const,
          reviewId: `${item.gold_id ?? 'gold'}:${item.pred_id ?? 'pred'}:${index}`,
          title: `${item.gold_id ?? 'gold'} -> ${item.pred_id ?? 'pred'}`,
          rationale: typeof item.rationale === 'string' ? item.rationale : JSON.stringify(item, null, 2),
        }))
      : []),
    ...(Array.isArray(judgeOutput?.missing_reviews)
      ? judgeOutput.missing_reviews.map((item: Record<string, unknown>, index: number) => ({
          reviewKind: 'missing_reviews' as const,
          reviewId: `${item.id ?? 'missing'}:${index}`,
          title: `Missing ${item.id ?? index + 1}`,
          rationale: typeof item.rationale === 'string' ? item.rationale : JSON.stringify(item, null, 2),
        }))
      : []),
    ...(Array.isArray(judgeOutput?.extra_reviews)
      ? judgeOutput.extra_reviews.map((item: Record<string, unknown>, index: number) => ({
          reviewKind: 'extra_reviews' as const,
          reviewId: `${item.id ?? 'extra'}:${index}`,
          title: `Extra ${item.id ?? index + 1}`,
          rationale: typeof item.rationale === 'string' ? item.rationale : JSON.stringify(item, null, 2),
        }))
      : []),
  ];
}

export function buildQ1Task1GoldMemorySeeds(loadedItem?: LoadedManualCheckItem | null) {
  const original = asRecord(loadedItem?.itemData?.original);
  const probe = asRecord(original?.probe);

  return Array.isArray(probe?.ground_truth_memories)
    ? probe.ground_truth_memories
        .map((item: unknown, index: number) => {
          const record = asRecord(item);
          if (!record || !String(record.value ?? '').trim()) return null;
          return {
            ...record,
            memory_id:
              typeof record.memory_id === 'string' && record.memory_id.trim()
                ? record.memory_id
                : `memory-${index + 1}`,
          };
        })
        .filter(Boolean)
    : [];
}

export function buildQ1Task2NewDialogueSeeds(loadedItem?: LoadedManualCheckItem | null) {
  const original = asRecord(loadedItem?.itemData?.original);
  const record = asRecord(original?.record);

  return Array.isArray(record?.new_dialogue)
    ? record.new_dialogue
        .map((item: unknown, index: number) => {
          const turn = asRecord(item);
          const text = turn && typeof turn.text === 'string' ? turn.text : '';
          const role = turn && typeof turn.role === 'string' ? turn.role : 'unknown';
          if (!text.trim()) return null;
          return { turnId: `turn-${index + 1}`, role, text };
        })
        .filter(Boolean)
    : [];
}

export function buildQ1Task2UpdatedMemorySeeds(loadedItem?: LoadedManualCheckItem | null) {
  const original = asRecord(loadedItem?.itemData?.original);
  return Array.isArray(original?.answer)
    ? original.answer
        .map((item: unknown, index: number) => {
          const record = asRecord(item);
          if (!record || !String(record.value ?? '').trim()) return null;
          return {
            ...record,
            memory_id:
              typeof record.memory_id === 'string' && record.memory_id.trim()
                ? record.memory_id
                : `memory-${index + 1}`,
          };
        })
        .filter(Boolean)
    : [];
}

export function getQ1Task3QuerySeed(loadedItem?: LoadedManualCheckItem | null): string {
  const original = asRecord(loadedItem?.itemData?.original);
  return original && typeof original.query === 'string' ? original.query : '';
}

export function getQ1Task3SelectedMemorySeed(
  loadedItem?: LoadedManualCheckItem | null,
): Record<string, unknown> | null {
  const original = asRecord(loadedItem?.itemData?.original);
  const selectedMemory = asRecord(original?.selected_memory);
  return selectedMemory ? { ...selectedMemory } : null;
}

export function buildQuerySeeds(loadedItem?: LoadedManualCheckItem | null) {
  const original = asRecord(loadedItem?.itemData?.original);
  return Array.isArray(original?.queries)
    ? original.queries
        .map((item: unknown, index: number) => {
          const record = asRecord(item);
          const queryText = typeof record?.query === 'string' ? record.query : '';
          if (!queryText.trim()) return null;
          return {
            queryId:
              typeof record?.query_id === 'string' && record.query_id.trim()
                ? record.query_id
                : `query-${index + 1}`,
            queryText,
          };
        })
        .filter(Boolean)
    : [];
}

export function buildTask4QuerySeeds(loadedItem?: LoadedManualCheckItem | null) {
  const original = asRecord(loadedItem?.itemData?.original);
  const modelOutput = asRecord(loadedItem?.itemData?.model_output);
  const judgeOutputRaw = loadedItem?.itemData?.judge_output_raw;

  const responseByQueryId = new Map<string, string>();
  if (Array.isArray(modelOutput?.responses)) {
    modelOutput.responses.forEach((item: unknown, index: number) => {
      const record = asRecord(item);
      const responseText = typeof record?.response === 'string' ? record.response : '';
      const queryId =
        typeof record?.query_id === 'string' && record.query_id.trim()
          ? record.query_id
          : `query-${index + 1}`;
      if (responseText.trim()) responseByQueryId.set(queryId, responseText);
    });
  }

  const fallbackResponseText =
    typeof modelOutput?.response_text === 'string'
      ? modelOutput.response_text
      : typeof modelOutput?.response === 'string'
        ? modelOutput.response
        : '';

  const queryList = Array.isArray(original?.queries) ? original.queries : [];
  return queryList
    .map((item: unknown, index: number) => {
      const record = asRecord(item);
      const queryText = typeof record?.query === 'string' ? record.query : '';
      if (!queryText.trim()) return null;

      const queryId =
        typeof record?.query_id === 'string' && record.query_id.trim()
          ? record.query_id
          : `query-${index + 1}`;

      const responseText =
        responseByQueryId.get(queryId) ??
        (queryList.length === 1 ? fallbackResponseText : '') ??
        '';

      let judgeVisiblePayload: unknown;
      if (Array.isArray(judgeOutputRaw)) {
        judgeVisiblePayload = judgeOutputRaw[index];
      } else if (index === 0) {
        judgeVisiblePayload = judgeOutputRaw;
      }

      return { queryId, queryText, responseText, judgeVisiblePayload };
    })
    .filter(Boolean);
}
