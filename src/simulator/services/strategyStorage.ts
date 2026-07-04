/**
 * TradePro Simulator - Strategy Storage Service
 * Save, load, import, export strategies using sessionStorage.
 */

import type { BuiltStrategy } from "../models/Strategy";

const KEY = "tradepro_strategies";

function load(): BuiltStrategy[] {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save(list: BuiltStrategy[]): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    console.error("Storage save failed");
  }
}

export const strategyStorage = {
  getAll(): BuiltStrategy[] {
    return load();
  },

  saveStrategy(strategy: BuiltStrategy): void {
    const list = load().filter(s => s.id !== strategy.id);
    save([...list, { ...strategy, updatedAt: Date.now() }]);
  },

  deleteStrategy(id: string): void {
    save(load().filter(s => s.id !== id));
  },

  exportStrategy(strategy: BuiltStrategy): void {
    const json = JSON.stringify(strategy, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `${strategy.name.replace(/\s+/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  importStrategy(file: File): Promise<BuiltStrategy> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const strategy = JSON.parse(e.target?.result as string) as BuiltStrategy;
          resolve(strategy);
        } catch {
          reject(new Error("Invalid strategy file"));
        }
      };
      reader.onerror = () => reject(new Error("File read failed"));
      reader.readAsText(file);
    });
  },

  cloneStrategy(strategy: BuiltStrategy): BuiltStrategy {
    return {
      ...strategy,
      id       : crypto.randomUUID(),
      name     : `${strategy.name} (Copy)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status   : "DRAFT",
    };
  },
};
