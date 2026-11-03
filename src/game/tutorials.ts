export const DIAGONAL_TUTORIAL_REF = 'diagonal-movement';
const DIAGONAL_TUTORIAL_KEY = 'mirpworks.arrow-adventure.tutorial.diagonal-movement.v1';

export type TutorialStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function shouldShowTutorial(reference: string | undefined, storage: TutorialStorage): boolean {
  return reference === DIAGONAL_TUTORIAL_REF && storage.getItem(DIAGONAL_TUTORIAL_KEY) !== 'seen';
}

export function markTutorialSeen(reference: string | undefined, storage: TutorialStorage): void {
  if (reference === DIAGONAL_TUTORIAL_REF) storage.setItem(DIAGONAL_TUTORIAL_KEY, 'seen');
}
