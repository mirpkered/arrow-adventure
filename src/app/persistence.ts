import type { CuratedLevel } from '../game/types';

export type StorageEnvironment = 'production' | 'qa';
export type StorageKeys = { game: string; previousGame: string; retiredGame: string; settings: string };
export function storageKeysFor(environment: StorageEnvironment): StorageKeys {
  return {
    game: `arrow-adventure.${environment}.game.v4`,
    previousGame: `arrow-adventure.${environment}.game.v3`,
    retiredGame: `arrow-adventure.${environment}.game.v2`,
    settings: `arrow-adventure.${environment}.settings.v1`,
  };
}
export const PRODUCTION_STORAGE_KEYS = storageKeysFor('production');
export const QA_STORAGE_KEYS = storageKeysFor('qa');

export type GameSave = {
  version: 4;
  catalogVersion: string;
  contentVersion: number;
  currentLevelId: string;
  completedLevelIds: string[];
  remainingArrowIds: string[];
  redArrowIds: string[];
  hearts: number;
  levelComplete: boolean;
};

export type Appearance = 'light' | 'dark' | 'automatic';
export type PlayerSettings = { version: 1; appearance: Appearance; backgroundMusic: boolean; soundEffects: boolean };
export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function prefersDarkTheme(appearance: Appearance, systemPrefersDark: boolean): boolean {
  return appearance === 'dark' || (appearance === 'automatic' && systemPrefersDark);
}

export const DEFAULT_SETTINGS: PlayerSettings = {
  version: 1,
  appearance: 'light',
  backgroundMusic: false,
  soundEffects: true,
};

function readJson(storage: StorageLike, key: string): unknown {
  try {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) as unknown : null;
  } catch { return null; }
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string') && new Set(value).size === value.length;
}

export function retireIncompatibleProgress(storage: StorageLike, keys = PRODUCTION_STORAGE_KEYS): void {
  try {
    storage.removeItem(keys.retiredGame);
    storage.removeItem(keys.game.replace(/\.v4$/, '.v1'));
    storage.removeItem('mirpworks.arrow-adventure.save.v1');
    storage.removeItem('mirpworks.arrow-adventure.save.v2');
  } catch { /* The catalog versioned key keeps old saves from loading even if removal is blocked. */ }
}

export function loadGameSave(storage: StorageLike, catalog: readonly CuratedLevel[], keys = PRODUCTION_STORAGE_KEYS): GameSave | null {
  const current = readJson(storage, keys.game);
  if (current && typeof current === 'object') {
    const normalized = normalizeCurrentSave(current as Record<string, unknown>, catalog);
    if (normalized) {
      if (normalized.migrated) saveGame(storage, normalized.save, keys);
      return normalized.save;
    }
  }

  // Schema v3 has no content-version binding. Keep stable completion credit
  // and the selected level, but restart an in-progress board against its new
  // geometry. Write v4 successfully before removing the source record.
  const previous = readJson(storage, keys.previousGame);
  if (!previous || typeof previous !== 'object') return null;
  const legacy = previous as Record<string, unknown>;
  if (legacy.version !== 3 || typeof legacy.catalogVersion !== 'string' || !legacy.catalogVersion
    || typeof legacy.currentLevelId !== 'string' || !isStringArray(legacy.completedLevelIds)
    || !isStringArray(legacy.remainingArrowIds) || !isStringArray(legacy.redArrowIds)
    || !Number.isInteger(legacy.hearts) || (legacy.hearts as number) < 0 || (legacy.hearts as number) > 3
    || typeof legacy.levelComplete !== 'boolean') return null;
  const legacyRemaining = legacy.remainingArrowIds as string[];
  const level = catalog.find((entry) => entry.id === legacy.currentLevelId);
  if (!level || (legacy.levelComplete && (legacyRemaining.length > 0 || !legacy.completedLevelIds.includes(level.id)))
    || (!legacy.levelComplete && legacyRemaining.length === 0)
    || (legacy.redArrowIds as string[]).some((id) => !legacyRemaining.includes(id))) return null;
  const knownLevels = new Set(catalog.map(({ id }) => id));
  const completedLevelIds = legacy.completedLevelIds.filter((id) => knownLevels.has(id));
  if (legacy.levelComplete && !completedLevelIds.includes(level.id)) return null;
  const save: GameSave = legacy.levelComplete
    ? { version: 4, catalogVersion: level.catalogVersion, contentVersion: level.contentVersion, currentLevelId: level.id,
      completedLevelIds, remainingArrowIds: [], redArrowIds: [], hearts: legacy.hearts as number, levelComplete: true }
    : { version: 4, catalogVersion: level.catalogVersion, contentVersion: level.contentVersion, currentLevelId: level.id,
      completedLevelIds, remainingArrowIds: level.puzzle.arrows.map(({ id }) => id), redArrowIds: [], hearts: 3, levelComplete: false };
  if (saveGame(storage, save, keys)) {
    try { storage.removeItem(keys.previousGame); } catch { /* The v4 record takes precedence on the next launch. */ }
  }
  return save;
}

function normalizeCurrentSave(data: Record<string, unknown>, catalog: readonly CuratedLevel[]): { save: GameSave; migrated: boolean } | null {
  if (data.version !== 4 || typeof data.catalogVersion !== 'string' || !data.catalogVersion
    || !Number.isInteger(data.contentVersion) || (data.contentVersion as number) < 1
    || typeof data.currentLevelId !== 'string' || !isStringArray(data.completedLevelIds)
    || !isStringArray(data.remainingArrowIds) || !isStringArray(data.redArrowIds)
    || !Number.isInteger(data.hearts) || (data.hearts as number) < 0 || (data.hearts as number) > 3
    || typeof data.levelComplete !== 'boolean') return null;
  const level = catalog.find(({ id }) => id === data.currentLevelId);
  if (!level) return null;
  if (data.catalogVersion !== level.catalogVersion
    && data.catalogVersion !== 'first-flight-r3-compact-weave'
    && data.catalogVersion !== 'first-flight-r2-true-grid') return null;
  const knownLevels = new Set(catalog.map(({ id }) => id));
  const completedLevelIds = (data.completedLevelIds as string[]).filter((id) => knownLevels.has(id));
  if (data.levelComplete && ((data.remainingArrowIds as string[]).length > 0 || !completedLevelIds.includes(level.id))) return null;
  if (!data.levelComplete && (data.remainingArrowIds as string[]).length === 0) return null;
  // Catalog additions alone do not invalidate a saved board. The stable level
  // identity and per-level content version decide whether its geometry changed.
  const staleContent = data.contentVersion !== level.contentVersion;
  if (staleContent) {
    const save: GameSave = data.levelComplete
      ? { version: 4, catalogVersion: level.catalogVersion, contentVersion: level.contentVersion, currentLevelId: level.id,
        completedLevelIds, remainingArrowIds: [], redArrowIds: [], hearts: data.hearts as number, levelComplete: true }
      : { version: 4, catalogVersion: level.catalogVersion, contentVersion: level.contentVersion, currentLevelId: level.id,
        completedLevelIds, remainingArrowIds: level.puzzle.arrows.map(({ id }) => id), redArrowIds: [], hearts: 3, levelComplete: false };
    return { save, migrated: true };
  }
  const knownArrows = new Set(level.puzzle.arrows.map(({ id }) => id));
  if ((data.remainingArrowIds as string[]).some((id) => !knownArrows.has(id))
    || (data.redArrowIds as string[]).some((id) => !(data.remainingArrowIds as string[]).includes(id))) return null;
  return { save: {
    version: 4,
    catalogVersion: level.catalogVersion,
    contentVersion: level.contentVersion as number,
    currentLevelId: level.id,
    completedLevelIds,
    remainingArrowIds: [...data.remainingArrowIds as string[]],
    redArrowIds: [...data.redArrowIds as string[]],
    hearts: data.hearts as number,
    levelComplete: data.levelComplete,
  }, migrated: data.catalogVersion !== level.catalogVersion };
}

export function saveGame(storage: StorageLike, save: GameSave, keys = PRODUCTION_STORAGE_KEYS): boolean {
  try { storage.setItem(keys.game, JSON.stringify(save)); return true; } catch { return false; }
}

export function clearGameSave(storage: StorageLike, keys = PRODUCTION_STORAGE_KEYS): void {
  try { storage.removeItem(keys.game); storage.removeItem(keys.previousGame); } catch { /* Storage can be disabled by the browser. */ }
}

export function loadSettings(storage: StorageLike, keys = PRODUCTION_STORAGE_KEYS): PlayerSettings {
  const data = readJson(storage, keys.settings);
  if (!data || typeof data !== 'object') return { ...DEFAULT_SETTINGS };
  const candidate = data as Partial<PlayerSettings>;
  return {
    version: 1,
    appearance: candidate.appearance === 'light' || candidate.appearance === 'dark' || candidate.appearance === 'automatic'
      ? candidate.appearance : DEFAULT_SETTINGS.appearance,
    backgroundMusic: typeof candidate.backgroundMusic === 'boolean' ? candidate.backgroundMusic : DEFAULT_SETTINGS.backgroundMusic,
    soundEffects: typeof candidate.soundEffects === 'boolean' ? candidate.soundEffects : DEFAULT_SETTINGS.soundEffects,
  };
}

export function saveSettings(storage: StorageLike, settings: PlayerSettings, keys = PRODUCTION_STORAGE_KEYS): boolean {
  try { storage.setItem(keys.settings, JSON.stringify({ ...settings, version: 1 })); return true; } catch { return false; }
}
