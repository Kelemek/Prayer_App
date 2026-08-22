import { joinCardShellClassParts } from './card-shell-chrome';
import {
  getPrayerCardVariantLayout,
  type PrayerCardVariant,
  type PrayerCardVariantLayout,
} from './prayer-card-layout';
import {
  getPrayerStatusBorderClasses,
  PERSONAL_PRAYER_BORDER_CLASSES,
} from './prayer-status-header';

export function getPrayerCardBorderClass(
  prayerStatus: string,
  isPersonal: boolean
): string {
  if (isPersonal) {
    return PERSONAL_PRAYER_BORDER_CLASSES;
  }
  return getPrayerStatusBorderClasses(prayerStatus);
}

export function getPrayerCardShellClasses(
  variant: PrayerCardVariant,
  borderClass: string
): string {
  const layout = getPrayerCardVariantLayout(variant);
  const border = variant === 'presentation' ? '' : borderClass;
  return joinCardShellClassParts(layout.shellBaseClasses, layout, border);
}

export type { PrayerCardVariantLayout };
