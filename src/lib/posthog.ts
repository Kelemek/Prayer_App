import posthog from 'posthog-js';
import { environment } from '../environments/environment';
import {
  getAppAnalyticsContext,
  type AppAnalyticsContext,
} from './app-analytics-context';

let initialized = false;

type PostHogAppContextClient = {
  register: (properties: AppAnalyticsContext) => void;
  setPersonProperties: (properties: AppAnalyticsContext) => void;
  setPersonPropertiesForFlags: (
    properties: AppAnalyticsContext,
    reloadFeatureFlags?: boolean
  ) => void;
  group: (
    groupType: string,
    groupKey: string,
    groupProperties?: Record<string, string>
  ) => void;
  identify: (distinctId: string, properties?: Record<string, string>) => void;
  reset: () => void;
};

/** Super properties, person properties, and flag/survey targeting for the running build. */
export function applyPostHogAppContext(
  ph: PostHogAppContextClient,
  tenant?: { id: string; slug: string } | null,
  reloadFeatureFlags = true
): void {
  try {
    const context = getAppAnalyticsContext(environment.production, tenant);
    ph.register(context);
    ph.setPersonProperties(context);
    ph.setPersonPropertiesForFlags(context, reloadFeatureFlags);
  } catch (error) {
    console.error('Failed to apply PostHog app context:', error);
  }
}

export function applyPostHogTenantGroup(
  ph: PostHogAppContextClient,
  tenant: { id: string; slug: string; name?: string } | null
): void {
  if (!tenant?.id) {
    return;
  }
  try {
    ph.group('tenant', tenant.id, {
      slug: tenant.slug,
      ...(tenant.name ? { name: tenant.name } : {}),
    });
  } catch (error) {
    console.error('Failed to apply PostHog tenant group:', error);
  }
}

export function identifyPostHogUser(userId: string): void {
  if (!initialized || !isPostHogConfigured()) {
    return;
  }
  try {
    posthog.identify(userId);
  } catch (error) {
    console.error('Failed to identify PostHog user:', error);
  }
}

export function resetPostHogUser(): void {
  if (!initialized || !isPostHogConfigured()) {
    return;
  }
  try {
    posthog.reset();
  } catch (error) {
    console.error('Failed to reset PostHog user:', error);
  }
}

/** Resets init state for unit tests only. */
export function resetPostHogForTesting(): void {
  initialized = false;
}

export function isPostHogConfigured(): boolean {
  const key = environment.posthogKey?.trim();
  return !!key && key !== 'undefined';
}

export function initializePostHog(): void {
  if (typeof window === 'undefined') {
    return;
  }

  if (initialized || !isPostHogConfigured()) {
    if (!environment.production && !isPostHogConfigured()) {
      console.debug('PostHog project key not configured');
    }
    return;
  }

  try {
    posthog.init(environment.posthogKey.trim(), {
      api_host: environment.posthogHost,
      ui_host: environment.posthogUiHost,
      person_profiles: 'identified_only',
      capture_pageview: false,
      autocapture: true,
      loaded: (ph) => {
        ph.opt_in_capturing();
        applyPostHogAppContext(ph);
      },
    });
    initialized = true;
    (window as Window & { posthog?: typeof posthog }).posthog = posthog;
    applyPostHogAppContext(posthog, null, false);
  } catch (error) {
    console.error('Failed to initialize PostHog:', error);
  }
}

export function capturePostHogException(
  error: unknown,
  additionalProperties?: Record<string, unknown>
): void {
  if (!initialized || !isPostHogConfigured()) {
    return;
  }
  try {
    posthog.captureException(error, additionalProperties);
  } catch (captureError) {
    console.error('Failed to capture PostHog exception:', captureError);
  }
}

export function capturePostHogPageview(path: string): void {
  if (!initialized || !isPostHogConfigured()) {
    return;
  }
  try {
    posthog.capture('$pageview', { $current_url: path });
  } catch (error) {
    console.error('Failed to capture PostHog pageview:', error);
  }
}

export function capturePostHogEvent(
  event: string,
  properties?: Record<string, unknown>
): void {
  if (!initialized || !isPostHogConfigured()) {
    return;
  }
  try {
    posthog.capture(event, properties);
  } catch (error) {
    console.error('Failed to capture PostHog event:', error);
  }
}

export { posthog };
