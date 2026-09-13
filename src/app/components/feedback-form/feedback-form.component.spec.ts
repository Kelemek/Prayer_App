import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FeedbackFormComponent } from './feedback-form.component';
import { ChangeDetectorRef } from '@angular/core';

describe('FeedbackFormComponent', () => {
  let component: FeedbackFormComponent;
  let mockFeedbackService: { submitFeedback: ReturnType<typeof vi.fn> };
  let mockUserSessionService: { waitForSession: ReturnType<typeof vi.fn>; getCurrentSession: ReturnType<typeof vi.fn> };
  let mockTenantContext: { getActiveTenant: ReturnType<typeof vi.fn> };
  let mockCapacitorService: { getPlatform: ReturnType<typeof vi.fn> };
  let mockChangeDetectorRef: { markForCheck: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    mockFeedbackService = {
      submitFeedback: vi.fn().mockResolvedValue({ success: true }),
    };

    mockUserSessionService = {
      getCurrentSession: vi.fn().mockReturnValue({
        email: 'test@example.com',
        fullName: 'John Doe',
      }),
      waitForSession: vi.fn().mockResolvedValue({
        email: 'test@example.com',
        fullName: 'John Doe',
      }),
    };

    mockTenantContext = {
      getActiveTenant: vi.fn().mockReturnValue({
        id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        name: 'Test Church',
        slug: 'test-church',
      }),
    };

    mockCapacitorService = {
      getPlatform: vi.fn().mockReturnValue('web'),
    };

    mockChangeDetectorRef = {
      markForCheck: vi.fn(),
    };

    component = new FeedbackFormComponent(
      mockFeedbackService as never,
      mockUserSessionService as never,
      mockTenantContext as never,
      mockCapacitorService as never,
      mockChangeDetectorRef as ChangeDetectorRef
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with suggestion type and empty fields', () => {
    expect(component.feedbackType).toBe('suggestion');
    expect(component.feedbackTitle).toBe('');
    expect(component.feedbackDescription).toBe('');
    expect(component.isLoading).toBe(false);
  });

  it('validates required fields before submission', async () => {
    await component.onSubmit();
    expect(component.errorMessage).toContain('fill in all fields');
    expect(mockFeedbackService.submitFeedback).not.toHaveBeenCalled();
  });

  it('submits via Edge Function without an authoritative client email', async () => {
    component.feedbackType = 'bug';
    component.feedbackTitle = '  Test Bug  ';
    component.feedbackDescription = '  Bug description  ';

    await component.onSubmit();

    expect(mockFeedbackService.submitFeedback).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Test Bug',
        description: 'Bug description',
        type: 'bug',
        userName: 'John Doe',
        tenantId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        platform: 'web',
      })
    );
    const payload = mockFeedbackService.submitFeedback.mock.calls[0][0];
    expect(payload).not.toHaveProperty('userEmail');
    expect(component.successMessage).toContain('Thank you');
    expect(component.feedbackTitle).toBe('');
    expect(component.feedbackType).toBe('suggestion');
  });

  it('handles missing user session', async () => {
    mockUserSessionService.waitForSession.mockResolvedValue(null);
    component.feedbackTitle = 'Test';
    component.feedbackDescription = 'Description';

    await component.onSubmit();

    expect(component.errorMessage).toContain('User session not available');
    expect(mockFeedbackService.submitFeedback).not.toHaveBeenCalled();
  });

  it('shows service errors', async () => {
    mockFeedbackService.submitFeedback.mockResolvedValue({
      success: false,
      error: 'Feedback is not configured on the server.',
    });
    component.feedbackTitle = 'Test';
    component.feedbackDescription = 'Description';

    await component.onSubmit();

    expect(component.errorMessage).toBe('Feedback is not configured on the server.');
    expect(component.successMessage).toBe('');
  });

  it('clears the success message after 5 seconds', async () => {
    component.feedbackTitle = 'Test';
    component.feedbackDescription = 'Description';

    await component.onSubmit();
    expect(component.successMessage).toBeTruthy();
    vi.advanceTimersByTime(5000);
    expect(component.successMessage).toBe('');
  });

  it('submits each feedback type', async () => {
    for (const type of ['bug', 'feature', 'suggestion'] as const) {
      mockFeedbackService.submitFeedback.mockClear();
      component.feedbackType = type;
      component.feedbackTitle = 'Title';
      component.feedbackDescription = 'Description';
      await component.onSubmit();
      expect(mockFeedbackService.submitFeedback).toHaveBeenCalledWith(
        expect.objectContaining({ type })
      );
    }
  });

  it('keyboard-navigates feedback types', () => {
    const event = {
      key: 'ArrowRight',
      preventDefault: vi.fn(),
    } as unknown as KeyboardEvent;
    component.onFeedbackTypeKeydown(event);
    expect(component.feedbackType).toBe('feature');
    expect(event.preventDefault).toHaveBeenCalled();
  });
});
