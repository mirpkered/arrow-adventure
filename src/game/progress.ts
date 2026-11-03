import type { SaveData } from './types';

const SAVE_KEY = 'mirpworks.arrow-adventure.save.v1';
const EMPTY_SAVE: SaveData = { highestUnlocked: 1, completed: [] };

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function loadProgress(storage: StorageLike): SaveData {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(SAVE_KEY) ?? 'null');
    if (!parsed || typeof parsed !== 'object') return { ...EMPTY_SAVE, completed: [] };
    const data = parsed as Partial<SaveData>;
    const highestUnlocked = Number.isInteger(data.highestUnlocked) ? Math.max(1, Math.min(10, data.highestUnlocked!)) : 1;
    const completed = Array.isArray(data.completed)
      ? [...new Set(data.completed.filter((value): value is number => Number.isInteger(value) && value >= 1 && value <= 10))].sort((a, b) => a - b)
      : [];
    return { highestUnlocked, completed };
  } catch {
    return { ...EMPTY_SAVE, completed: [] };
  }
}

export function saveProgress(storage: StorageLike, data: SaveData): void {
  storage.setItem(SAVE_KEY, JSON.stringify(data));
}

export function markLevelComplete(data: SaveData, level: number): SaveData {
  const completed = [...new Set([...data.completed, level])].sort((a, b) => a - b);
  return { completed, highestUnlocked: Math.max(data.highestUnlocked, Math.min(10, level + 1)) };
}
