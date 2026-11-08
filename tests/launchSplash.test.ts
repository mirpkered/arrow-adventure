import { describe, expect, it, vi } from 'vitest';
import { Window } from 'happy-dom';
import { showLaunchSplash, type LaunchSplashWindow } from '../src/app/launchSplash';

function fixture(reducedMotion = false) {
  const dom = new Window();
  const { document } = dom;
  document.body.innerHTML = '<div id="app"></div>';
  const timers: Array<() => void> = [];
  const windowRef = {
    setTimeout: vi.fn((callback: TimerHandler) => { timers.push(callback as () => void); return 0; }),
    matchMedia: vi.fn(() => ({ matches: reducedMotion })),
  } as unknown as LaunchSplashWindow;
  return { document: document as unknown as Document, windowRef, timers };
}

describe('Merpworks launch splash', () => {
  it('matches the reference phase timings and reveals the app after the black transition', () => {
    const { document, windowRef, timers } = fixture();
    const splash = showLaunchSplash(document, windowRef, '/arrow-adventure/branding/mirpworks-logo.jpg')!;
    expect(splash.querySelector('img')?.getAttribute('src')).toBe('/arrow-adventure/branding/mirpworks-logo.jpg');
    expect((windowRef.setTimeout as ReturnType<typeof vi.fn>).mock.calls.map((call) => call[1])).toEqual([750, 1950, 2800, 3000, 3150, 3750, 4550]);
    expect(document.querySelector('#app')?.hasAttribute('data-launch-pending')).toBe(true);
    timers[3]();
    expect(splash.classList.contains('is-revealing-app')).toBe(true);
    timers[4]();
    expect(document.querySelector('#app')?.hasAttribute('data-launch-revealing')).toBe(true);
    timers[5]();
    expect(document.querySelector('.launch-splash')).toBeNull();
    expect(document.querySelector('#app')?.hasAttribute('data-launch-pending')).toBe(false);
  });

  it('uses the reference reduced-motion timings and only initializes one splash', () => {
    const { document, windowRef } = fixture(true);
    const splash = showLaunchSplash(document, windowRef)!;
    expect(splash.dataset.reducedMotion).toBe('true');
    expect(showLaunchSplash(document, windowRef)).toBeUndefined();
    expect((windowRef.setTimeout as ReturnType<typeof vi.fn>).mock.calls.map((call) => call[1])).toEqual([100, 150, 270, 320, 340, 440, 640]);
  });

  it('fails open if the normal finalizer is interrupted', () => {
    const { document, windowRef, timers } = fixture();
    showLaunchSplash(document, windowRef);
    timers[6]();
    expect(document.querySelector('.launch-splash')).toBeNull();
    expect(document.documentElement.hasAttribute('data-launch-pending')).toBe(false);
    expect(document.body.hasAttribute('data-launch-pending')).toBe(false);
  });
});
