// Vitest setup file - automatically loaded before running tests

import { TestBed } from '@angular/core/testing';
import { BrowserDynamicTestingModule, platformBrowserDynamicTesting } from '@angular/platform-browser-dynamic/testing';
import { afterEach, beforeEach } from 'vitest';

// Initialize TestBed IMMEDIATELY at module load time
// This must be the first thing that happens
try {
  TestBed.initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting(), {
    teardown: { destroyAfterEach: true }
  });
} catch (e: any) {
  // TestBed already initialized, which is fine
  console.log('TestBed already initialized');
}

// Only reset after test completes to avoid leaving TestBed in bad state
afterEach(() => {
  try {
    TestBed.resetTestingModule();
  } catch (e) {
    // Ignore reset errors
  }
});

// Setup localStorage mock
beforeEach(() => {
  const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => {
        store[key] = value.toString();
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        store = {};
      },
      get length() {
        return Object.keys(store).length;
      },
      key: (index: number) => {
        const keys = Object.keys(store);
        return keys[index] || null;
      },
    };
  })();

  Object.defineProperty(global, 'localStorage', {
    value: localStorageMock,
    writable: true,
    configurable: true,
  });
});



