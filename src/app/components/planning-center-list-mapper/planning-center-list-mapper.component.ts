import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../services/supabase.service';
import { PlanningCenterListService } from '../../services/planning-center-list.service';
import { ToastService } from '../../services/toast.service';
import {
  fetchPlanningCenterCredentialsStatus,
  fetchPlanningCenterLists,
  type PlanningCenterList,
} from '../../lib/planning-center';
import { AdminCollapsibleSectionComponent } from '../admin-collapsible-section/admin-collapsible-section.component';

interface TenantMemberRow {
  id: string;
  name: string;
  email: string;
  planning_center_list_id?: string | null;
}

@Component({
  selector: 'app-planning-center-list-mapper',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, AdminCollapsibleSectionComponent],
  template: `
    <app-admin-collapsible-section
      title="Planning Center list mapping"
      triggerId="planning-center-list-mapper-trigger"
      panelId="planning-center-list-mapper-panel"
      [expanded]="sectionExpanded"
      (expandedChange)="onExpandedChange($event)"
    >
      <svg
        sectionIcon
        class="text-blue-600 dark:text-blue-400 shrink-0"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        aria-hidden="true"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.658 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>

      @if (!activeTenantId) {
        <p class="text-sm text-gray-600 dark:text-gray-400">Select a church to map lists.</p>
      } @else {
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Map a member to a Planning Center list to show the Home &quot;Members&quot; filter for that user.
        </p>

        @if (listsBlockedMessage) {
          <p class="text-sm text-amber-800 dark:text-amber-200 mb-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-3 py-2">
            {{ listsBlockedMessage }}
          </p>
        }

        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Member</label>
            <input
              type="text"
              [(ngModel)]="memberSearch"
              (input)="filterMembers()"
              placeholder="Search by name or email…"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
            />
            @if (memberSearch.trim() && filteredMembers.length > 0) {
              <div class="mt-2 border rounded-lg max-h-48 overflow-y-auto dark:border-gray-600">
                @for (member of filteredMembers; track member.id) {
                  <button
                    type="button"
                    class="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                    (click)="selectMember(member)"
                  >
                    <div class="font-medium">{{ member.name || member.email }}</div>
                    <div class="text-sm text-gray-500">{{ member.email }}</div>
                  </button>
                }
              </div>
            }
          </div>

          @if (selectedMember) {
            <div class="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm">
              {{ selectedMember.name || selectedMember.email }} — {{ selectedMember.email }}
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">PCO list</label>
              <input
                type="text"
                [(ngModel)]="listSearch"
                (input)="filterLists()"
                [disabled]="loadingLists"
                placeholder="Search lists…"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 disabled:opacity-50"
              />
              @if (listSearch.trim() && filteredLists.length > 0) {
                <div class="mt-2 border rounded-lg max-h-48 overflow-y-auto dark:border-gray-600">
                  @for (list of filteredLists; track list.id) {
                    <button
                      type="button"
                      class="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                      (click)="selectList(list)"
                    >
                      <div class="font-medium">{{ list.name }}</div>
                      @if (list.description) {
                        <div class="text-sm text-gray-500">{{ list.description }}</div>
                      }
                    </button>
                  }
                </div>
              }
            </div>
          }

          @if (selectedMember && selectedList) {
            <button
              type="button"
              class="px-4 py-2 bg-green-600 text-white rounded-lg text-sm cursor-pointer disabled:opacity-50"
              [disabled]="saving"
              (click)="mapList()"
            >
              {{ saving ? 'Saving…' : 'Map list to member' }}
            </button>
          }

          <div class="pt-4 border-t dark:border-gray-700">
            <h3 class="font-semibold text-gray-800 dark:text-gray-100 mb-2">Current mappings</h3>
            @if (mappings.length === 0) {
              <p class="text-sm text-gray-500">No mappings yet.</p>
            } @else {
              @for (mapping of mappings; track mapping.id) {
                <div class="flex justify-between gap-2 py-2 border-b dark:border-gray-700 text-sm">
                  <div>
                    <div class="font-medium">{{ mapping.name || mapping.email }}</div>
                    <div class="text-blue-600 dark:text-blue-400">{{ mapping.listName }}</div>
                  </div>
                  <button
                    type="button"
                    class="text-red-600 text-sm cursor-pointer"
                    [disabled]="saving"
                    (click)="removeMapping(mapping.id, mapping.email)"
                  >
                    Remove
                  </button>
                </div>
              }
            }
          </div>
        </div>
      }
    </app-admin-collapsible-section>
  `,
})
export class PlanningCenterListMapperComponent implements OnChanges {
  @Input() activeTenantId: string | null = null;

  sectionExpanded = false;
  members: TenantMemberRow[] = [];
  filteredMembers: TenantMemberRow[] = [];
  memberSearch = '';
  selectedMember: TenantMemberRow | null = null;

  allLists: PlanningCenterList[] = [];
  filteredLists: PlanningCenterList[] = [];
  listSearch = '';
  selectedList: PlanningCenterList | null = null;
  loadingLists = false;
  saving = false;
  listsBlockedMessage: string | null = null;

  mappings: Array<{
    id: string;
    name: string;
    email: string;
    listName: string;
  }> = [];

  constructor(
    private readonly supabase: SupabaseService,
    private readonly toast: ToastService,
    private readonly planningCenterListService: PlanningCenterListService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['activeTenantId'] && this.sectionExpanded) {
      void this.loadMembersAndLists();
    }
  }

  onExpandedChange(expanded: boolean): void {
    this.sectionExpanded = expanded;
    if (expanded) {
      void this.loadMembersAndLists();
    }
    this.cdr.markForCheck();
  }

  async loadMembersAndLists(): Promise<void> {
    await this.loadLists();
    await this.loadMembers();
  }

  async loadMembers(): Promise<void> {
    const tenantId = this.activeTenantId;
    if (!tenantId) {
      return;
    }
    const { data, error } = await this.supabase.client
      .from('tenant_memberships')
      .select('id, name, user_email, planning_center_list_id')
      .eq('tenant_id', tenantId)
      .order('name');

    if (error) {
      this.toast.error('Failed to load members');
      return;
    }

    this.members = (data ?? []).map((row) => ({
      id: row.id as string,
      name: (row.name as string) ?? '',
      email: (row.user_email as string) ?? '',
      planning_center_list_id: row.planning_center_list_id as string | null,
    }));
    this.loadMappings();
    this.cdr.markForCheck();
  }

  async loadLists(): Promise<void> {
    const tenantId = this.activeTenantId;
    if (!tenantId) {
      return;
    }
    this.loadingLists = true;
    this.listsBlockedMessage = null;
    this.cdr.markForCheck();

    const statusResult = await fetchPlanningCenterCredentialsStatus(this.supabase.client, tenantId);
    if (statusResult.error) {
      this.loadingLists = false;
      this.toast.error(statusResult.error);
      this.cdr.markForCheck();
      return;
    }
    const status = statusResult.status;
    if (!status?.enabled) {
      this.loadingLists = false;
      this.allLists = [];
      this.listsBlockedMessage =
        'Turn on “Enable Planning Center for this church” above before mapping lists.';
      this.cdr.markForCheck();
      return;
    }

    const result = await fetchPlanningCenterLists(this.supabase.client, tenantId);
    this.loadingLists = false;
    if (result.error) {
      this.toast.error(result.error);
    } else {
      this.allLists = result.lists;
      this.loadMappings();
    }
    this.cdr.markForCheck();
  }

  loadMappings(): void {
    this.mappings = this.members
      .filter((m) => m.planning_center_list_id)
      .map((m) => {
        const list = this.allLists.find((l) => l.id === m.planning_center_list_id);
        return {
          id: m.id,
          name: m.name,
          email: m.email,
          listName: list?.name ?? 'Unknown list',
        };
      });
  }

  filterMembers(): void {
    const q = this.memberSearch.trim().toLowerCase();
    this.filteredMembers = q
      ? this.members.filter(
          (m) =>
            m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
        )
      : [];
  }

  filterLists(): void {
    const q = this.listSearch.trim().toLowerCase();
    this.filteredLists = q
      ? this.allLists.filter(
          (l) =>
            l.name.toLowerCase().includes(q) ||
            (l.description || '').toLowerCase().includes(q)
        )
      : [];
  }

  selectMember(member: TenantMemberRow): void {
    this.selectedMember = member;
    this.memberSearch = member.name || member.email;
    this.filteredMembers = [];
    this.cdr.markForCheck();
  }

  selectList(list: PlanningCenterList): void {
    this.selectedList = list;
    this.listSearch = list.name;
    this.filteredLists = [];
    this.cdr.markForCheck();
  }

  async mapList(): Promise<void> {
    if (!this.selectedMember || !this.selectedList) {
      return;
    }
    this.saving = true;
    this.cdr.markForCheck();
    const { error } = await this.supabase.client
      .from('tenant_memberships')
      .update({ planning_center_list_id: this.selectedList.id })
      .eq('id', this.selectedMember.id);

    this.saving = false;
    if (error) {
      this.toast.error('Failed to save mapping');
    } else {
      this.planningCenterListService.invalidateForUser(this.selectedMember.email);
      this.toast.success('List mapped');
      this.selectedMember = null;
      this.selectedList = null;
      this.memberSearch = '';
      this.listSearch = '';
      await this.loadMembers();
    }
    this.cdr.markForCheck();
  }

  async removeMapping(membershipId: string, email: string): Promise<void> {
    this.saving = true;
    this.cdr.markForCheck();
    const { error } = await this.supabase.client
      .from('tenant_memberships')
      .update({ planning_center_list_id: null })
      .eq('id', membershipId);

    this.saving = false;
    if (error) {
      this.toast.error('Failed to remove mapping');
    } else {
      this.planningCenterListService.invalidateForUser(email);
      this.toast.success('Mapping removed');
      await this.loadMembers();
    }
    this.cdr.markForCheck();
  }
}
