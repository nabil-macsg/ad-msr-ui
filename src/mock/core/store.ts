/**
 * The demo's in-memory database: named collections of records, seeded from `src/mock/data`.
 * Changes are kept in this browser's localStorage under a demo-only key, so they survive a
 * refresh; `resetDemoData()` goes back to the seed. Nothing here reaches a real MASAR backend.
 */
const STORAGE_KEY = 'masar-demo:data:v1';

type Row = { id: string } & Record<string, unknown>;
const seeds = new Map<string, () => Row[]>();
let tables: Record<string, Row[]> | null = null;

function load(): Record<string, Row[]> {
  if (tables) return tables;
  try {
    tables = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, Row[]>;
  } catch {
    tables = {};
  }
  return tables;
}

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tables));
  } catch {
    // Storage full or blocked: the demo keeps working in memory.
  }
}

/** Declares a collection and its seed rows (called once per collection at start-up). */
export function seed<T extends { id: string }>(name: string, rows: () => T[]): void {
  seeds.set(name, rows);
}

export function all<T>(name: string): T[] {
  const db = load();
  if (!db[name]) db[name] = (seeds.get(name)?.() ?? []).map((r) => structuredClone(r));
  return db[name] as unknown as T[];
}

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- the collection's row type
export function find<T extends { id: string }>(name: string, id: string): T | undefined {
  return all<T>(name).find((r) => r.id === id);
}

export function insert<T extends { id: string }>(name: string, row: T): T {
  all<T>(name).unshift(row);
  persist();
  return row;
}

export function replace<T extends { id: string }>(name: string, row: T): T {
  const rows = all<T>(name);
  const i = rows.findIndex((r) => r.id === row.id);
  if (i >= 0) rows[i] = row;
  persist();
  return row;
}

export function removeRow(name: string, id: string): void {
  const rows = all<Row>(name);
  const i = rows.findIndex((r) => r.id === id);
  if (i >= 0) rows.splice(i, 1);
  persist();
}

export function resetDemoData(): void {
  tables = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing saved.
  }
}

let counter = 0;
/** A new record id; stable seed ids are written by hand in the data files. */
export function newId(): string {
  counter += 1;
  const random = Math.floor(Math.random() * 0xffffffff)
    .toString(16)
    .padStart(8, '0');
  return `d0d0${random.slice(0, 4)}-${random.slice(4, 8)}-4000-8000-${String(Date.now() + counter)
    .slice(-12)
    .padStart(12, '0')}`;
}

export const now = (): string => new Date().toISOString();
