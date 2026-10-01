import { signal } from '@angular/core';
import {
  Event as RouterEvent,
  Navigation,
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
} from '@angular/router';
import { Subject } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  APP_BOOT_SCREEN_ID,
  armAppBootScreenFailsafe,
  bindAppBootScreenDismissal,
  dismissAppBootScreen,
} from './app-boot-screen';

function mountOverlay(): void {
  const overlay = document.createElement('div');
  overlay.id = APP_BOOT_SCREEN_ID;
  document.body.appendChild(overlay);
}

function mountOutlet(): void {
  document.body.appendChild(document.createElement('router-outlet'));
}

function fakeRouter(
  events: Subject<RouterEvent>,
  lastSuccessful: Navigation | null = null
): Pick<Router, 'events' | 'lastSuccessfulNavigation'> {
  return {
    events: events.asObservable() as Router['events'],
    lastSuccessfulNavigation: signal(lastSuccessful),
  };
}

function cleanupBootScreen(): void {
  dismissAppBootScreen();
  document.querySelectorAll('router-outlet').forEach((el) => el.remove());
}

describe('dismissAppBootScreen', () => {
  afterEach(() => {
    cleanupBootScreen();
    vi.useRealTimers();
  });

  it('removes the overlay when it is present', () => {
    mountOverlay();
    dismissAppBootScreen();
    expect(document.getElementById(APP_BOOT_SCREEN_ID)).toBeNull();
  });

  it('is a no-op when the overlay is already gone', () => {
    expect(() => dismissAppBootScreen()).not.toThrow();
  });

  it('clears an armed failsafe so a later timeout cannot strip a remounted overlay', () => {
    vi.useFakeTimers();
    mountOverlay();
    armAppBootScreenFailsafe(15_000);
    dismissAppBootScreen();

    mountOverlay();
    vi.advanceTimersByTime(15_000);
    expect(document.getElementById(APP_BOOT_SCREEN_ID)).not.toBeNull();
  });

  it('dismisses when the failsafe fires', () => {
    vi.useFakeTimers();
    mountOverlay();
    armAppBootScreenFailsafe(15_000);
    vi.advanceTimersByTime(15_000);
    expect(document.getElementById(APP_BOOT_SCREEN_ID)).toBeNull();
  });
});

describe('bindAppBootScreenDismissal', () => {
  afterEach(() => {
    cleanupBootScreen();
  });

  it('dismisses immediately when there is no router-outlet', () => {
    mountOverlay();
    const events = new Subject<RouterEvent>();

    bindAppBootScreenDismissal(fakeRouter(events));

    expect(document.getElementById(APP_BOOT_SCREEN_ID)).toBeNull();
  });

  it('dismisses immediately when the first navigation already completed', () => {
    mountOverlay();
    mountOutlet();
    const events = new Subject<RouterEvent>();

    bindAppBootScreenDismissal(fakeRouter(events, { id: 1 } as Navigation));

    expect(document.getElementById(APP_BOOT_SCREEN_ID)).toBeNull();
  });

  it('waits through a guard redirect cancel for the first NavigationEnd', () => {
    mountOverlay();
    mountOutlet();
    const events = new Subject<RouterEvent>();

    bindAppBootScreenDismissal(fakeRouter(events));

    events.next(new NavigationStart(1, '/'));
    events.next(new NavigationCancel(1, '/', 'guard redirect'));
    expect(document.getElementById(APP_BOOT_SCREEN_ID)).not.toBeNull();

    events.next(new NavigationEnd(1, '/login', '/login'));
    expect(document.getElementById(APP_BOOT_SCREEN_ID)).toBeNull();

    mountOverlay();
    events.next(new NavigationEnd(2, '/', '/'));
    expect(document.getElementById(APP_BOOT_SCREEN_ID)).not.toBeNull();
  });

  it('dismisses on NavigationError', () => {
    mountOverlay();
    mountOutlet();
    const events = new Subject<RouterEvent>();

    bindAppBootScreenDismissal(fakeRouter(events));
    events.next(new NavigationError(1, '/', 'fail'));

    expect(document.getElementById(APP_BOOT_SCREEN_ID)).toBeNull();
  });
});
