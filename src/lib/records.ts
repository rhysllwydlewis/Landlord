export type Row = Record<string, unknown>;
export const obj = (value: unknown): Row =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Row)
    : {};
export const str = (value: unknown) =>
  value === null || value === undefined ? "—" : String(value);
