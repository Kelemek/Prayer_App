import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  isColdBootPerfEnabled,
  markColdBoot,
  measureColdBoot,
} from './cold-boot-performance';

describe('cold-boot-performance', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.removeItem('cold_boot_perf');
  });

  it('is disabled by default', () => {
    expect(isColdBootPerfEnabled()).toBe(false);
    const mark = vi.spyOn(performance, 'mark');
    markColdBoot('test');
    expect(mark).not.toHaveBeenCalled();
  });

  it('marks when enabled via localStorage', () => {
    localStorage.setItem('cold_boot_perf', '1');
    const mark = vi.spyOn(performance, 'mark');
    markColdBoot('phase-a');
    expect(mark).toHaveBeenCalledWith('cold-boot:phase-a');
  });

  it('measures between marks when enabled', () => {
    localStorage.setItem('cold_boot_perf', '1');
    markColdBoot('start');
    markColdBoot('end');
    const measure = vi.spyOn(performance, 'measure');
    measureColdBoot('span', 'start', 'end');
    expect(measure).toHaveBeenCalledWith(
      'cold-boot:span',
      'cold-boot:start',
      'cold-boot:end'
    );
  });
});
