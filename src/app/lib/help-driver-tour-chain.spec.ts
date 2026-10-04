import { describe, it, expect, vi } from 'vitest';
import { HelpDriverTourChain } from './help-driver-tour-chain';
import type { Config } from 'driver.js';

describe('HelpDriverTourChain', () => {
  it('runs sectionAdvance callback on programmatic destroy', () => {
    vi.useFakeTimers();
    const onFinished = vi.fn();
    const chain = new HelpDriverTourChain();
    chain.queueTourFinishedCallback(onFinished);

    const config: Config = { steps: [{ popover: { title: 'a' } }] };
    const wrapped = chain.wrapDriverConfig(config);
    chain.markProgrammaticDestroy();
    wrapped.onDestroyed?.(undefined, undefined, {
      config,
      state: { activeIndex: 0 },
      driver: {} as never,
    });
    vi.runAllTimers();
    expect(onFinished).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('calls onSectionAdvanceStopped when user aborts chained section', () => {
    const onStopped = vi.fn();
    const chain = new HelpDriverTourChain({ onSectionAdvanceStopped: onStopped });
    chain.queueTourFinishedCallback(vi.fn());

    const config: Config = { steps: [{ popover: { title: 'a' } }] };
    const wrapped = chain.wrapDriverConfig(config);
    wrapped.onCloseClick?.(document.body, config.steps![0]!, {
      config,
      state: { activeIndex: 0 },
      driver: { destroy: vi.fn() } as never,
    });
    wrapped.onDestroyed?.(undefined, undefined, {
      config,
      state: { activeIndex: 0 },
      driver: {} as never,
    });
    expect(onStopped).toHaveBeenCalledTimes(1);
  });
});
