// 1. fázis: tiszta echo-logika, LLM és DB nélkül. A CLI ezt hívja
// single-shot és interaktív módban is - proposal-implementacio.md B1.
export function echo(input: string): string {
  return `echo: ${input}`;
}
