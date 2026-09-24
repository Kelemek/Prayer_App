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

  it('unwraps Zone.js ngOriginalError', () => {
    const original = new Error('zone wrapped');
    handleError({ ngOriginalError: original });
    expect(capturePostHogExceptionMock).toHaveBeenCalledWith(original);
  });

  it('captures string errors', () => {
    handleError('string failure');
    expect(capturePostHogExceptionMock).toHaveBeenCalledWith('string failure');
  });

  it('captures error-like objects', () => {
    const like = { name: 'E', message: 'msg', stack: 'stack' };
    handleError(like);
    expect(capturePostHogExceptionMock).toHaveBeenCalledWith(like);
  });

  it('captures unknown errors as Unknown error', () => {
    handleError({ foo: 'bar' });
    expect(capturePostHogExceptionMock).toHaveBeenCalledWith('Unknown error');
  });

  it('formats HttpErrorResponse string bodies', () => {
    const response = new HttpErrorResponse({
      error: 'bad request',
      status: 400,
      statusText: 'Bad Request',
    });
    handleError(response);
    expect(capturePostHogExceptionMock).toHaveBeenCalledWith(
      'Server returned code 400 with body "bad request"'
    );
  });

  it('uses HttpErrorResponse message when error body is not extractable', () => {
    const response = new HttpErrorResponse({
      error: { code: 'x' },
      status: 502,
      statusText: 'Bad Gateway',
    });
    handleError(response);
    expect(capturePostHogExceptionMock).toHaveBeenCalledWith(
      'Http failure response for (unknown url): 502 Bad Gateway'
    );
  });

  it('extracts ErrorEvent message from HttpErrorResponse', () => {
    const errorEvent = new ErrorEvent('error', { message: 'network down' });
    const response = new HttpErrorResponse({ error: errorEvent, status: 0 });
    handleError(response);
    expect(capturePostHogExceptionMock).toHaveBeenCalledWith('network down');
  });
});
