const SECRET_KEY_PATTERN =
  /(token|secret|key|authorization|password|bearer)/i;

export function maskSecret(value: string | undefined | null): string {
  if (!value) return '(empty)';
  const trimmed = value.trim();
  if (trimmed.length <= 4) return '****';
  return `****${trimmed.slice(-4)}`;
}

export function maskRecord(
  obj: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SECRET_KEY_PATTERN.test(k) && typeof v === 'string') {
      out[k] = maskSecret(v);
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = maskRecord(v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}
