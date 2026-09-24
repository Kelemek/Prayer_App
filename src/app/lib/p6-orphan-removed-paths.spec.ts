import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { P6_ORPHAN_REMOVED_PATHS } from './p6-orphan-removed-paths';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..');

describe('P6 orphan UI cleanup', () => {
  it('removes implementation and spec files together', () => {
    for (const relativePath of P6_ORPHAN_REMOVED_PATHS) {
      expect(
        existsSync(join(repoRoot, relativePath)),
        `expected removed path to be absent: ${relativePath}`
      ).toBe(false);
    }
  });
});
