/** @vitest-environment happy-dom */
import { afterAll, expect, it, vi } from 'vitest';

it('routes title menu controls through Settings, Credits, Play, and saved Continue', async () => {
  vi.useFakeTimers();
  window.localStorage.clear();
  document.body.innerHTML = '<div id="app"></div>';
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  });
  await import('../src/main');
  const app = document.querySelector<HTMLElement>('#app')!;
  const activate = (action: string) => {
    const button = app.querySelector<HTMLButtonElement>(`[data-action="${action}"]`);
    expect(button, `title action ${action} is available`).not.toBeNull();
    button!.click();
  };

  expect(app.querySelector('.title-wordmark')?.textContent).toContain('ADVENTURE');
  expect(app.querySelector('.title-landscape')?.getAttribute('src')).toContain('branding/arrow-adventure-title-scene.svg');
  activate('settings');
  expect(app.querySelector('h1')?.textContent).toBe('Settings');
  activate('back');
  expect(app.querySelector('.title-wordmark')).not.toBeNull();
  activate('credits');
  expect(app.querySelector('h1')?.textContent).toBe('Credits');
  activate('back');
  activate('play');
  expect(app.querySelector('.board')?.getAttribute('aria-label')).toContain('7 arrows remaining');
  activate('pause');
  activate('title');
  expect(app.querySelector('[data-action="continue"]')?.textContent).toContain('LEVEL 1');
  activate('continue');
  expect(app.querySelector('.board')?.getAttribute('aria-label')).toContain('7 arrows remaining');
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});

afterAll(() => { vi.useRealTimers(); });
