import { describe, expect, it } from 'vitest';
import {
  buildResendEmailObject,
  classifyResendBatchResult,
  resend429DelayMs,
  RESEND_429_DEFAULT_WAIT_MS,
} from './resend-batch';

describe('resend-batch', () => {
  describe('buildResendEmailObject', () => {
    it('uses a single recipient in to and never bcc/cc', () => {
      const obj = buildResendEmailObject({
        fromHeader: 'Prayer <noreply@example.com>',
        recipient: 'user@test.com',
        subject: 'Hello',
        htmlBody: '<p>Hi</p>',
        textBody: 'Hi',
        replyTo: 'office@church.org',
        listUnsubscribeHeaders: { 'List-Unsubscribe': '<mailto:noreply@example.com?subject=unsubscribe>' },
      });
      expect(obj.to).toEqual(['user@test.com']);
      expect(obj.from).toBe('Prayer <noreply@example.com>');
      expect(obj.reply_to).toBe('office@church.org');
      expect(obj.html).toBe('<p>Hi</p>');
      expect(obj.text).toBe('Hi');
      expect(obj).not.toHaveProperty('bcc');
      expect(obj).not.toHaveProperty('cc');
    });

    it('sends text-only when html is empty', () => {
      const obj = buildResendEmailObject({
        fromHeader: 'Prayer <noreply@example.com>',
        recipient: 'a@b.com',
        subject: 'S',
        htmlBody: '',
        textBody: 'plain',
        listUnsubscribeHeaders: {},
      });
      expect(obj.text).toBe('plain');
      expect(obj.html).toBeUndefined();
    });
  });

  describe('classifyResendBatchResult', () => {
    it('marks all success on HTTP 200 without errors', () => {
      const r = classifyResendBatchResult({
        httpOk: true,
        status: 200,
        chunkLength: 3,
      });
      expect(r.requestLevelFailure).toBe(false);
      expect(r.outcomes).toEqual(['success', 'success', 'success']);
    });

    it('marks failed indices on HTTP 200 with permissive errors', () => {
      const r = classifyResendBatchResult({
        httpOk: true,
        status: 200,
        chunkLength: 3,
        errors: [{ index: 1, message: 'bad to' }],
      });
      expect(r.requestLevelFailure).toBe(false);
      expect(r.outcomes).toEqual(['success', 'failure', 'success']);
    });

    it('marks entire chunk failed on request-level HTTP error', () => {
      const r = classifyResendBatchResult({
        httpOk: false,
        status: 500,
        chunkLength: 2,
        responseBody: 'server error',
      });
      expect(r.requestLevelFailure).toBe(true);
      expect(r.outcomes).toEqual(['failure', 'failure']);
      expect(r.message).toContain('server error');
    });

    it('marks entire chunk failed on 429 after classification input', () => {
      const r = classifyResendBatchResult({
        httpOk: false,
        status: 429,
        chunkLength: 1,
        responseBody: 'rate limited',
      });
      expect(r.requestLevelFailure).toBe(true);
      expect(r.outcomes).toEqual(['failure']);
    });
  });

  describe('resend429DelayMs', () => {
    it('uses Retry-After seconds when present', () => {
      expect(resend429DelayMs('12')).toBe(12000);
    });

    it('falls back to default when header missing or invalid', () => {
      expect(resend429DelayMs(null)).toBe(RESEND_429_DEFAULT_WAIT_MS);
      expect(resend429DelayMs('not-a-number')).toBe(RESEND_429_DEFAULT_WAIT_MS);
    });
  });
});
