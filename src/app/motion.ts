export const NORMAL_MOVE_SPEED = 21;
export const RETURN_MOVE_SPEED = 40;
export const MOVE_DURATION_CAP_MS = 1500;

/** Movement timing is presentation-only; puzzle legality is handled by the simulator. */
export function movementDuration(distance: number, speed: number, reducedMotion = false): number {
  if (reducedMotion) return Math.min(140, Math.max(70, distance / Math.max(speed, 0.01) * 1000));
  return Math.max(80, Math.min(MOVE_DURATION_CAP_MS, distance / Math.max(speed, 0.01) * 1000));
}
