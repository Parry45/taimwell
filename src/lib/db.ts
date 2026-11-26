import Dexie, { Table } from 'dexie';
import { useLiveQuery } from 'dexie-react-hooks';
import { supabase } from './supabase';
import type { Kind, Row } from './types';

interface Meta {
  key: string;
  value: string;
}

class TaimDB extends Dexie {
  rows!: Table<Row, string>;
  meta!: Table<Meta, string>;
  constructor() {
    super('taimwell');
    this.version(1).stores({ rows: 'id, kind, dirty', meta: 'key' });
  }
}

export const db = new TaimDB();

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  // RFC4122 v4 fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** Save (insert or replace) an object locally; it syncs in the background. */
export async function put<T extends { id: string }>(kind: Kind, data: T): Promise<T> {
  const clean = JSON.parse(JSON.stringify(data)) as T;
  await db.rows.put({ id: clean.id, kind, data: clean, deleted: 0, dirty: 1 });
  scheduleSync();
  return clean;
}

export async function putMany<T extends { id: string }>(kind: Kind, items: T[]): Promise<void> {
  if (!items.length) return;
  await db.rows.bulkPut(items.map((d) => ({ id: d.id, kind, data: JSON.parse(JSON.stringify(d)), deleted: 0 as const, dirty: 1 as const })));
  scheduleSync();
}

export async function remove(id: string): Promise<void> {
  const r = await db.rows.get(id);
  if (!r) return;
  await db.rows.put({ ...r, deleted: 1, dirty: 1 });
  scheduleSync();
}

export async function removeMany(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const rows = await db.rows.bulkGet(ids);
  await db.rows.bulkPut(rows.filter((r): r is Row => !!r).map((r) => ({ ...r, deleted: 1 as const, dirty: 1 as const })));
  scheduleSync();
}

export async function getAll<T>(kind: Kind): Promise<T[]> {
  const rows = await db.rows.where('kind').equals(kind).toArray();
  return rows.filter((r) => !r.deleted).map((r) => r.data as T);
}

/** Live-updating list of objects of one kind (undefined while loading). */
export function useRows<T>(kind: Kind): T[] | undefined {
  return useLiveQuery(() => getAll<T>(kind), [kind]);
}

// ---------------------------------------------------------------- sync

export type SyncState = 'idle' | 'syncing' | 'offline' | 'error';
interface SyncInfo {
  state: SyncState;
  at: Date | null;
  error: string | null;
}
let info: SyncInfo = { state: 'idle', at: null, error: null };
const listeners = new Set<(i: SyncInfo) => void>();
function setInfo(p: Partial<SyncInfo>) {
  info = { ...info, ...p };
  listeners.forEach((l) => l(info));
}
export function onSync(l: (i: SyncInfo) => void): () => void {
  listeners.add(l);
  l(info);
  return () => {
    listeners.delete(l);
  };
}

let timer: ReturnType<typeof setTimeout> | undefined;
export function scheduleSync(ms = 1200) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    void syncNow();
  }, ms);
}

let running: Promise<void> | null = null;
export function syncNow(): Promise<void> {
  if (running) return running;
  running = doSync()
    .catch((e: unknown) => {
      setInfo({ state: 'error', error: e instanceof Error ? e.message : String(e) });
    })
    .finally(() => {
      running = null;
    });
  return running;
}

async function doSync(): Promise<void> {
  if (!supabase) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    setInfo({ state: 'offline' });
    return;
  }
  const { data: sess } = await supabase.auth.getSession();
  if (!sess.session) return;
  setInfo({ state: 'syncing', error: null });

  // 1 · push local changes
  const dirty = await db.rows.where('dirty').equals(1).toArray();
  for (let i = 0; i < dirty.length; i += 200) {
    const chunk = dirty.slice(i, i + 200);
    const { error } = await supabase
      .from('records')
      .upsert(chunk.map((r) => ({ id: r.id, kind: r.kind, data: r.data, deleted: r.deleted === 1 })), { onConflict: 'id' });
    if (error) throw new Error(error.message);
    await db.transaction('rw', db.rows, async () => {
      for (const r of chunk) {
        const cur = await db.rows.get(r.id);
        // only clear the flag if nothing changed while we were uploading
        if (cur && cur.deleted === r.deleted && JSON.stringify(cur.data) === JSON.stringify(r.data)) {
          await db.rows.update(r.id, { dirty: 0 });
        }
      }
    });
  }

  // 2 · pull remote changes since last pull
  let last = (await db.meta.get('lastPulled'))?.value || '1970-01-01T00:00:00.000Z';
  for (;;) {
    const { data, error } = await supabase
      .from('records')
      .select('id,kind,data,deleted,updated_at')
      .gt('updated_at', last)
      .order('updated_at', { ascending: true })
      .limit(500);
    if (error) throw new Error(error.message);
    const rows = (data || []) as { id: string; kind: Kind; data: unknown; deleted: boolean; updated_at: string }[];
    if (!rows.length) break;
    await db.transaction('rw', db.rows, async () => {
      for (const r of rows) {
        const cur = await db.rows.get(r.id);
        if (cur && cur.dirty === 1) continue; // local edit wins; it will be pushed next round
        await db.rows.put({ id: r.id, kind: r.kind, data: r.data, deleted: r.deleted ? 1 : 0, dirty: 0, updatedAt: r.updated_at });
      }
    });
    last = rows[rows.length - 1].updated_at;
    if (rows.length < 500) break;
  }
  await db.meta.put({ key: 'lastPulled', value: last });
  setInfo({ state: 'idle', at: new Date(), error: null });
}

let started = false;
export function startSyncLoop() {
  if (started || typeof window === 'undefined') return;
  started = true;
  window.addEventListener('online', () => void syncNow());
  window.addEventListener('offline', () => setInfo({ state: 'offline' }));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void syncNow();
  });
  setInterval(() => void syncNow(), 60_000);
}

export async function clearLocal() {
  await db.rows.clear();
  await db.meta.clear();
}
