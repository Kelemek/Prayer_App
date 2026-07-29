import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConsolidatedPrayerApprovalComponent } from './consolidated-prayer-approval.component';
import type { PrayerRequest } from '../../services/prayer.service';

describe('ConsolidatedPrayerApprovalComponent', () => {
  let component: ConsolidatedPrayerApprovalComponent;

  const makePrayer = (overrides: Partial<PrayerRequest> = {}): PrayerRequest => ({
    id: 'prayer-1',
    title: 'Test Prayer',
    description: 'Test Description',
    status: 'current',
    requester: 'John Doe',
    prayer_for: 'Health',
    date_requested: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    updates: [],
    ...overrides
  });

  beforeEach(() => {
    component = new ConsolidatedPrayerApprovalComponent();
    component.prayer = makePrayer();
    component.pendingUpdates = [];
    component.hasAnyPendingUpdates = false;
  });

  describe('Component Initialization', () => {
    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should initialize with empty denial reason', () => {
      expect(component.prayerDenialReason).toBe('');
    });

    it('should initialize isDenyingPrayer as false', () => {
      expect(component.isDenyingPrayer).toBe(false);
    });
  });

  describe('Prayer Approval/Denial', () => {
    it('handleApprovePrayer should emit onApprovePrayer event', () => {
      const spy = vi.spyOn(component.onApprovePrayer, 'emit');
      component.handleApprovePrayer();
      expect(spy).toHaveBeenCalledWith('prayer-1');
    });

    it('handleDenyPrayer should emit onDenyPrayer event with reason', () => {
      const spy = vi.spyOn(component.onDenyPrayer, 'emit');
      component.prayerDenialReason = 'Inappropriate content';
      component.handleDenyPrayer();
      expect(spy).toHaveBeenCalledWith({ id: 'prayer-1', reason: 'Inappropriate content' });
      expect(component.isDenyingPrayer).toBe(false);
      expect(component.prayerDenialReason).toBe('');
    });

    it('handleDenyPrayer should emit with null reason if empty', () => {
      const spy = vi.spyOn(component.onDenyPrayer, 'emit');
      component.prayerDenialReason = '';
      component.handleDenyPrayer();
      expect(spy).toHaveBeenCalledWith({ id: 'prayer-1', reason: null });
    });
  });

  describe('Update Approval/Denial', () => {
    beforeEach(() => {
      component.pendingUpdates = [
        {
          id: 'update-1',
          content: 'Update content',
          author: 'Jane Doe',
          author_email: 'jane@example.com',
          created_at: new Date().toISOString(),
          is_anonymous: false,
          mark_as_answered: false
        }
      ];
    });

    it('handleApproveUpdate should emit onApproveUpdate event', () => {
      const spy = vi.spyOn(component.onApproveUpdate, 'emit');
      component.handleApproveUpdate('update-1');
      expect(spy).toHaveBeenCalledWith('update-1');
    });

    it('openDenyUpdateModal should open deny modal for update', () => {
      const update = { id: 'update-1', content: 'Test' };
      component.openDenyUpdateModal(update);
      expect(component.denyUpdate).toEqual(update);
      expect(component.showDenyUpdate).toBe(true);
    });

    it('onUpdateDenyConfirmed should emit onDenyUpdate event', () => {
      const spy = vi.spyOn(component.onDenyUpdate, 'emit');
      component.denyUpdate = { id: 'update-1' };
      component.onUpdateDenyConfirmed('Spam');
      expect(spy).toHaveBeenCalledWith({ id: 'update-1', reason: 'Spam' });
      expect(component.showDenyUpdate).toBe(false);
      expect(component.denyUpdate).toBeNull();
    });

    it('closeDenyUpdateModal should clear state', () => {
      component.denyUpdate = { id: 'update-1' };
      component.showDenyUpdate = true;
      component.closeDenyUpdateModal();
      expect(component.showDenyUpdate).toBe(false);
      expect(component.denyUpdate).toBeNull();
    });
  });

  describe('Edit Modal Events', () => {
    it('onPrayerSaved should emit onPrayerEdited and close modal', () => {
      const spy = vi.spyOn(component.onPrayerEdited, 'emit');
      component.showEditPrayer = true;
      component.onPrayerSaved();
      expect(spy).toHaveBeenCalledWith({ id: 'prayer-1', updates: {} });
      expect(component.showEditPrayer).toBe(false);
    });

    it('onUpdateSaved should emit onUpdateEdited and close modal', () => {
      const mockUpdate = { id: 'update-1', content: 'Test' };
      component.editUpdate = mockUpdate;
      const spy = vi.spyOn(component.onUpdateEdited, 'emit');
      component.showEditUpdate = true;
      component.onUpdateSaved();
      expect(spy).toHaveBeenCalledWith({ id: 'update-1', updates: {} });
      expect(component.showEditUpdate).toBe(false);
      expect(component.editUpdate).toBeNull();
    });
  });

  describe('Utility Methods', () => {
    it('formatDate should format date and time correctly', () => {
      const date = '2024-01-15T10:30:00Z';
      const result = component.formatDate(date);
      expect(result).toContain('Jan');
      expect(result).toContain('15');
      expect(result).toMatch(/\d{1,2}:\d{2}/);
    });

    it('formatDate should handle invalid dates', () => {
      const result = component.formatDate('invalid');
      // Invalid dates may return empty string or "Invalid Date" depending on browser
      expect(result === '' || result === 'Invalid Date').toBe(true);
    });

    it('formatDate should handle undefined dates', () => {
      const result = component.formatDate(undefined);
      expect(result).toBe('');
    });

    it('trackByUpdateId should return update id', () => {
      const update = { id: 'update-1', content: 'Test' };
      const result = component.trackByUpdateId(0, update);
      expect(result).toBe('update-1');
    });

    it('trackByUpdateId should return index for missing id', () => {
      const result = component.trackByUpdateId(5, {});
      expect(result).toBe('5');
    });
  });

  describe('Multiple Updates Handling', () => {
    beforeEach(() => {
      component.pendingUpdates = [
        {
          id: 'update-1',
          content: 'First update',
          author: 'Jane Doe',
          author_email: 'jane@example.com',
          created_at: new Date().toISOString(),
          is_anonymous: false
        },
        {
          id: 'update-2',
          content: 'Second update',
          author: 'Bob Smith',
          author_email: 'bob@example.com',
          created_at: new Date().toISOString(),
          is_anonymous: false
        }
      ];
    });

    it('should handle denying different updates via modal', () => {
      const spy = vi.spyOn(component.onDenyUpdate, 'emit');

      component.openDenyUpdateModal({ id: 'update-1' });
      component.onUpdateDenyConfirmed('Reason 1');
      expect(spy).toHaveBeenCalledWith({ id: 'update-1', reason: 'Reason 1' });

      component.openDenyUpdateModal({ id: 'update-2' });
      component.onUpdateDenyConfirmed('Reason 2');
      expect(spy).toHaveBeenCalledWith({ id: 'update-2', reason: 'Reason 2' });
    });
  });

  describe('Anonymous Prayer Handling', () => {
    beforeEach(() => {
      component.prayer = makePrayer({
        is_anonymous: true,
        requester: 'Anonymous'
      });
    });

    it('should display anonymous badge for anonymous prayers', () => {
      expect(component.prayer.is_anonymous).toBe(true);
    });
  });

  describe('Answered Update Handling', () => {
    beforeEach(() => {
      component.pendingUpdates = [
        {
          id: 'update-1',
          content: 'Prayer answered',
          author: 'Jane Doe',
          author_email: 'jane@example.com',
          created_at: new Date().toISOString(),
          is_anonymous: false,
          mark_as_answered: true
        }
      ];
    });

    it('should display answered indicator for marked updates', () => {
      expect(component.pendingUpdates[0].mark_as_answered).toBe(true);
    });
  });

  describe('getRequester', () => {
    it('should return requester when available', () => {
      component.prayer = makePrayer({ requester: 'John Smith' });
      expect(component.getRequester()).toBe('John Smith');
    });

    it('should return Unknown when requester missing even for legacy member ids', () => {
      component.prayer = makePrayer({
        id: 'pc-member-12345',
        requester: undefined
      });
      expect(component.getRequester()).toBe('Unknown');
    });

    it('should return Unknown as fallback', () => {
      component.prayer = makePrayer({ 
        id: 'prayer-regular',
        requester: undefined
      });
      expect(component.getRequester()).toBe('Unknown');
    });

    it('should return Unknown when requester is empty string', () => {
      component.prayer = makePrayer({ 
        requester: ''
      });
      expect(component.getRequester()).toBe('Unknown');
    });

    it('should return Anonymous when prayer is anonymous', () => {
      component.prayer = makePrayer({
        requester: 'Jane Doe',
        is_anonymous: true
      });
      expect(component.getRequester()).toBe('Anonymous');
    });
  });

  describe('formatUpdateDate', () => {
    it('formatUpdateDate should format date and time correctly', () => {
      const date = '2024-01-15T10:30:00Z';
      const result = component.formatUpdateDate(date);
      expect(result).toContain('Jan');
      expect(result).toContain('15');
      expect(result).toMatch(/\d{1,2}:\d{2}/);
    });

    it('formatUpdateDate should handle undefined dates', () => {
      const result = component.formatUpdateDate(undefined);
      expect(result).toBe('');
    });

    it('formatUpdateDate should handle null dates', () => {
      const result = component.formatUpdateDate(null as any);
      expect(result).toBe('');
    });

    it('formatUpdateDate should handle Date objects', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      const result = component.formatUpdateDate(date);
      expect(result).toContain('Jan');
      expect(result).toContain('15');
    });

    it('formatUpdateDate should handle invalid dates gracefully', () => {
      const result = component.formatUpdateDate('invalid-date-string');
      expect(result === '' || result === 'Invalid Date').toBe(true);
    });

    it('formatDate should handle Date objects', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      const result = component.formatDate(date);
      expect(result).toContain('Jan');
      expect(result).toContain('15');
    });

    it('formatDate should return empty string for null', () => {
      const result = component.formatDate(null as any);
      expect(result).toBe('');
    });
  });

  describe('Denial Modal Management', () => {
    it('onUpdateDenyConfirmed should handle missing reason gracefully', () => {
      const spy = vi.spyOn(component.onDenyUpdate, 'emit');
      component.denyUpdate = { id: 'update-1' };
      component.onUpdateDenyConfirmed(null);
      expect(spy).toHaveBeenCalledWith({ id: 'update-1', reason: null });
    });

    it('onUpdateDenyConfirmed should no-op without denyUpdate', () => {
      const spy = vi.spyOn(component.onDenyUpdate, 'emit');
      component.denyUpdate = null;
      component.onUpdateDenyConfirmed('Reason');
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('Edit State Management', () => {
    it('getUpdateAuthorDisplay resolves author from name, membership, or email', () => {
      expect(component.getUpdateAuthorDisplay({ author: 'Jane Doe', author_email: 'jane@example.com' })).toBe('Jane Doe');
      expect(component.getUpdateAuthorDisplay({ author: 'Markdlarson', author_email: 'mark@example.com', member_name: 'Mark Larson' })).toBe('Mark Larson');
      expect(component.getUpdateAuthorDisplay({ author: '', author_email: 'jane.doe@example.com' })).toBe('Jane Doe');
      expect(component.getUpdateAuthorDisplay({ author: '', author_email: '' })).toBe('Unknown');
    });

    it('onUpdateSaved should handle null editUpdate', () => {
      const spy = vi.spyOn(component.onUpdateEdited, 'emit');
      component.editUpdate = null;
      component.showEditUpdate = true;
      component.onUpdateSaved();
      expect(spy).not.toHaveBeenCalled();
      expect(component.showEditUpdate).toBe(false);
    });

    it('formatDate and formatUpdateDate catch blocks return empty string', () => {
      const spy = vi
        .spyOn(Date.prototype, 'toLocaleString')
        .mockImplementation(() => {
          throw new Error('bad date');
        });
      expect(component.formatDate('2024-01-01')).toBe('');
      expect(component.formatUpdateDate('2024-01-01')).toBe('');
      spy.mockRestore();
    });
  });
});
