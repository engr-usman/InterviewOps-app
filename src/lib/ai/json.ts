export function extractFirstJsonBlock(text: string): string | null {
  const trimmed = text.trim();
  const firstObj = trimmed.indexOf("{");
  const firstArr = trimmed.indexOf("[");
  const start = firstObj === -1 ? firstArr : firstArr === -1 ? firstObj : Math.min(firstObj, firstArr);
  if (start === -1) return null;

  const open = trimmed[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  for (let i = start; i < trimmed.length; i += 1) {
    const ch = trimmed[i];
    if (ch === open) depth += 1;
    if (ch === close) depth -= 1;
    if (depth === 0) return trimmed.slice(start, i + 1);
  }

  return null;
}

export function safeJsonParse<T>(text: string): T | null {
  const block = extractFirstJsonBlock(text);
  if (!block) return null;
  try {
    return JSON.parse(block) as T;
  } catch {
    return null;
  }
}

