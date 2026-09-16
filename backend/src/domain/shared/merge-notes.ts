export const mergeNotes = (
  targetNote?: string | null,
  sourceNote?: string | null,
  draftNote?: string | null,
): string => {
  const seen = new Set<string>();
  const merged: string[] = [];

  for (const raw of [targetNote, sourceNote, draftNote]) {
    if (!raw) continue;
    const trimmed = String(raw).trim();
    if (!trimmed) continue;
    if (!seen.has(trimmed)) {
      seen.add(trimmed);
      merged.push(trimmed);
    }
  }

  return merged.join('\n');
};
