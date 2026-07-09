import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { ToastService } from './toast.service';

/**
 * Tracks browser/WebView online status and gates mutations with a calm info toast.
 */
@Injectable({
  providedIn: 'root'
})
export class ConnectivityService implements OnDestroy {
  private readonly onlineSubject = new BehaviorSubject<boolean>(this.readOnline());
  public readonly isOnline$: Observable<boolean> = this.onlineSubject.asObservable();

  private readonly onOnline = (): void => this.onlineSubject.next(true);
  private readonly onOffline = (): void => this.onlineSubject.next(false);

  constructor(private toast: ToastService) {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.onOnline);
      window.addEventListener('offline', this.onOffline);
    }
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.onOnline);
      window.removeEventListener('offline', this.onOffline);
    }
  }

  isOnline(): boolean {
    return this.onlineSubject.value;
  }

  /**
   * If offline, show an info toast and return false.
   * @param actionPhrase e.g. "submit a prayer" → "You need to be online to submit a prayer."
   */
  requireOnline(actionPhrase: string): boolean {
    if (this.isOnline()) {
      return true;
    }
    this.toast.info(`You need to be online to ${actionPhrase}.`);
    return false;
  }

  private readOnline(): boolean {
    if (typeof navigator === 'undefined') {
      return true;
    }
    return navigator.onLine !== false;
  }
}
