import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { providePostHogErrorHandler } from './posthog-error-handler';

const capturePostHogExceptionMock = vi.fn();

vi.mock('../lib/posthog', () => ({
  capturePostHogException: (...args: unknown[]) => capturePostHogExceptionMock(...args),
}));

describe('PostHogErrorHandler', () => {
  let errorHandler: ErrorHandler;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    capturePostHogExceptionMock.mockClear();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    TestBed.configureTestingModule({
      providers: [providePostHogErrorHandler()],
    });
    errorHandler = TestBed.inject(ErrorHandler);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  function handleError(error: unknown): void {
    errorHandler.handleError(error);
  }

  it('captures a plain Error and logs the original', () => {
    const err = new Error('plain error');
    handleError(err);

    expect(capturePostHogExceptionMock).toHaveBeenCalledWith(err);
    expect(consoleErrorSpy).toHaveBeenCalledWith(err);
  });

  it('captures HttpErrorResponse with Error body', () => {
    const innerError = new Error('http body error');
    const response = new HttpErrorResponse({ error: innerError, status: 500 });

    handleError(response);

    expect(capturePostHogExceptionMock).toHaveBeenCalledWith(innerError);
  });
});
