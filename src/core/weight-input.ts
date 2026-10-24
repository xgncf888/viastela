/** Accepts a kg value the database check constraint will also accept. */
export function parseWeightKg(input: string): number | null {
  const normalized = input.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0 || value >= 500) return null;
  return value;
}
