/**
 * Safely parse arrays that may be JSON strings or already arrays.
 * Handles tags and other array fields from the backend.
 */
export function parseArray(arr) {
  if (!arr) return [];
  if (Array.isArray(arr)) return arr;
  if (typeof arr === 'string') {
    try {
      const parsed = JSON.parse(arr);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function resolveOverrideIds(overrides, systems) {
  return Object.fromEntries(Object.entries(overrides).map(([col, entries]) =>
    [col, Object.fromEntries(Object.entries(entries).map(([sysId, expr]) =>
      [systems.find(s => String(s.id) === String(sysId))?.name || sysId, expr]
    ))]
  ));
}
