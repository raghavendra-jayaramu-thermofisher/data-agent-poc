const sensitiveKeyPattern = /(^|[_-])(password|passwd|pwd|secret|api[_-]?key|access[_-]?token|refresh[_-]?token|authorization|credential)([_-]|$)/i;
export function isSensitiveKey(key: string): boolean { return sensitiveKeyPattern.test(key); }
export function safeDisplayEntries(value: Record<string, unknown>): Array<[
    string,
    unknown
]> { return Object.entries(value).filter(([key]) => !isSensitiveKey(key)); }

const MAX_DISPLAY_DEPTH = 6;

export function redactSensitiveValue(value: unknown, depth = 0): unknown {
  if (depth >= MAX_DISPLAY_DEPTH) return '[Nested data]';
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => redactSensitiveValue(item, depth + 1));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !isSensitiveKey(key))
        .map(([key, nested]) => [key, redactSensitiveValue(nested, depth + 1)]),
    );
  }
  return value;
}

export function safeJsonStringify(value: unknown): string {
  try { return JSON.stringify(redactSensitiveValue(value), null, 2); }
  catch { return '[Unavailable]'; }
}
