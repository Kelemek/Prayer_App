import { Injectable } from '@angular/core';
import { Subject, combineLatest, takeUntil } from 'rxjs';
import type { PrayerRequest } from './prayer.service';
import type { PlanningCenterListService } from './planning-center-list.service';

export interface HomePlanningCenterHost {
  markForCheck(): void;
  onListStateChanged(): void;
}

@Injectable()
export class HomePlanningCenterController {
  planningCenterListId: string | null = null;
  planningCenterListMembers: Array<{
    id: string;
    name: string;
    avatar?: string | null;
  }> = [];
  loadingPlanningCenterList = false;
  filteredPlanningCenterPrayers: PrayerRequest[] = [];

  private host: HomePlanningCenterHost | null = null;
  private planningCenterListService: PlanningCenterListService | null = null;

  get showPlanningCenterMembersFilter(): boolean {
    return !!this.planningCenterListId;
  }

  get planningCenterMembersDisplayCount(): string {
    if (this.loadingPlanningCenterList && this.planningCenterListMembers.length === 0) {
      return '…';
    }
    return String(this.planningCenterListMembers.length);
  }

  bindHost(
    host: HomePlanningCenterHost,
    deps: { planningCenterListService: PlanningCenterListService }
  ): void {
    this.host = host;
    this.planningCenterListService = deps.planningCenterListService;
  }

  subscribe(destroy$: Subject<void>): void {
    const listService = this.requireListService();

    combineLatest([listService.listId$, listService.members$, listService.loading$])
      .pipe(takeUntil(destroy$))
      .subscribe(([listId, members, loading]) => {
        this.planningCenterListId = listId;
        this.planningCenterListMembers = members;
        this.loadingPlanningCenterList = loading;
        this.rebuildVirtualPrayers();
        this.requireHost().onListStateChanged();
      });
  }

  loadForCurrentUser(force = false): void {
    void this.requireListService().loadForCurrentUser(force);
  }

  private rebuildVirtualPrayers(): void {
    this.filteredPlanningCenterPrayers = this.planningCenterListMembers.map((member) => ({
      id: `pc-member-${member.id}`,
      title: `Prayer for ${member.name}`,
      description: '',
      status: 'current' as const,
      requester: 'Planning Center',
      prayer_for: member.name,
      email: '',
      date_requested: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      updates: [],
      approval_status: 'approved' as const,
      is_anonymous: false,
      type: 'prayer' as const,
      prayer_image: member.avatar || null,
      prayed_for_count: 0,
    }));
    this.requireHost().markForCheck();
  }

  private requireHost(): HomePlanningCenterHost {
    if (!this.host) {
      throw new Error('HomePlanningCenterController host is not bound');
    }
    return this.host;
  }

  private requireListService(): PlanningCenterListService {
    if (!this.planningCenterListService) {
      throw new Error('HomePlanningCenterController dependencies are not bound');
    }
    return this.planningCenterListService;
  }
}
