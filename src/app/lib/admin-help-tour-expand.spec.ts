import { describe, it, expect } from 'vitest';
import {
  isAdminSectionStillLoading,
  isCollapsibleTriggerExpanded,
} from './admin-help-tour-expand';

describe('isCollapsibleTriggerExpanded', () => {
  it('reads aria-expanded', () => {
    const el = document.createElement('button');
    el.setAttribute('aria-expanded', 'true');
    expect(isCollapsibleTriggerExpanded(el)).toBe(true);
    el.setAttribute('aria-expanded', 'false');
    expect(isCollapsibleTriggerExpanded(el)).toBe(false);
  });
});

describe('isAdminSectionStillLoading', () => {
  it('detects data-admin-section-loading', () => {
    const root = document.createElement('div');
    expect(isAdminSectionStillLoading(root)).toBe(false);
    const loader = document.createElement('div');
    loader.setAttribute('data-admin-section-loading', 'true');
    root.appendChild(loader);
    expect(isAdminSectionStillLoading(root)).toBe(true);
  });
});
