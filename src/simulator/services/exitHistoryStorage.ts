/**
 * TradePro Simulator - Exit History Storage Service
 *
 * Persists ExitRecords (manual partial/full exits) across refresh, re-render,
 * and reconnect. Uses localStorage (not sessionStorage) deliberately — exit
 * history should survive closing and reopening the browser/tab, same as the
 * bookmarks/last-session data in useHistoricalChain.ts already does; a
 * refresh mid-session must not lose a trader's exit record.
 *
 * Keyed by legId so lookups for a specific leg's exit rows (what Position
 * Book renders) don't require scanning/filtering the whole list on every
 * render — get(legId) is a direct read.
 */

import type { ExitRecord } from "../models/Exit";

const KEY = "tradepro_exit_history";

function loadAll(): ExitRecord[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveAll(list: ExitRecord[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    console.error("Exit history storage save failed");
  }
}

export const exitHistoryStorage = {
  getAll(): ExitRecord[] {
    return loadAll();
  },

  getForLeg(legId: string): ExitRecord[] {
    return loadAll()
      .filter(r => r.legId === legId)
      .sort((a, b) => a.exitTime - b.exitTime);
  },

  add(record: ExitRecord): void {
    saveAll([...loadAll(), record]);
  },

  // Only used when a leg itself is permanently deleted (not just closed) —
  // e.g. removing a CUSTOM leg before any exit was ever taken on it, or
  // removing a CLOSED leg's row from the list entirely. A CLOSED leg's
  // history is intentionally cleared here rather than left orphaned.
  clearForLeg(legId: string): void {
    saveAll(loadAll().filter(r => r.legId !== legId));
  },
};
