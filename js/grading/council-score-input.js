export function normalizeBoundedScoreInput(value, minScore, maxScore) {
  if (value === '' || value === null || value === undefined) return '';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '';
  if (numeric < minScore) return String(minScore);
  if (numeric > maxScore) return String(maxScore);
  return String(value);
}
