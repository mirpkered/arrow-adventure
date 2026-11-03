import {
  getAdventureLevelById,
  getAdventureLevelBySequence,
  getFirstAdventureLevel,
  getHighestUnlockedSequence,
  isAdventureLevelUnlocked,
  type AdventureLevel,
} from './catalog';
import type { SaveData } from './types';

const LEGACY_SAVE_KEY = 'mirpworks.arrow-adventure.save.v1';
const CURRENT_SAVE_KEY = 'mirpworks.arrow-adventure.save.v2';
const LEGACY_LEVEL_ID_BY_NUMBER: Readonly<Record<number, string>> = {
  1: 'first-flight-001', 2: 'first-flight-002', 3: 'first-flight-003', 4: 'first-flight-004', 5: 'first-flight-005',
  6: 'first-flight-006', 7: 'first-flight-007', 8: 'first-flight-008', 9: 'first-flight-009', 10: 'first-flight-010',
};

function getLegacyLevel(number: number): AdventureLevel | undefined {
  const id = LEGACY_LEVEL_ID_BY_NUMBER[number];
  return id ? getAdventureLevelById(id) : undefined;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function createFreshProgress(): SaveData {
  const first = getFirstAdventureLevel();
  if (!first) throw new Error('Adventure catalog has no starting level');
  return { schemaVersion: 2, highestUnlockedLevelId: first.id, selectedLevelId: first.id, completedLevelIds: [] };
}

function parseRaw(storage: StorageLike, key: string): unknown | undefined {
  try {
    const raw = storage.getItem(key);
    return raw === null ? undefined : JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

function validId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function parseCurrent(value: unknown): SaveData | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<SaveData>;
  if (candidate.schemaVersion !== 2 || !validId(candidate.highestUnlockedLevelId) || !validId(candidate.selectedLevelId) || !Array.isArray(candidate.completedLevelIds)) return null;
  if (!candidate.completedLevelIds.every(validId)) return null;

  const first = getFirstAdventureLevel();
  if (!first) return null;
  const highest = getAdventureLevelById(candidate.highestUnlockedLevelId) ?? first;
  const selected = getAdventureLevelById(candidate.selectedLevelId);
  const selectedLevelId = selected && isAdventureLevelUnlocked(selected, highest.id) ? selected.id : highest.id;
  return {
    schemaVersion: 2,
    highestUnlockedLevelId: highest.id,
    selectedLevelId,
    // Retain unknown stable IDs as completion credit; they do not unlock any catalog entry.
    completedLevelIds: [...new Set(candidate.completedLevelIds)],
  };
}

/** Map the original 1–10 save explicitly. The v1 key is never removed or overwritten. */
export function migrateLegacyProgress(value: unknown): SaveData | null {
  if (!value || typeof value !== 'object') return null;
  const legacy = value as { highestUnlocked?: unknown; completed?: unknown; selectedLevel?: unknown };
  if (!Number.isInteger(legacy.highestUnlocked) || !Array.isArray(legacy.completed) || !legacy.completed.every(Number.isInteger)) return null;

  const legacyHighest = Math.max(1, Math.min(10, legacy.highestUnlocked as number));
  const highestEntry = getLegacyLevel(legacyHighest);
  if (!highestEntry) return null;
  const completedEntries = legacy.completed
    .filter((number): number is number => typeof number === 'number' && number >= 1 && number <= 10)
    .map((number) => getLegacyLevel(number))
    .filter((entry): entry is AdventureLevel => entry !== undefined);
  const requestedSelection = Number.isInteger(legacy.selectedLevel) ? getLegacyLevel(legacy.selectedLevel as number) : undefined;
  const selected = requestedSelection && requestedSelection.sequence <= highestEntry.sequence ? requestedSelection : highestEntry;
  return {
    schemaVersion: 2,
    highestUnlockedLevelId: highestEntry.id,
    selectedLevelId: selected.id,
    completedLevelIds: [...new Set(completedEntries.map((entry) => entry.id))],
  };
}

function writeCurrent(storage: StorageLike, data: SaveData): boolean {
  try {
    storage.setItem(CURRENT_SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadProgress(storage: StorageLike): SaveData {
  const currentRaw = parseRaw(storage, CURRENT_SAVE_KEY);
  if (currentRaw !== undefined) {
    const current = parseCurrent(currentRaw);
    if (current) return current;
  }

  const legacyRaw = parseRaw(storage, LEGACY_SAVE_KEY);
  if (legacyRaw !== undefined) {
    const migrated = migrateLegacyProgress(legacyRaw);
    if (migrated) {
      // If this write fails, v1 remains intact and migration can be retried next launch.
      writeCurrent(storage, migrated);
      return migrated;
    }
    return createFreshProgress();
  }
  return createFreshProgress();
}

export function saveProgress(storage: StorageLike, data: SaveData): boolean {
  if (!parseCurrent(data)) throw new Error('Refusing to write invalid Adventure progress');
  return writeCurrent(storage, data);
}

export function selectAdventureLevel(data: SaveData, levelId: string): SaveData {
  const entry = getAdventureLevelById(levelId);
  if (!entry || !isAdventureLevelUnlocked(entry, data.highestUnlockedLevelId)) return data;
  return { ...data, selectedLevelId: entry.id };
}

export function isAdventureLevelComplete(data: SaveData, entry: AdventureLevel): boolean {
  return data.completedLevelIds.includes(entry.id);
}

export function markLevelComplete(data: SaveData, entry: AdventureLevel): SaveData {
  const completedLevelIds = [...new Set([...data.completedLevelIds, entry.id])];
  const highestSequence = getHighestUnlockedSequence(data.highestUnlockedLevelId);
  const next = entry.sequence >= highestSequence ? getAdventureLevelBySequence(entry.sequence + 1) : undefined;
  const highestUnlockedLevelId = next?.id ?? data.highestUnlockedLevelId;
  return {
    ...data,
    completedLevelIds,
    highestUnlockedLevelId,
    // Preserve the prototype's Continue behavior: return to the latest unlocked level.
    selectedLevelId: highestUnlockedLevelId,
  };
}
