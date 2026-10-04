import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AdminHelpDriverTourService } from './admin-help-driver-tour.service';
import type { HelpDriverTourChain } from '../lib/help-driver-tour-chain';

type AdminHelpDriverTourServiceTestAccess = AdminHelpDriverTourService & {
  tourChain: HelpDriverTourChain;
};

describe('AdminHelpDriverTourService intro chain', () => {
  let service: AdminHelpDriverTourServiceTestAccess;

  beforeEach(() => {
    service = new AdminHelpDriverTourService() as AdminHelpDriverTourServiceTestAccess;
  });

  afterEach(() => {
    service.interruptTours();
    vi.restoreAllMocks();
  });

  it('startHighlightTour does not reset queued intro-chain callbacks', () => {
    const resetSpy = vi.spyOn(service.tourChain, 'reset');
    service.queueTourFinishedCallback(vi.fn());

    service.startHighlightTour({ title: 'T', description: 'D' }, []);

    expect(resetSpy).not.toHaveBeenCalled();
    service.destroy();
    expect(resetSpy).toHaveBeenCalled();
  });
});
