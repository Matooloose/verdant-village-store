// Helpers for safe error message extraction
export function getErrorMessage(err: unknown): string {
  if (!err) return 'Unknown error';
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message;
  try {
    // Try to read common fields used by Supabase errors
    const e = err as any;
    if (e?.message) return String(e.message);
    if (e?.error) return String(e.error);
    if (typeof e === 'object') return JSON.stringify(e);
  } catch (e) {
    // ignore
  }
  return String(err);
}
