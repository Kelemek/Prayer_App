import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import posthog from 'posthog-js';
import { environment } from '../environments/environment';
import { APP_BUNDLE_VERSION } from './app-analytics-context';
import { setAnalyticsConsent } from './analytics-consent';
import {
  applyAnalyticsConsent,
  applyPostHogAppContext,
  capturePostHogEvent,
  capturePostHogException,
  capturePostHogPageview,
  initializePostHog,
  resetPostHogForTesting,
} from './posthog';

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: vi.fn(() => 'web'),
  },
}));

vi.mock('posthog-js', () => ({
  default: {
    init: vi.fn(),
    capture: vi.fn(),
    captureException: vi.fn(),
    opt_in_capturing: vi.fn(),
    opt_out_capturing: vi.fn(),
    set_config: vi.fn(),
    startSessionRecording: vi.fn(),
    stopSessionRecording: vi.fn(),
    register: vi.fn(),
    setPersonProperties: vi.fn(),
    setPersonPropertiesForFlags: vi.fn(),
    group: vi.fn(),
    identify: vi.fn(),
    reset: vi.fn(),
  },
}));

const expectedAppContext = {
  app_version: APP_BUNDLE_VERSION,
  app_platform: 'web',
  app_environment: 'development',
};

vi.mock('../environments/environment', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../environments/environment')>();
  return {
    environment: {
      ...mod.environment,
      posthogKey: 'phc_test_key',
      posthogHost: 'https://us.i.posthog.com',
      posthogUiHost: 'https://us.posthog.com',
    },
  };
});

describe('posthog', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.clear();
    resetPostHogForTesting();
    vi.mocked(posthog.init).mockClear();
    vi.mocked(posthog.capture).mockClear();
    vi.mocked(posthog.captureException).mockClear();
    vi.mocked(posthog.register).mockClear();
    vi.mocked(posthog.setPersonProperties).mockClear();
    vi.mocked(posthog.setPersonPropertiesForFlags).mockClear();
    vi.mocked(posthog.opt_in_capturing).mockClear();
    vi.mocked(posthog.opt_out_capturing).mockClear();
    vi.mocked(posthog.set_config).mockClear();
    vi.mocked(posthog.startSessionRecording).mockClear();
    vi.mocked(posthog.stopSessionRecording).mockClear();
    vi.mocked(posthog.reset).mockClear();
    vi.mocked(posthog.init).mockReturnValue(posthog);
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    resetPostHogForTesting();
  });

  describe('initializePostHog', () => {
    it('should initialize PostHog with project key and host', () => {
      initializePostHog();

      expect(posthog.init).toHaveBeenCalledWith(
        'phc_test_key',
        expect.objectContaining({
          api_host: 'https://us.i.posthog.com',
          ui_host: 'https://us.posthog.com',
          capture_pageview: false,
          opt_out_capturing_by_default: true,
          disable_session_recording: true,
        })
      );
      expect((window as Window & { posthog?: typeof posthog }).posthog).toBe(posthog);
    });

    it('should tag events with app version and platform before the first pageview', () => {
      initializePostHog();

      expect(posthog.register).toHaveBeenCalledWith(expectedAppContext);
      expect(posthog.setPersonProperties).toHaveBeenCalledWith(expectedAppContext);
      expect(posthog.setPersonPropertiesForFlags).toHaveBeenCalledWith(
        expectedAppContext,
        false
      );
    });

    it('should not opt in without consent in loaded callback', () => {
      initializePostHog();

      const initOptions = vi.mocked(posthog.init).mock.calls[0]?.[1];
      const ph = {
        register: vi.fn(),
        setPersonProperties: vi.fn(),
        setPersonPropertiesForFlags: vi.fn(),
      };
      initOptions?.loaded?.(ph as never);

      expect(posthog.opt_in_capturing).not.toHaveBeenCalled();
      expect(ph.register).toHaveBeenCalledWith(expectedAppContext);
    });

    it('opts in and starts recording when consent is accepted', () => {
      setAnalyticsConsent('accepted');
      initializePostHog();

      expect(posthog.opt_in_capturing).toHaveBeenCalled();
      expect(posthog.set_config).toHaveBeenCalledWith({
        disable_session_recording: false,
      });
      expect(posthog.startSessionRecording).toHaveBeenCalled();
    });

    it('opts out and resets when consent is missing', () => {
      initializePostHog();

      expect(posthog.opt_out_capturing).toHaveBeenCalled();
      expect(posthog.stopSessionRecording).toHaveBeenCalled();
      expect(posthog.reset).toHaveBeenCalled();
      expect(posthog.opt_in_capturing).not.toHaveBeenCalled();
    });

    it('applyAnalyticsConsent rejects with reset', () => {
      initializePostHog();
      vi.mocked(posthog.reset).mockClear();

      applyAnalyticsConsent('rejected');

      expect(posthog.opt_out_capturing).toHaveBeenCalled();
      expect(posthog.reset).toHaveBeenCalled();
    });

    it('applyPostHogAppContext reloads feature flags by default', () => {
      const ph = {
        register: vi.fn(),
        setPersonProperties: vi.fn(),
        setPersonPropertiesForFlags: vi.fn(),
      };

      applyPostHogAppContext(ph);

      expect(ph.setPersonPropertiesForFlags).toHaveBeenCalledWith(
        expectedAppContext,
        true
      );
    });

    it('applyPostHogAppContext includes tenant when provided', () => {
      const ph = {
        register: vi.fn(),
        setPersonProperties: vi.fn(),
        setPersonPropertiesForFlags: vi.fn(),
      };

      applyPostHogAppContext(ph, { id: 't-1', slug: 'acme' });

      expect(ph.register).toHaveBeenCalledWith({
        ...expectedAppContext,
        tenant_id: 't-1',
        tenant_slug: 'acme',
      });
    });

    it('should return early when window is undefined', () => {
      vi.stubGlobal('window', undefined);
      resetPostHogForTesting();

      initializePostHog();

      expect(posthog.init).not.toHaveBeenCalled();
      vi.unstubAllGlobals();
    });

    it('should debug and skip init when project key is not configured', () => {
      const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
      const originalKey = environment.posthogKey;
      environment.posthogKey = '';
      resetPostHogForTesting();

      initializePostHog();

      expect(posthog.init).not.toHaveBeenCalled();
      expect(debugSpy).toHaveBeenCalledWith('PostHog project key not configured');

      environment.posthogKey = originalKey;
      debugSpy.mockRestore();
    });
  });

  describe('capturePostHogException', () => {
    it('should capture exceptions after initialization when consent accepted', () => {
      setAnalyticsConsent('accepted');
      initializePostHog();
      const err = new Error('test');
      capturePostHogException(err, { source: 'test' });

      expect(posthog.captureException).toHaveBeenCalledWith(err, { source: 'test' });
    });

    it('should not capture exceptions without consent', () => {
      initializePostHog();
      capturePostHogException(new Error('test'));

      expect(posthog.captureException).not.toHaveBeenCalled();
    });
  });

  describe('capturePostHogPageview', () => {
    it('should capture pageviews when consent accepted', () => {
      setAnalyticsConsent('accepted');
      initializePostHog();

      capturePostHogPageview('/dashboard');

      expect(posthog.capture).toHaveBeenCalledWith('$pageview', { $current_url: '/dashboard' });
    });

    it('should not capture pageviews without consent', () => {
      initializePostHog();
      capturePostHogPageview('/dashboard');
      expect(posthog.capture).not.toHaveBeenCalled();
    });
  });

  describe('capturePostHogEvent', () => {
    it('should capture custom events when consent accepted', () => {
      setAnalyticsConsent('accepted');
      initializePostHog();

      capturePostHogEvent('memorization_practice_started', { mode: 'type' });

      expect(posthog.capture).toHaveBeenCalledWith('memorization_practice_started', {
        mode: 'type',
      });
    });

    it('should no-op before initialization', () => {
      capturePostHogEvent('memorization_practice_started', { mode: 'type' });

      expect(posthog.capture).not.toHaveBeenCalled();
    });
  });
});
