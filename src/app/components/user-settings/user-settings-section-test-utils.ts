import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ɵresolveComponentResources as resolveComponentResources } from '@angular/core';

export async function resolveComponentTemplateDir(componentDir: string): Promise<void> {
  await resolveComponentResources((url) =>
    Promise.resolve(readFileSync(join(componentDir, url), 'utf-8'))
  );
}

export function componentDirFromImportMeta(importMetaUrl: string): string {
  return dirname(fileURLToPath(importMetaUrl));
}
