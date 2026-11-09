import { describe, expect, it } from 'vitest';
import { CURATED_LEVELS } from '../src/game/catalog';
import { DEFAULT_SETTINGS, PRODUCTION_STORAGE_KEYS, QA_STORAGE_KEYS, loadGameSave, loadSettings, prefersDarkTheme, retireIncompatibleProgress, saveGame, saveSettings, type StorageLike } from '../src/app/persistence';

function storageFixture(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const storage: StorageLike = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, value); },
    removeItem: (key) => { data.delete(key); },
  };
  return { storage, data };
}

describe('local game persistence', () => {
  it('saves and restores completed levels, active arrows, hearts and persistent failure marks', () => {
    const { storage } = storageFixture();
    const first = CURATED_LEVELS[0];
    const save = {
      version: 2 as const,
      catalogVersion: first.catalogVersion,
      currentLevelId: first.id,
      completedLevelIds: [],
      remainingArrowIds: first.puzzle.arrows.map((arrow) => arrow.id),
      redArrowIds: [first.puzzle.arrows[0].id],
      hearts: 2,
      levelComplete: false,
    };
    expect(saveGame(storage, save)).toBe(true);
    expect(loadGameSave(storage, CURATED_LEVELS)).toEqual(save);
  });

  it('ignores old release keys and leaves malformed data intact for recovery', () => {
    const oldValue = JSON.stringify({ highestUnlocked: 40, completed: Array.from({ length: 40 }, (_, index) => index + 1) });
    const broken = '{broken';
    const { storage, data } = storageFixture({ 'mirpworks.arrow-adventure.save.v2': oldValue, [PRODUCTION_STORAGE_KEYS.game]: broken });
    expect(loadGameSave(storage, CURATED_LEVELS)).toBeNull();
    expect(data.get(PRODUCTION_STORAGE_KEYS.game)).toBe(broken);
    expect(data.get('mirpworks.arrow-adventure.save.v2')).toBe(oldValue);
  });

  it('rejects unknown content, invalid hearts, and inconsistent completion records', () => {
    const { storage } = storageFixture();
    const level = CURATED_LEVELS[0];
    const valid = { version: 2, catalogVersion: level.catalogVersion, currentLevelId: level.id, completedLevelIds: [], remainingArrowIds: level.puzzle.arrows.map(({ id }) => id), redArrowIds: [], hearts: 3, levelComplete: false };
    for (const invalid of [
      { ...valid, currentLevelId: 'legacy-level-040' },
      { ...valid, catalogVersion: 'retired-catalog' },
      { ...valid, hearts: 4 },
      { ...valid, redArrowIds: ['unknown-arrow'] },
      { ...valid, levelComplete: true },
      { ...valid, remainingArrowIds: [] },
    ]) {
      storage.setItem(PRODUCTION_STORAGE_KEYS.game, JSON.stringify(invalid));
      expect(loadGameSave(storage, CURATED_LEVELS)).toBeNull();
    }
  });

  it('persists appearance and independent audio preferences with safe defaults', () => {
    const { storage } = storageFixture();
    expect(loadSettings(storage)).toEqual(DEFAULT_SETTINGS);
    const settings = { version: 1 as const, appearance: 'dark' as const, backgroundMusic: true, soundEffects: false };
    expect(saveSettings(storage, settings)).toBe(true);
    expect(loadSettings(storage)).toEqual(settings);
    storage.setItem(PRODUCTION_STORAGE_KEYS.settings, JSON.stringify({ version: 1, appearance: 'invalid', backgroundMusic: false, soundEffects: true }));
    expect(loadSettings(storage).appearance).toBe('light');
  });

  it('defaults first launches to Light and preserves valid explicit Light, Dark, and Automatic preferences', () => {
    const { storage } = storageFixture();
    expect(DEFAULT_SETTINGS.appearance).toBe('light');
    expect(loadSettings(storage).appearance).toBe('light');
    for (const appearance of ['light', 'dark', 'automatic'] as const) {
      const settings = { ...DEFAULT_SETTINGS, appearance };
      expect(saveSettings(storage, settings)).toBe(true);
      expect(loadSettings(storage).appearance).toBe(appearance);
    }
    expect(prefersDarkTheme('light', true)).toBe(false);
    expect(prefersDarkTheme('dark', false)).toBe(true);
    expect(prefersDarkTheme('automatic', true)).toBe(true);
    expect(prefersDarkTheme('automatic', false)).toBe(false);
  });

  it('isolates QA progress and preferences from production on the shared GitHub Pages origin', () => {
    const { storage } = storageFixture();
    const level = CURATED_LEVELS[0];
    const save = { version: 2 as const, catalogVersion: level.catalogVersion, currentLevelId: level.id, completedLevelIds: [], remainingArrowIds: level.puzzle.arrows.map(({ id }) => id), redArrowIds: [], hearts: 3, levelComplete: false };
    const qaSettings = { version: 1 as const, appearance: 'dark' as const, backgroundMusic: false, soundEffects: false };
    saveGame(storage, save, QA_STORAGE_KEYS);
    saveSettings(storage, qaSettings, QA_STORAGE_KEYS);
    expect(loadGameSave(storage, CURATED_LEVELS)).toBeNull();
    expect(loadSettings(storage)).toEqual(DEFAULT_SETTINGS);
    expect(loadGameSave(storage, CURATED_LEVELS, QA_STORAGE_KEYS)).toEqual(save);
    expect(loadSettings(storage, QA_STORAGE_KEYS)).toEqual(qaSettings);
    expect(QA_STORAGE_KEYS.game).not.toBe(PRODUCTION_STORAGE_KEYS.game);
    expect(QA_STORAGE_KEYS.settings).not.toBe(PRODUCTION_STORAGE_KEYS.settings);
  });

  it('retires old Round 8 progress while preserving unrelated saved preferences', () => {
    const level = CURATED_LEVELS[0];
    const oldSave = JSON.stringify({ version: 1, currentLevelId: 'shared-board-006', completedLevelIds: ['shared-board-001'] });
    const settings = JSON.stringify({ version: 1, appearance: 'dark', backgroundMusic: false, soundEffects: false });
    const { storage, data } = storageFixture({
      [PRODUCTION_STORAGE_KEYS.retiredGame]: oldSave,
      'mirpworks.arrow-adventure.save.v1': oldSave,
      'mirpworks.arrow-adventure.save.v2': oldSave,
      [PRODUCTION_STORAGE_KEYS.settings]: settings,
    });
    retireIncompatibleProgress(storage);
    retireIncompatibleProgress(storage);
    expect(loadGameSave(storage, CURATED_LEVELS)).toBeNull();
    expect(data.has(PRODUCTION_STORAGE_KEYS.retiredGame)).toBe(false);
    expect(data.has('mirpworks.arrow-adventure.save.v1')).toBe(false);
    expect(data.has('mirpworks.arrow-adventure.save.v2')).toBe(false);
    expect(data.get(PRODUCTION_STORAGE_KEYS.settings)).toBe(settings);
    const newSave = { version: 2 as const, catalogVersion: level.catalogVersion, currentLevelId: level.id,
      completedLevelIds: [], remainingArrowIds: level.puzzle.arrows.map(({id}) => id), redArrowIds: [], hearts: 3, levelComplete: false };
    expect(saveGame(storage, newSave)).toBe(true);
    expect(loadGameSave(storage, CURATED_LEVELS)).toEqual(newSave);
  });
});
