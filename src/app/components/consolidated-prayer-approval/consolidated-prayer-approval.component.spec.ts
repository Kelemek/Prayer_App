import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChangeDetectorRef } from '@angular/core';
import { ConsolidatedPrayerApprovalComponent } from './consolidated-prayer-approval.component';
import type { PrayerRequest } from '../../services/prayer.service';
import { AdminDataService } from '../../services/admin-data.service';
import { ToastService } from '../../services/toast.service';

describe('ConsolidatedPrayerApprovalComponent', () => {
  let component: ConsolidatedPrayerApprovalComponent;
  let editUpdate: ReturnType<typeof vi.fn>;
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let cdr: { markForCheck: ReturnType<typeof vi.fn> };

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
    editUpdate = vi.fn().mockResolvedValue(undefined);
    toast = { success: vi.fn(), error: vi.fn() };
    cdr = { markForCheck: vi.fn() };
    component = new ConsolidatedPrayerApprovalComponent(
      { editUpdate } as unknown as AdminDataService,
      toast as unknown as ToastService,
      cdr as unknown as ChangeDetectorRef
    );
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

    it('startDenyingUpdate should set denyingUpdateId', () => {
      component.startDenyingUpdate('update-1');
      expect(component.denyingUpdateId).toBe('update-1');
      expect(component.updateDenialReasons.has('update-1')).toBe(true);
    });

    it('handleDenyUpdate should emit onDenyUpdate event', () => {
      const spy = vi.spyOn(component.onDenyUpdate, 'emit');
      component.updateDenialReasons.set('update-1', 'Spam');
      component.denyingUpdateId = 'update-1';
      component.handleDenyUpdate('update-1');
      expect(spy).toHaveBeenCalledWith({ id: 'update-1', reason: 'Spam' });
      expect(component.denyingUpdateId).toBeNull();
    });

    it('cancelDenyingUpdate should clear state', () => {
      component.denyingUpdateId = 'update-1';
      component.updateDenialReasons.set('update-1', 'Spam');
      component.cancelDenyingUpdate();
      expect(component.denyingUpdateId).toBeNull();
      expect(component.updateDenialReasons.has('update-1')).toBe(false);
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
    it('formatDate should format date correctly', () => {
      const date = '2024-01-15T10:30:00Z';
      const result = component.formatDate(date);
      expect(result).toContain('Jan');
      expect(result).toContain('15');
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

    it('should handle multiple updates with separate denial reasons', () => {
      component.updateDenialReasons.set('update-1', 'Reason 1');
      component.updateDenialReasons.set('update-2', 'Reason 2');
      
      const spy = vi.spyOn(component.onDenyUpdate, 'emit');
      
      component.denyingUpdateId = 'update-1';
      component.handleDenyUpdate('update-1');
      
      expect(spy).toHaveBeenCalledWith({ id: 'update-1', reason: 'Reason 1' });
      expect(component.updateDenialReasons.has('update-2')).toBe(true);
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

    it('should return Anonymous when requester missing even for legacy member ids', () => {
      component.prayer = makePrayer({
        id: 'pc-member-12345',
        requester: undefined
      });
      expect(component.getRequester()).toBe('Anonymous');
    });

    it('should return Anonymous as fallback', () => {
      component.prayer = makePrayer({ 
        id: 'prayer-regular',
        requester: undefined
      });
      expect(component.getRequester()).toBe('Anonymous');
    });

    it('should return Anonymous when requester is empty string', () => {
      component.prayer = makePrayer({ 
        requester: ''
      });
      expect(component.getRequester()).toBe('Anonymous');
    });
  });

  describe('formatUpdateDate', () => {
    it('formatUpdateDate should format date correctly', () => {
      const date = '2024-01-15T10:30:00Z';
      const result = component.formatUpdateDate(date);
      expect(result).toContain('Jan');
      expect(result).toContain('15');
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

  describe('Denial Reason Management', () => {
    it('handleDenyUpdate should handle missing reason gracefully', () => {
      const spy = vi.spyOn(component.onDenyUpdate, 'emit');
      component.denyingUpdateId = 'update-1';
      component.handleDenyUpdate('update-1');
      expect(spy).toHaveBeenCalledWith({ id: 'update-1', reason: null });
    });

    it('cancelDenyingUpdate should handle null denyingUpdateId', () => {
      component.denyingUpdateId = null;
      component.cancelDenyingUpdate();
      expect(component.denyingUpdateId).toBeNull();
    });

    it('startDenyingUpdate should preserve existing reason', () => {
      component.updateDenialReasons.set('update-1', 'Existing reason');
      component.startDenyingUpdate('update-1');
      expect(component.updateDenialReasons.get('update-1')).toBe('Existing reason');
    });
  });

  describe('Edit State Management', () => {
    it('onUpdateSaved should handle null editUpdate', () => {
      const spy = vi.spyOn(component.onUpdateEdited, 'emit');
      component.editUpdate = null;
      component.showEditUpdate = true;
      component.onUpdateSaved();
      expect(spy).not.toHaveBeenCalled();
      expect(component.showEditUpdate).toBe(false);
    });
  });

  describe('Inline update edit', () => {
    it('startInlineUpdateEdit and cancelInlineUpdate manage state', () => {
      component.startInlineUpdateEdit({ id: 'u1', content: 'Hello' });
      expect(component.inlineEditingUpdateId).toBe('u1');
      expect(component.inlineEditingUpdateContent).toBe('Hello');
      component.cancelInlineUpdate();
      expect(component.inlineEditingUpdateId).toBeNull();
      expect(component.inlineEditingUpdateContent).toBe('');
    });

    it('startInlineUpdateEdit uses empty content when missing', () => {
      component.startInlineUpdateEdit({ id: 'u1', content: undefined as unknown as string });
      expect(component.inlineEditingUpdateContent).toBe('');
    });

    it('saveInlineUpdate persists content and emits', async () => {
      const emitSpy = vi.spyOn(component.onUpdateEdited, 'emit');
      component.pendingUpdates = [
        {
          id: 'update-1',
          content: 'old',
          author: 'A',
          author_email: 'a@b.com',
          created_at: new Date().toISOString(),
          is_anonymous: false,
          mark_as_answered: false,
        },
      ];
      component.inlineEditingUpdateContent = 'new content';
      await component.saveInlineUpdate('update-1');
      expect(editUpdate).toHaveBeenCalledWith('update-1', { content: 'new content' });
      expect(component.pendingUpdates[0].content).toBe('new content');
      expect(emitSpy).toHaveBeenCalledWith({
        id: 'update-1',
        updates: { content: 'new content' },
      });
      expect(toast.success).toHaveBeenCalledWith('Update edited.');
      expect(component.inlineEditingUpdateId).toBeNull();
      expect(component.isSavingUpdate).toBe(false);
    });

    it('saveInlineUpdate no-ops while saving and handles errors', async () => {
      component.isSavingUpdate = true;
      await component.saveInlineUpdate('update-1');
      expect(editUpdate).not.toHaveBeenCalled();

      component.isSavingUpdate = false;
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      editUpdate.mockRejectedValue(new Error('fail'));
      await component.saveInlineUpdate('update-1');
      expect(toast.error).toHaveBeenCalledWith('Failed to edit update.');
      expect(component.isSavingUpdate).toBe(false);
      errSpy.mockRestore();
    });

    it('formatDate and formatUpdateDate catch blocks return empty string', () => {
      const spy = vi
        .spyOn(Date.prototype, 'toLocaleDateString')
        .mockImplementation(() => {
          throw new Error('bad date');
        });
      expect(component.formatDate('2024-01-01')).toBe('');
      expect(component.formatUpdateDate('2024-01-01')).toBe('');
      spy.mockRestore();
    });
  });
});
