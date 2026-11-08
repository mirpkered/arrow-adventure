import { describe, expect, it } from 'vitest';
import { CURATED_LEVELS } from '../src/game/catalog';
import { DEFAULT_SETTINGS, PRODUCTION_STORAGE_KEYS, QA_STORAGE_KEYS, loadGameSave, loadSettings, saveGame, saveSettings, type StorageLike } from '../src/app/persistence';

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
      version: 1 as const,
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
    const valid = { version: 1, currentLevelId: level.id, completedLevelIds: [], remainingArrowIds: level.puzzle.arrows.map(({ id }) => id), redArrowIds: [], hearts: 3, levelComplete: false };
    for (const invalid of [
      { ...valid, currentLevelId: 'legacy-level-040' },
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
    expect(loadSettings(storage).appearance).toBe('automatic');
  });

  it('isolates QA progress and preferences from production on the shared GitHub Pages origin', () => {
    const { storage } = storageFixture();
    const level = CURATED_LEVELS[0];
    const save = { version: 1 as const, currentLevelId: level.id, completedLevelIds: [], remainingArrowIds: level.puzzle.arrows.map(({ id }) => id), redArrowIds: [], hearts: 3, levelComplete: false };
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
});
