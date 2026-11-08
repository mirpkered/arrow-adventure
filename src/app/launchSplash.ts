const NORMAL_TIMING = { holdingMs: 750, fadeToBlackMs: 1950, blackHoldMs: 2800, revealOverlayMs: 3000, revealAppMs: 3150, completeMs: 3750, failOpenMs: 4550 } as const;
const REDUCED_MOTION_TIMING = { holdingMs: 100, fadeToBlackMs: 150, blackHoldMs: 270, revealOverlayMs: 320, revealAppMs: 340, completeMs: 440, failOpenMs: 640 } as const;

export type LaunchSplashWindow = Pick<Window, 'setTimeout'> & { matchMedia?: (query: string) => MediaQueryList };

/** Mirrors the Word Search Adventure splash and runs only once during the initial app boot. */
export function showLaunchSplash(
  documentRef: Document = document,
  windowRef: LaunchSplashWindow = window,
  logoUrl = `${import.meta.env.BASE_URL}branding/mirpworks-logo.jpg`,
): HTMLElement | undefined {
  let splash = documentRef.querySelector<HTMLElement>('.launch-splash');
  if (splash?.dataset.launchInitialized === 'true') return undefined;

  const app = documentRef.querySelector<HTMLElement>('#app');
  const root = documentRef.documentElement;
  const body = documentRef.body;
  root.setAttribute('data-launch-pending', '');
  body.setAttribute('data-launch-pending', '');
  app?.setAttribute('data-launch-pending', '');

  if (!splash) {
    splash = documentRef.createElement('div');
    splash.className = 'launch-splash';
    splash.setAttribute('aria-hidden', 'true');
    splash.innerHTML = `<img class="launch-splash-logo" src="${logoUrl}" alt="">`;
    body.append(splash);
  }
  splash.dataset.launchInitialized = 'true';
  splash.dataset.launchPhase = 'entering';
  splash.classList.add('is-entering');

  const reducedMotion = windowRef.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const timing = reducedMotion ? REDUCED_MOTION_TIMING : NORMAL_TIMING;
  if (reducedMotion) splash.dataset.reducedMotion = 'true';

  const complete = () => {
    if (!splash.isConnected) return;
    splash.remove();
    app?.removeAttribute('data-launch-revealing');
    app?.removeAttribute('data-launch-pending');
    body.removeAttribute('data-launch-pending');
    root.removeAttribute('data-launch-pending');
  };

  windowRef.setTimeout(() => { splash.dataset.launchPhase = 'holding'; }, timing.holdingMs);
  windowRef.setTimeout(() => { splash.classList.add('is-fading-to-black'); splash.dataset.launchPhase = 'fading-to-black'; }, timing.fadeToBlackMs);
  windowRef.setTimeout(() => { splash.classList.add('is-black'); splash.dataset.launchPhase = 'black-hold'; }, timing.blackHoldMs);
  windowRef.setTimeout(() => { splash.classList.add('is-revealing-app'); splash.dataset.launchPhase = 'revealing-app'; }, timing.revealOverlayMs);
  windowRef.setTimeout(() => {
    app?.removeAttribute('data-launch-pending');
    app?.setAttribute('data-launch-revealing', '');
    body.removeAttribute('data-launch-pending');
    root.removeAttribute('data-launch-pending');
  }, timing.revealAppMs);
  windowRef.setTimeout(complete, timing.completeMs);
  windowRef.setTimeout(complete, timing.failOpenMs);
  return splash;
}
