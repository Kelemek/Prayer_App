import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';

export async function openBillingUrl(url: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await Browser.open({ url });
    return;
  }
  window.location.assign(url);
}
