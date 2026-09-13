import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FeedbackService } from './feedback.service';

describe('FeedbackService', () => {
  let service: FeedbackService;
  let invoke: ReturnType<typeof vi.fn>;
  let from: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    invoke = vi.fn();
    from = vi.fn();
    service = new FeedbackService({
      client: {
        functions: { invoke },
        from,
      },
    } as never);
    global.fetch = vi.fn();
  });

  it('invokes submit-feedback and never reads github_token or GitHub Issues', async () => {
    invoke.mockResolvedValue({ data: { success: true }, error: null });

    const result = await service.submitFeedback({
      title: 'Bug title',
      description: 'Something broke on save',
      type: 'bug',
      userName: 'Jane Doe',
      pageUrl: 'https://app.example.com/settings',
      tenantId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      platform: 'web',
    });

    expect(result).toEqual({ success: true });
    expect(result).not.toHaveProperty('url');
    expect(from).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(invoke).toHaveBeenCalledWith('submit-feedback', {
      body: {
        title: 'Bug title',
        description: 'Something broke on save',
        type: 'bug',
        userName: 'Jane Doe',
        pageUrl: 'https://app.example.com/settings',
        tenantId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        platform: 'web',
      },
    });
    const invokeBody = invoke.mock.calls[0][1].body;
    expect(invokeBody).not.toHaveProperty('userEmail');
    expect(JSON.stringify(invokeBody)).not.toMatch(/github_token|ghp_/);
  });

  it('surfaces Edge Function errors without leaking tokens', async () => {
    invoke.mockResolvedValue({
      data: { success: false, error: 'Feedback is not configured on the server.' },
      error: null,
    });

    const result = await service.submitFeedback({
      title: 'Title',
      description: 'Description',
      type: 'suggestion',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Feedback is not configured on the server.');
    expect(JSON.stringify(result)).not.toMatch(/github_token|NOTION_TOKEN|ntn_/i);
  });

  it('maps invoke failures through describeFunctionInvokeFailure', async () => {
    invoke.mockResolvedValue({
      data: null,
      error: { name: 'FunctionsHttpError', message: 'Edge Function returned a non-2xx status code' },
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    });

    const result = await service.submitFeedback({
      title: 'Title',
      description: 'Description',
      type: 'feature',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Unauthorized');
    expect(result.error).not.toMatch(/github_token/i);
  });
});
