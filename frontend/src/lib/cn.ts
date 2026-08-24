type ClassInput = string | number | bigint | boolean | null | undefined;

/** Minimal class joiner. Avoids pulling a dependency for string concatenation. */
export function cn(...inputs: ClassInput[]): string {
  let out = '';
  for (const input of inputs) {
    if (!input || typeof input !== 'string') continue;
    out = out ? `${out} ${input}` : input;
  }
  return out;
}
