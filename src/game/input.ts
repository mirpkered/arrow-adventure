/** Suppresses duplicated rapid activation while keeping ordinary single taps immediate. */
export function createActionGate(cooldownMs = 220): { accept: (now: number) => boolean; reset: () => void } {
  let nextActionAt = 0;
  return {
    accept(now: number) {
      if (now < nextActionAt) return false;
      nextActionAt = now + cooldownMs;
      return true;
    },
    reset() { nextActionAt = 0; },
  };
}
