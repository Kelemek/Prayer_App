import { describe, it, expect, vi } from 'vitest';
import {
  createScriptureHoverPreviewResourceResolver,
  resolveScriptureHoverPreviewComponentResources,
} from './scripture-hover-preview-component-resources.spec-helper';

describe('resolveScriptureHoverPreviewComponentResources', () => {
  it('resolves scripture hover preview templates', async () => {
    await expect(resolveScriptureHoverPreviewComponentResources()).resolves.toBeUndefined();
  });

  it('createScriptureHoverPreviewResourceResolver reads existing resources', async () => {
    const readFileSync = vi.fn(() => '<template></template>');
    const resolve = createScriptureHoverPreviewResourceResolver({
      existsSync: () => true,
      readFileSync,
    });
    await expect(resolve('popover.html')).resolves.toBe('<template></template>');
    expect(readFileSync).toHaveBeenCalled();
  });

  it('createScriptureHoverPreviewResourceResolver throws when missing', () => {
    const resolve = createScriptureHoverPreviewResourceResolver({
      existsSync: () => false,
      readFileSync: () => '',
    });
    expect(() => resolve('missing.html')).toThrow(/Component resource not found/);
  });
});
