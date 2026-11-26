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
  it('uses schema-v4 progress keys while keeping preferences independently versioned', () => {
    expect(PRODUCTION_STORAGE_KEYS.game).toBe('arrow-adventure.production.game.v4');
    expect(PRODUCTION_STORAGE_KEYS.previousGame).toBe('arrow-adventure.production.game.v3');
    expect(PRODUCTION_STORAGE_KEYS.retiredGame).toBe('arrow-adventure.production.game.v2');
    expect(PRODUCTION_STORAGE_KEYS.settings).toBe('arrow-adventure.production.settings.v1');
  });

  it('saves and restores completed levels, active arrows, hearts and persistent failure marks', () => {
    const { storage } = storageFixture();
    const first = CURATED_LEVELS[0];
    const save = {
      version: 4 as const,
      catalogVersion: first.catalogVersion,
      contentVersion: first.contentVersion,
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
    const valid = { version: 4, catalogVersion: level.catalogVersion, contentVersion: level.contentVersion, currentLevelId: level.id, completedLevelIds: [], remainingArrowIds: level.puzzle.arrows.map(({ id }) => id), redArrowIds: [], hearts: 3, levelComplete: false };
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
    const save = { version: 4 as const, catalogVersion: level.catalogVersion, contentVersion: level.contentVersion, currentLevelId: level.id, completedLevelIds: [], remainingArrowIds: level.puzzle.arrows.map(({ id }) => id), redArrowIds: [], hearts: 3, levelComplete: false };
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

  it('resets version-2 Adventure progress for the new catalog while preserving appearance and audio preferences', () => {
    const level = CURATED_LEVELS[0];
    const oldSave = JSON.stringify({ version: 2, catalogVersion: 'first-flight-r1', currentLevelId: 'first-flight-010', completedLevelIds: ['first-flight-001'], remainingArrowIds: ['a1'], redArrowIds: [], hearts: 1, levelComplete: false });
    const settings = JSON.stringify({ version: 1, appearance: 'dark', backgroundMusic: false, soundEffects: false });
    const { storage, data } = storageFixture({
      [PRODUCTION_STORAGE_KEYS.retiredGame]: oldSave,
      'arrow-adventure.production.game.v1': oldSave,
      'mirpworks.arrow-adventure.save.v1': oldSave,
      'mirpworks.arrow-adventure.save.v2': oldSave,
      [PRODUCTION_STORAGE_KEYS.settings]: settings,
    });
    retireIncompatibleProgress(storage);
    retireIncompatibleProgress(storage);
    expect(loadGameSave(storage, CURATED_LEVELS)).toBeNull();
    expect(data.has(PRODUCTION_STORAGE_KEYS.retiredGame)).toBe(false);
    expect(data.has('arrow-adventure.production.game.v1')).toBe(false);
    expect(data.has('mirpworks.arrow-adventure.save.v1')).toBe(false);
    expect(data.has('mirpworks.arrow-adventure.save.v2')).toBe(false);
    expect(data.get(PRODUCTION_STORAGE_KEYS.settings)).toBe(settings);
    const newSave = { version: 4 as const, catalogVersion: level.catalogVersion, contentVersion: level.contentVersion, currentLevelId: level.id,
      completedLevelIds: [], remainingArrowIds: level.puzzle.arrows.map(({id}) => id), redArrowIds: [], hearts: 3, levelComplete: false };
    expect(saveGame(storage, newSave)).toBe(true);
    expect(loadGameSave(storage, CURATED_LEVELS)).toEqual(newSave);
  });

  it('migrates v3 in-progress state safely, preserving completed credit and selection while restarting changed geometry', () => {
    const current = CURATED_LEVELS[2];
    const previous = {
      version: 3,
      catalogVersion: 'first-flight-r2-true-grid',
      currentLevelId: current.id,
      completedLevelIds: [CURATED_LEVELS[0].id, CURATED_LEVELS[1].id],
      remainingArrowIds: [current.puzzle.arrows[0].id],
      redArrowIds: [current.puzzle.arrows[0].id],
      hearts: 1,
      levelComplete: false,
    };
    const prefs = JSON.stringify({ version: 1, appearance: 'dark', backgroundMusic: true, soundEffects: false });
    const { storage, data } = storageFixture({
      [PRODUCTION_STORAGE_KEYS.previousGame]: JSON.stringify(previous),
      [PRODUCTION_STORAGE_KEYS.settings]: prefs,
    });
    retireIncompatibleProgress(storage);
    const migrated = loadGameSave(storage, CURATED_LEVELS)!;
    expect(migrated).toEqual({
      version: 4,
      catalogVersion: current.catalogVersion,
      contentVersion: current.contentVersion,
      currentLevelId: current.id,
      completedLevelIds: previous.completedLevelIds,
      remainingArrowIds: current.puzzle.arrows.map(({ id }) => id),
      redArrowIds: [],
      hearts: 3,
      levelComplete: false,
    });
    expect(data.has(PRODUCTION_STORAGE_KEYS.previousGame)).toBe(false);
    expect(JSON.parse(data.get(PRODUCTION_STORAGE_KEYS.game)!)).toEqual(migrated);
    expect(data.get(PRODUCTION_STORAGE_KEYS.settings)).toBe(prefs);
    expect(loadGameSave(storage, CURATED_LEVELS)).toEqual(migrated);
  });

  it('keeps completed-level credit when migrating a v3 completion', () => {
    const current = CURATED_LEVELS[1];
    const previous = {
      version: 3,
      catalogVersion: 'first-flight-r2-true-grid',
      currentLevelId: current.id,
      completedLevelIds: [current.id],
      remainingArrowIds: [],
      redArrowIds: [],
      hearts: 2,
      levelComplete: true,
    };
    const { storage } = storageFixture({ [PRODUCTION_STORAGE_KEYS.previousGame]: JSON.stringify(previous) });
    expect(loadGameSave(storage, CURATED_LEVELS)).toEqual({
      version: 4,
      catalogVersion: current.catalogVersion,
      contentVersion: current.contentVersion,
      currentLevelId: current.id,
      completedLevelIds: [current.id],
      remainingArrowIds: [],
      redArrowIds: [],
      hearts: 2,
      levelComplete: true,
    });
  });

  it('never removes the v3 source save when writing the migrated v4 record fails', () => {
    const level = CURATED_LEVELS[0];
    const oldSave = JSON.stringify({
      version: 3,
      catalogVersion: 'first-flight-r2-true-grid',
      currentLevelId: level.id,
      completedLevelIds: [],
      remainingArrowIds: [level.puzzle.arrows[0].id],
      redArrowIds: [],
      hearts: 1,
      levelComplete: false,
    });
    const data = new Map([[PRODUCTION_STORAGE_KEYS.previousGame, oldSave]]);
    const storage: StorageLike = {
      getItem: (key) => data.get(key) ?? null,
      setItem: (key, value) => { if (key === PRODUCTION_STORAGE_KEYS.game) throw new Error('quota'); data.set(key, value); },
      removeItem: (key) => { data.delete(key); },
    };
    expect(loadGameSave(storage, CURATED_LEVELS)?.version).toBe(4);
    expect(data.get(PRODUCTION_STORAGE_KEYS.previousGame)).toBe(oldSave);
    expect(data.has(PRODUCTION_STORAGE_KEYS.game)).toBe(false);
  });

  it('leaves malformed v3 progress untouched and resets only an incompatible v4 active board', () => {
    const current = CURATED_LEVELS[0];
    const malformed = '{bad v3';
    const { storage, data } = storageFixture({ [PRODUCTION_STORAGE_KEYS.previousGame]: malformed });
    expect(loadGameSave(storage, CURATED_LEVELS)).toBeNull();
    expect(data.get(PRODUCTION_STORAGE_KEYS.previousGame)).toBe(malformed);

    const stale = {
      version: 4,
      catalogVersion: 'first-flight-r2-true-grid',
      contentVersion: 1,
      currentLevelId: current.id,
      completedLevelIds: [CURATED_LEVELS[0].id, CURATED_LEVELS[1].id],
      remainingArrowIds: [current.puzzle.arrows[0].id],
      redArrowIds: [],
      hearts: 1,
      levelComplete: false,
    };
    data.set(PRODUCTION_STORAGE_KEYS.game, JSON.stringify(stale));
    expect(loadGameSave(storage, CURATED_LEVELS)).toEqual({
      version: 4,
      catalogVersion: current.catalogVersion,
      contentVersion: current.contentVersion,
      currentLevelId: current.id,
      completedLevelIds: stale.completedLevelIds,
      remainingArrowIds: current.puzzle.arrows.map(({ id }) => id),
      redArrowIds: [],
      hearts: 3,
      levelComplete: false,
    });
  });

  it('restarts only an in-progress Level 3 save after the c05 content-version bump and preserves preferences', () => {
    const level3 = CURATED_LEVELS[2];
    expect(level3.contentVersion).toBe(3);
    const prior = {
      version: 4,
      catalogVersion: level3.catalogVersion,
      contentVersion: 2,
      currentLevelId: level3.id,
      completedLevelIds: [CURATED_LEVELS[0].id, CURATED_LEVELS[1].id],
      remainingArrowIds: ['c05', 'c06', 'c09'],
      redArrowIds: ['c05'],
      hearts: 1,
      levelComplete: false,
    };
    const settings = JSON.stringify({ version: 1, appearance: 'dark', backgroundMusic: false, soundEffects: true });
    const { storage, data } = storageFixture({
      [PRODUCTION_STORAGE_KEYS.game]: JSON.stringify(prior),
      [PRODUCTION_STORAGE_KEYS.settings]: settings,
    });

    expect(loadGameSave(storage, CURATED_LEVELS)).toEqual({
      version: 4,
      catalogVersion: level3.catalogVersion,
      contentVersion: 3,
      currentLevelId: level3.id,
      completedLevelIds: prior.completedLevelIds,
      remainingArrowIds: level3.puzzle.arrows.map(({ id }) => id),
      redArrowIds: [],
      hearts: 3,
      levelComplete: false,
    });
    expect(data.get(PRODUCTION_STORAGE_KEYS.settings)).toBe(settings);
  });
});
