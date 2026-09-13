import { Injectable } from '@angular/core';
import { describeFunctionInvokeFailure } from '../utils/supabase-function-invoke-error';
import type { FeedbackPlatform, FeedbackType } from '../lib/feedback-notion-mapping';
import { SupabaseService } from './supabase.service';

export interface FeedbackSubmitPayload {
  title: string;
  description: string;
  type: FeedbackType;
  userName?: string;
  pageUrl?: string;
  tenantId?: string;
  platform?: FeedbackPlatform;
}

@Injectable({
  providedIn: 'root',
})
export class FeedbackService {
  constructor(private supabaseService: SupabaseService) {}

  async submitFeedback(
    payload: FeedbackSubmitPayload
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error, response } = await this.supabaseService.client.functions.invoke(
        'submit-feedback',
        { body: payload }
      );

      if (error) {
        return {
          success: false,
          error: await describeFunctionInvokeFailure(error, response, 'submit-feedback'),
        };
      }

      if (data && typeof data === 'object' && (data as { success?: unknown }).success === true) {
        return { success: true };
      }

      const message =
        data &&
        typeof data === 'object' &&
        typeof (data as { error?: unknown }).error === 'string'
          ? (data as { error: string }).error
          : 'Failed to submit feedback';
      return { success: false, error: message };
    } catch (err) {
      console.error('[Feedback] Exception submitting feedback:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }
}
