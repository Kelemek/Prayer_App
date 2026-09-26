/** Shared layout for settings section child components (multi-card sections + parent gap). */
export const USER_SETTINGS_SECTION_HOST_STYLES = [
  ':host { display: flex; flex-direction: column; gap: 0.5rem; }',
  ':host:not(:has(.settings-modal-section-card)) { display: none; }',
] as const;
