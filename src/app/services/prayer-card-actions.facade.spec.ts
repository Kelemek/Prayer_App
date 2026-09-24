import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PrayerCardActionsFacade } from './prayer-card-actions.facade';

describe('PrayerCardActionsFacade', () => {
  const prayerService = {
    deletePersonalPrayer: vi.fn().mockResolvedValue(true),
    deletePrayer: vi.fn().mockResolvedValue(true),
    addUpdate: vi.fn().mockResolvedValue(true),
    addPersonalPrayerUpdate: vi.fn().mockResolvedValue(true),
    updatePersonalPrayer: vi.fn().mockResolvedValue(true),
    deletePersonalPrayerUpdate: vi.fn().mockResolvedValue(true),
    deleteUpdate: vi.fn().mockResolvedValue(undefined),
    requestDeletion: vi.fn().mockResolvedValue(undefined),
    requestUpdateDeletion: vi.fn().mockResolvedValue(undefined),
    addMemberPrayerUpdate: vi.fn().mockResolvedValue(true),
    deleteMemberPrayerUpdate: vi.fn().mockResolvedValue(true),
    updateMemberPrayerUpdate: vi.fn().mockResolvedValue(true),
  };
  const promptService = { deletePrompt: vi.fn().mockResolvedValue(true) };
  const toastService = { error: vi.fn() };
  const userSessionService = {
    getCurrentSession: vi.fn(() => ({ email: 'u@example.com', fullName: 'User' })),
  };
  const adminAuthService = { getIsAdmin: vi.fn(() => true) };
  const planningCenterListService = {
    getCurrentMembers: vi.fn(() => [{ id: 'person-1', name: 'Member One' }]),
    getCurrentListId: vi.fn(() => 'list-1'),
  };

  let facade: PrayerCardActionsFacade;

  beforeEach(() => {
    vi.clearAllMocks();
    facade = new PrayerCardActionsFacade(
      prayerService as never,
      promptService as never,
      toastService as never,
      userSessionService as never,
      adminAuthService as never,
      planningCenterListService as never
    );
  });

  it('exposes admin flag', () => {
    expect(facade.isAdmin).toBe(true);
  });

  it('deletes personal prayers', async () => {
    await facade.deleteCardForCard({ id: 'p1', user_email: 'u@example.com' });
    expect(prayerService.deletePersonalPrayer).toHaveBeenCalledWith('p1');
  });

  it('deletes community prayers', async () => {
    await facade.deleteCardForCard({ id: 'p2' });
    expect(prayerService.deletePrayer).toHaveBeenCalledWith('p2');
  });

  it('adds community updates', async () => {
    await facade.addUpdateForCard(
      { id: 'p2' },
      { prayer_id: 'p2', content: 'thanks', mark_as_answered: false }
    );
    expect(prayerService.addUpdate).toHaveBeenCalled();
  });

  it('adds member updates when member exists', async () => {
    await facade.addUpdateForCard(
      { id: 'pc-member-person-1' },
      { prayer_id: 'pc-member-person-1', content: 'pray', mark_as_answered: true }
    );
    expect(prayerService.addMemberPrayerUpdate).toHaveBeenCalled();
  });

  it('marks personal answered when update requests it', async () => {
    await facade.addUpdateForCard(
      { id: 'pp1', user_email: 'u@example.com' },
      {
        prayer_id: 'pp1',
        content: 'done',
        mark_as_answered: true,
        is_personal_card: true,
      }
    );
    expect(prayerService.updatePersonalPrayer).toHaveBeenCalledWith(
      'pp1',
      { category: 'Answered' },
      { successToast: false }
    );
  });

  it('deletes member updates', async () => {
    await facade.deleteUpdateForCard(
      { id: 'pc-member-person-1' },
      { prayerId: 'pc-member-person-1', updateId: 'u1' }
    );
    expect(prayerService.deleteMemberPrayerUpdate).toHaveBeenCalledWith(
      'u1',
      'person-1',
      'list-1'
    );
  });

  it('toggles member answered status', async () => {
    await facade.toggleMemberUpdateAnswered({
      prayerId: 'pc-member-person-1',
      updateId: 'u1',
      isAnswered: true,
    });
    expect(prayerService.updateMemberPrayerUpdate).toHaveBeenCalled();
  });

  it('deleteCard delegates to deleteCardForCard', async () => {
    facade.deleteCard({ id: 'p1', user_email: 'u@example.com' });
    await vi.waitFor(() => prayerService.deletePersonalPrayer.mock.calls.length > 0);
    expect(prayerService.deletePersonalPrayer).toHaveBeenCalledWith('p1');
  });

  it('returns false when deleting member cards', async () => {
    const ok = await facade.deleteCardForCard({ id: 'pc-member-person-1' });
    expect(ok).toBe(false);
  });

  it('deletes community prayer updates', async () => {
    await facade.deleteUpdateForCard(
      { id: 'community-1' },
      { prayerId: 'community-1', updateId: 'u2' }
    );
    expect(prayerService.deleteUpdate).toHaveBeenCalledWith('u2');
  });

  it('deletes personal prayer updates', async () => {
    await facade.deleteUpdateForCard(
      { id: 'pp1', user_email: 'u@example.com' },
      { prayerId: 'pp1', updateId: 'u3' }
    );
    expect(prayerService.deletePersonalPrayerUpdate).toHaveBeenCalledWith('u3');
  });

  it('adds personal updates without marking answered', async () => {
    await facade.addUpdateForCard(
      { id: 'pp1', user_email: 'u@example.com' },
      {
        prayer_id: 'pp1',
        content: 'update',
        mark_as_answered: false,
        is_personal_card: true,
      }
    );
    expect(prayerService.addPersonalPrayerUpdate).toHaveBeenCalled();
    expect(prayerService.updatePersonalPrayer).not.toHaveBeenCalled();
  });

  it('surfaces toast when member is missing', async () => {
    planningCenterListService.getCurrentMembers.mockReturnValue([]);
    const ok = await facade.addUpdateForCard(
      { id: 'pc-member-missing' },
      { prayer_id: 'pc-member-missing', content: 'x', mark_as_answered: false }
    );
    expect(ok).toBe(false);
    expect(toastService.error).toHaveBeenCalledWith('Member not found');
  });

  it('requestDeletion and requestUpdateDeletion delegate to prayer service', async () => {
    await facade.requestDeletion({ prayerId: 'p1', reason: 'x' } as never);
    await facade.requestUpdateDeletion({
      prayerId: 'p1',
      updateId: 'u1',
      reason: 'x',
    } as never);
    expect(prayerService.requestDeletion).toHaveBeenCalled();
    expect(prayerService.requestUpdateDeletion).toHaveBeenCalled();
  });

  it('toasts on delete errors', async () => {
    prayerService.deletePrayer.mockRejectedValueOnce(new Error('fail'));
    const ok = await facade.deleteCardForCard({ id: 'p-fail' });
    expect(ok).toBe(false);
    expect(toastService.error).toHaveBeenCalledWith('Failed to delete prayer');
  });

  it('toasts when requestDeletion fails', async () => {
    prayerService.requestDeletion.mockRejectedValueOnce(new Error('nope'));
    await facade.requestDeletion({ prayerId: 'p1' } as never);
    expect(toastService.error).toHaveBeenCalledWith('Failed to submit deletion request');
  });

  it('deletePrompt delegates to prompt service', async () => {
    await facade.deletePrompt('prompt-1');
    expect(promptService.deletePrompt).toHaveBeenCalledWith('prompt-1');
  });

  it('toasts when addUpdate fails', async () => {
    prayerService.addUpdate.mockRejectedValueOnce(new Error('fail'));
    const ok = await facade.addUpdateForCard(
      { id: 'p2' },
      { prayer_id: 'p2', content: 'x', mark_as_answered: false }
    );
    expect(ok).toBe(false);
    expect(toastService.error).toHaveBeenCalledWith('Failed to submit update');
  });

  it('toasts when deleteUpdate fails', async () => {
    prayerService.deleteUpdate.mockRejectedValueOnce(new Error('fail'));
    const ok = await facade.deleteUpdateForCard(
      { id: 'community-1' },
      { prayerId: 'community-1', updateId: 'u1' }
    );
    expect(ok).toBe(false);
    expect(toastService.error).toHaveBeenCalledWith('Failed to delete update');
  });

  it('returns false when personal update delete fails', async () => {
    prayerService.deletePersonalPrayerUpdate.mockResolvedValueOnce(false);
    const ok = await facade.deleteUpdateForCard(
      { id: 'pp1', user_email: 'u@example.com' },
      { prayerId: 'pp1', updateId: 'u1' }
    );
    expect(ok).toBe(false);
  });

  it('toasts when toggleMemberUpdateAnswered fails', async () => {
    prayerService.updateMemberPrayerUpdate.mockRejectedValueOnce(new Error('fail'));
    const ok = await facade.toggleMemberUpdateAnswered({
      prayerId: 'pc-member-person-1',
      updateId: 'u1',
      isAnswered: false,
    });
    expect(ok).toBe(false);
    expect(toastService.error).toHaveBeenCalledWith('Failed to update answered status');
  });

  it('toasts when requestUpdateDeletion fails', async () => {
    prayerService.requestUpdateDeletion.mockRejectedValueOnce(new Error('fail'));
    await facade.requestUpdateDeletion({
      prayerId: 'p1',
      updateId: 'u1',
      reason: 'x',
    } as never);
    expect(toastService.error).toHaveBeenCalledWith('Failed to submit update deletion request');
  });
});
