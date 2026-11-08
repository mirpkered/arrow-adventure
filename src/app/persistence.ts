import type { CuratedLevel } from '../game/types';

export type StorageEnvironment = 'production' | 'qa';
export type StorageKeys = { game: string; settings: string };
export function storageKeysFor(environment: StorageEnvironment): StorageKeys {
  return { game: `arrow-adventure.${environment}.game.v1`, settings: `arrow-adventure.${environment}.settings.v1` };
}
export const PRODUCTION_STORAGE_KEYS = storageKeysFor('production');
export const QA_STORAGE_KEYS = storageKeysFor('qa');

export type GameSave = {
  version: 1;
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

export function loadGameSave(storage: StorageLike, catalog: readonly CuratedLevel[], keys = PRODUCTION_STORAGE_KEYS): GameSave | null {
  const data = readJson(storage, keys.game);
  if (!data || typeof data !== 'object') return null;
  const candidate = data as Partial<GameSave>;
  if (candidate.version !== 1 || typeof candidate.currentLevelId !== 'string'
    || !isStringArray(candidate.completedLevelIds) || !isStringArray(candidate.remainingArrowIds)
    || !isStringArray(candidate.redArrowIds) || !Number.isInteger(candidate.hearts)
    || candidate.hearts! < 0 || candidate.hearts! > 3 || typeof candidate.levelComplete !== 'boolean') return null;
  const level = catalog.find((entry) => entry.id === candidate.currentLevelId);
  if (!level) return null;
  const knownLevels = new Set(catalog.map((entry) => entry.id));
  const knownArrows = new Set(level.puzzle.arrows.map((arrow) => arrow.id));
  if (candidate.completedLevelIds.some((id) => !knownLevels.has(id))
    || candidate.remainingArrowIds.some((id) => !knownArrows.has(id))
    || candidate.redArrowIds.some((id) => !candidate.remainingArrowIds!.includes(id))) return null;
  if (candidate.levelComplete && (candidate.remainingArrowIds.length > 0 || !candidate.completedLevelIds.includes(level.id))) return null;
  if (!candidate.levelComplete && candidate.remainingArrowIds.length === 0) return null;
  return {
    version: 1,
    currentLevelId: level.id,
    completedLevelIds: [...candidate.completedLevelIds],
    remainingArrowIds: [...candidate.remainingArrowIds],
    redArrowIds: [...candidate.redArrowIds],
    hearts: candidate.hearts!,
    levelComplete: candidate.levelComplete,
  };
}

export function saveGame(storage: StorageLike, save: GameSave, keys = PRODUCTION_STORAGE_KEYS): boolean {
  try { storage.setItem(keys.game, JSON.stringify(save)); return true; } catch { return false; }
}

export function clearGameSave(storage: StorageLike, keys = PRODUCTION_STORAGE_KEYS): void {
  try { storage.removeItem(keys.game); } catch { /* Storage can be disabled by the browser. */ }
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
