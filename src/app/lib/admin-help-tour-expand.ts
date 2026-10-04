export function delayMs(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export async function waitForElementById(
  id: string,
  timeoutMs = 5000,
  intervalMs = 50
): Promise<HTMLElement | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const el = document.getElementById(id);
    if (el) {
      return el;
    }
    await delayMs(intervalMs);
  }
  return null;
}

export async function waitForCondition(
  test: () => boolean,
  timeoutMs = 4000,
  intervalMs = 50
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (test()) {
      return true;
    }
    await delayMs(intervalMs);
  }
  return false;
}

export function isCollapsibleTriggerExpanded(trigger: HTMLElement): boolean {
  return trigger.getAttribute('aria-expanded') === 'true';
}

export async function waitForLayoutSettle(): Promise<void> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

/** True while a settings card still shows an admin loading spinner inside `root`. */
export function isAdminSectionStillLoading(root: HTMLElement): boolean {
  if (root.querySelector('[data-admin-section-loading]')) {
    return true;
  }
  if (root.querySelector('.admin-section-spinner')) {
    return true;
  }
  if (root.querySelector('[role="status"][aria-label^="Loading"]')) {
    return true;
  }
  return false;
}

/**
 * Waits until async admin settings content inside the highlight target has finished loading.
 * No-ops when the element is missing or never shows a loader (e.g. settings tab bar).
 */
const SECTION_READY_STABLE_POLLS = 3;

export async function waitForAdminSectionContentReady(
  sectionElementId: string,
  timeoutMs = 15000,
  intervalMs = 80
): Promise<boolean> {
  const root = await waitForElementById(sectionElementId, timeoutMs, intervalMs);
  if (!root) {
    return false;
  }

  // Let expand handlers start async loads before we decide the section is "idle".
  await delayMs(120);

  const deadline = Date.now() + timeoutMs;
  let stableReadyPolls = 0;
  while (Date.now() < deadline) {
    if (isAdminSectionStillLoading(root)) {
      stableReadyPolls = 0;
    } else {
      stableReadyPolls += 1;
      if (stableReadyPolls >= SECTION_READY_STABLE_POLLS) {
        await waitForLayoutSettle();
        return true;
      }
    }
    await delayMs(intervalMs);
  }

  return !isAdminSectionStillLoading(root);
}
