import catalogData from './catalog/adventure-v1.json';
import catalogV2Data from './catalog/adventure-v2.json';
import catalogV3Data from './catalog/adventure-v3.json';
import { LEGACY_GENERATOR_ID, LEGACY_GENERATOR_VERSION, reproduceLegacyLevel } from './levels';
import { solveLevel, validateLevel } from './rules';
import type { Level } from './types';

export const MECHANIC_IDS = ['standard-arrow', 'diagonal-arrow', 'black-hole', 'switch', 'directional-gate', 'portal'] as const;
export type MechanicId = typeof MECHANIC_IDS[number];
export type Difficulty = 'gentle' | 'easy' | 'medium' | 'hard' | 'expert';

export const ADVENTURE_CHAPTERS = [
  { id: 'first-flight', title: 'First Flight', provisional: true },
  { id: 'into-the-void', title: 'Into the Void', provisional: true },
  { id: 'changing-paths', title: 'Changing Paths', provisional: true },
  { id: 'through-the-looking-glass', title: 'Through the Looking Glass', provisional: true },
  { id: 'worlds-collide', title: 'Worlds Collide', provisional: true },
] as const;

/** Provisional Adventure introduction targets; these are metadata, not rule activation. */
export const MECHANIC_INTRODUCTIONS: Record<MechanicId, { chapterId: string; targetSequence: number; provisional: boolean }> = {
  'standard-arrow': { chapterId: 'first-flight', targetSequence: 1, provisional: false },
  'diagonal-arrow': { chapterId: 'first-flight', targetSequence: 21, provisional: false },
  'black-hole': { chapterId: 'into-the-void', targetSequence: 41, provisional: true },
  switch: { chapterId: 'changing-paths', targetSequence: 61, provisional: true },
  'directional-gate': { chapterId: 'changing-paths', targetSequence: 61, provisional: true },
  portal: { chapterId: 'through-the-looking-glass', targetSequence: 86, provisional: true },
};

export type LevelProvenance =
  | { kind: 'generated'; generatorId: string; generatorVersion: number; seed: number }
  | { kind: 'authored'; authoringSource?: string };

export type AdventureLevel = {
  id: string;
  displayNumber: number;
  /** Progression ordering, kept independent from stable identity and UI numbering. */
  sequence: number;
  chapterId: string;
  contentVersion: number;
  difficulty: Difficulty;
  mechanicIds: MechanicId[];
  tutorialRef?: string;
  authoringNotes?: string;
  provenance: LevelProvenance;
  puzzle: Level;
};

type CatalogFile = { catalogVersion: number; entries: AdventureLevel[] };
const data = catalogData as unknown as CatalogFile;
const dataV2 = catalogV2Data as unknown as CatalogFile;
const dataV3 = catalogV3Data as unknown as CatalogFile;
export const ADVENTURE_LEVELS: readonly AdventureLevel[] = [...data.entries, ...dataV2.entries, ...dataV3.entries];
export const ADVENTURE_CATALOG_VERSION = dataV3.catalogVersion;
export const TUTORIAL_REFERENCES: readonly string[] = ['diagonal-movement'];

const byId = new Map(ADVENTURE_LEVELS.map((entry) => [entry.id, entry]));
const byNumber = new Map(ADVENTURE_LEVELS.map((entry) => [entry.displayNumber, entry]));
const bySequence = new Map(ADVENTURE_LEVELS.map((entry) => [entry.sequence, entry]));
const chapterIds = new Set<string>(ADVENTURE_CHAPTERS.map((chapter) => chapter.id));
const mechanicIds = new Set<string>(MECHANIC_IDS);
const difficultyIds = new Set<string>(['gentle', 'easy', 'medium', 'hard', 'expert']);

for (const [mechanicId, introduction] of Object.entries(MECHANIC_INTRODUCTIONS)) {
  if (!mechanicIds.has(mechanicId) || !chapterIds.has(introduction.chapterId) || !Number.isInteger(introduction.targetSequence) || introduction.targetSequence < 1) {
    throw new Error(`Invalid introduction metadata for mechanic ${mechanicId}`);
  }
}

export function getAdventureLevelById(id: string): AdventureLevel | undefined { return byId.get(id); }
export function getAdventureLevelByDisplayNumber(number: number): AdventureLevel | undefined { return byNumber.get(number); }
export function getAdventureLevelBySequence(sequence: number): AdventureLevel | undefined { return bySequence.get(sequence); }
export function getAdventureLevelsInProgressionOrder(): AdventureLevel[] {
  return [...ADVENTURE_LEVELS].sort((left, right) => left.sequence - right.sequence);
}
export function getFirstAdventureLevel(): AdventureLevel | undefined {
  return ADVENTURE_LEVELS.reduce<AdventureLevel | undefined>((first, entry) => !first || entry.sequence < first.sequence ? entry : first, undefined);
}
export function getHighestUnlockedSequence(levelId: string): number {
  return getAdventureLevelById(levelId)?.sequence ?? getFirstAdventureLevel()?.sequence ?? 1;
}
export function isAdventureLevelUnlocked(entry: AdventureLevel, highestUnlockedLevelId: string): boolean {
  return entry.sequence <= getHighestUnlockedSequence(highestUnlockedLevelId);
}
export function getNextAdventureLevel(entry: AdventureLevel): AdventureLevel | undefined {
  return getAdventureLevelBySequence(entry.sequence + 1);
}

export function reproduceAdventureLevel(entry: AdventureLevel): Level {
  if (entry.provenance.kind === 'authored') return structuredClone(entry.puzzle);
  if (entry.provenance.generatorId !== LEGACY_GENERATOR_ID || entry.provenance.generatorVersion !== LEGACY_GENERATOR_VERSION) {
    throw new Error(`Unsupported generator for ${entry.id}`);
  }
  return reproduceLegacyLevel(entry.provenance.seed, entry.displayNumber, entry.puzzle.arrows.length);
}

export function validateCatalog(
  entries: readonly AdventureLevel[],
  options: { chapterIds?: ReadonlySet<string>; tutorialRefs?: ReadonlySet<string> } = {},
): void {
  if (entries.length === 0) throw new Error('Catalog cannot be empty');
  if (!Number.isInteger(ADVENTURE_CATALOG_VERSION) || ADVENTURE_CATALOG_VERSION < 1) throw new Error('Invalid catalog version');
  const chapters = options.chapterIds ?? chapterIds;
  const tutorials = options.tutorialRefs ?? new Set(TUTORIAL_REFERENCES);
  const ids = new Set<string>();
  const numbers = new Set<number>();
  const sequences = new Set<number>();
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') throw new Error('Catalog entry must be an object');
    if (typeof entry.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.id)) throw new Error(`Invalid stable level ID: ${entry.id}`);
    if (ids.has(entry.id)) throw new Error(`Duplicate level ID: ${entry.id}`);
    ids.add(entry.id);
    if (!Number.isInteger(entry.displayNumber) || entry.displayNumber < 1) throw new Error(`${entry.id} has an invalid display number`);
    if (numbers.has(entry.displayNumber)) throw new Error(`Duplicate display number: ${entry.displayNumber}`);
    numbers.add(entry.displayNumber);
    if (!Number.isInteger(entry.sequence) || entry.sequence < 1) throw new Error(`${entry.id} has an invalid progression sequence`);
    if (sequences.has(entry.sequence)) throw new Error(`Duplicate progression sequence: ${entry.sequence}`);
    sequences.add(entry.sequence);
    if (typeof entry.chapterId !== 'string' || !chapters.has(entry.chapterId)) throw new Error(`${entry.id} references unknown chapter ${entry.chapterId}`);
    if (!Number.isInteger(entry.contentVersion) || entry.contentVersion < 1) throw new Error(`${entry.id} has an invalid content version`);
    if (!difficultyIds.has(entry.difficulty)) throw new Error(`${entry.id} has unsupported difficulty ${entry.difficulty}`);
    if (!Array.isArray(entry.mechanicIds) || entry.mechanicIds.length === 0) throw new Error(`${entry.id} needs at least one mechanic tag`);
    const seenMechanics = new Set<string>();
    for (const mechanic of entry.mechanicIds) {
      if (!mechanicIds.has(mechanic)) throw new Error(`${entry.id} references unsupported mechanic ${mechanic}`);
      if (seenMechanics.has(mechanic)) throw new Error(`${entry.id} repeats mechanic ${mechanic}`);
      const introduction = MECHANIC_INTRODUCTIONS[mechanic as MechanicId];
      if (!introduction || entry.sequence < introduction.targetSequence) throw new Error(`${entry.id} uses ${mechanic} before its introduction target`);
      seenMechanics.add(mechanic);
    }
    if (entry.tutorialRef !== undefined && !tutorials.has(entry.tutorialRef)) throw new Error(`${entry.id} references unknown tutorial ${entry.tutorialRef}`);
    if (!entry.provenance || typeof entry.provenance !== 'object' || !['authored', 'generated'].includes(entry.provenance.kind)) throw new Error(`${entry.id} has invalid provenance metadata`);
    if (!entry.puzzle || typeof entry.puzzle !== 'object') throw new Error(`${entry.id} has no puzzle definition`);
    if (!Number.isInteger(entry.puzzle.width) || entry.puzzle.width < 1 || !Number.isInteger(entry.puzzle.height) || entry.puzzle.height < 1) throw new Error(`${entry.id} has invalid puzzle dimensions`);
    if (entry.puzzle.number !== entry.displayNumber) throw new Error(`${entry.id} puzzle number does not match its display number`);
    if (entry.provenance.kind === 'generated') {
      if (typeof entry.provenance.generatorId !== 'string' || !Number.isInteger(entry.provenance.seed) || !Number.isInteger(entry.provenance.generatorVersion) || entry.provenance.generatorVersion < 1) throw new Error(`${entry.id} has invalid generation metadata`);
      if (!Number.isInteger(entry.puzzle.seed)) throw new Error(`${entry.id} has an invalid puzzle seed`);
      if (entry.puzzle.seed !== entry.provenance.seed) throw new Error(`${entry.id} puzzle seed does not match its generation metadata`);
    } else if (entry.puzzle.seed !== undefined && !Number.isInteger(entry.puzzle.seed)) {
      throw new Error(`${entry.id} has an invalid optional puzzle seed`);
    }
    validateLevel(entry.puzzle);
    const reproduced = reproduceAdventureLevel(entry);
    if (JSON.stringify(reproduced) !== JSON.stringify(entry.puzzle)) throw new Error(`${entry.id} differs from its recorded deterministic definition`);
    if (!solveLevel(entry.puzzle)) throw new Error(`${entry.id} has no verified solution`);
  }
  if (sequences.size > 0) {
    const ordered = [...sequences].sort((left, right) => left - right);
    if (ordered[0] !== 1 || ordered.some((sequence, index) => sequence !== index + 1)) throw new Error('Catalog progression sequences must be contiguous and start at 1');
  }
}

validateCatalog(ADVENTURE_LEVELS);
