import { BehaviorSubject } from 'rxjs';
import type { PrayerGroup } from '../types/prayer-group';
import type { PrayerRequest } from './prayer-types';

export class PrayerGroupInternalState {
  readonly groupsSubject = new BehaviorSubject<PrayerGroup[]>([]);
  readonly prayersSubject = new BehaviorSubject<PrayerRequest[]>([]);
  readonly prayerCountsSubject = new BehaviorSubject<
    ReadonlyMap<string, number>
  >(new Map());
  readonly loadingGroupsSubject = new BehaviorSubject<boolean>(false);
  readonly loadingPrayersSubject = new BehaviorSubject<boolean>(false);

  canCreate = false;
  activeGroupId: string | null = null;
  resumeRefreshTimeoutId: ReturnType<typeof setTimeout> | null = null;
}
