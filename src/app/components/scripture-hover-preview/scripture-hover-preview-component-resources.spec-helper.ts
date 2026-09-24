import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ɵresolveComponentResources as resolveComponentResources } from '@angular/core';

const componentDir = dirname(fileURLToPath(import.meta.url));

export type ScriptureHoverPreviewResourceIo = {
  existsSync: (path: string) => boolean;
  readFileSync: (path: string, encoding: 'utf-8') => string;
};

const defaultResourceIo: ScriptureHoverPreviewResourceIo = {
  existsSync,
  readFileSync,
};

export function createScriptureHoverPreviewResourceResolver(
  io: ScriptureHoverPreviewResourceIo = defaultResourceIo
): (url: string) => Promise<string> {
  return (url) => {
    const path = join(componentDir, url);
    if (!io.existsSync(path)) {
      throw new Error(`Component resource not found: ${url}`);
    }
    return Promise.resolve(io.readFileSync(path, 'utf-8'));
  };
}

export async function resolveScriptureHoverPreviewComponentResources(
  io: ScriptureHoverPreviewResourceIo = defaultResourceIo
): Promise<void> {
  await resolveComponentResources(createScriptureHoverPreviewResourceResolver(io));
}
