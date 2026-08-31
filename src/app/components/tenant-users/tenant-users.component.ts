import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminCollapsibleSectionComponent } from '../admin-collapsible-section/admin-collapsible-section.component';
import { AdminSectionLoadingComponent } from '../admin-section-loading/admin-section-loading.component';
import {
  AdminFilterSelectComponent,
  type AdminFilterSelectOption,
} from '../admin-filter-select/admin-filter-select.component';
import { TenantManagementService } from '../../services/tenant-management.service';
import { ToastService } from '../../services/toast.service';
import type { TenantUserDirectoryRow } from '../../types/tenant';
import {
  compareTenantUserDirectoryRows,
  tenantUserDirectoryMatchesQuery,
  type TenantUserDirectorySortColumn,
} from '../../lib/tenant-user-directory';

@Component({
  selector: 'app-tenant-users',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AdminCollapsibleSectionComponent,
    AdminSectionLoadingComponent,
    AdminFilterSelectComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tenant-users.component.html',
})
export class TenantUsersComponent implements OnDestroy {
  sectionExpanded = false;
  private sectionInitialLoadDone = false;
  isLoading = false;
  searching = false;
  hasSearched = false;
  error: string | null = null;

  searchQuery = '';
  readonly listSearchMinChars = 2;
  readonly listSearchDebounceMs = 350;
  private listSearchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  allUsers: TenantUserDirectoryRow[] = [];
  filteredUsers: TenantUserDirectoryRow[] = [];
  users: TenantUserDirectoryRow[] = [];

  currentPage = 1;
  pageSize = 10;
  readonly pageSizeOptions: readonly AdminFilterSelectOption[] = [
    { value: '10', label: '10' },
    { value: '50', label: '50' },
    { value: '100', label: '100' },
  ];
  totalItems = 0;
  maxPaginationButtons = 5;

  sortBy: TenantUserDirectorySortColumn = 'name';
  sortDirection: 'asc' | 'desc' = 'asc';

  readonly Math = Math;

  private readonly tenantManagement = inject(TenantManagementService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);

  ngOnDestroy(): void {
    if (this.listSearchDebounceTimer) {
      clearTimeout(this.listSearchDebounceTimer);
      this.listSearchDebounceTimer = null;
    }
  }

  async onExpandedChange(expanded: boolean): Promise<void> {
    this.sectionExpanded = expanded;
    if (this.sectionExpanded && !this.sectionInitialLoadDone) {
      this.sectionInitialLoadDone = true;
      await this.initialLoad();
    }
    this.cdr.markForCheck();
  }

  private async initialLoad(): Promise<void> {
    this.isLoading = true;
    this.cdr.markForCheck();
    try {
      await this.loadUsers();
    } finally {
      this.isLoading = false;
      this.cdr.markForCheck();
    }
  }

  private async loadUsers(): Promise<void> {
    this.searching = true;
    this.error = null;
    this.cdr.markForCheck();
    try {
      this.allUsers = await this.tenantManagement.listUsersWithTenantsAndGroups();
      this.hasSearched = true;
      this.applyFilters();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load users';
      this.error = message;
      this.toast.error(message);
      this.allUsers = [];
      this.filteredUsers = [];
      this.users = [];
      this.totalItems = 0;
      this.hasSearched = true;
    } finally {
      this.searching = false;
      this.cdr.markForCheck();
    }
  }

  onListSearchQueryChange(value: string): void {
    if (this.listSearchDebounceTimer) {
      clearTimeout(this.listSearchDebounceTimer);
      this.listSearchDebounceTimer = null;
    }

    const trimmed = value.trim();
    if (trimmed.length === 0) {
      this.listSearchDebounceTimer = setTimeout(() => {
        this.listSearchDebounceTimer = null;
        this.applyFilters();
        this.cdr.markForCheck();
      }, this.listSearchDebounceMs);
      return;
    }
    if (trimmed.length < this.listSearchMinChars) {
      this.cdr.markForCheck();
      return;
    }

    this.listSearchDebounceTimer = setTimeout(() => {
      this.listSearchDebounceTimer = null;
      this.applyFilters();
      this.cdr.markForCheck();
    }, this.listSearchDebounceMs);
  }

  onListSearchKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.flushListSearchNow();
    }
  }

  flushListSearchNow(): void {
    if (this.listSearchDebounceTimer) {
      clearTimeout(this.listSearchDebounceTimer);
      this.listSearchDebounceTimer = null;
    }
    this.applyFilters();
    this.cdr.markForCheck();
  }

  clearListSearch(): void {
    this.searchQuery = '';
    this.flushListSearchNow();
  }

  toggleSort(column: TenantUserDirectorySortColumn): void {
    if (this.sortBy === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = column;
      this.sortDirection = 'asc';
    }
    this.applyFilters();
    this.cdr.markForCheck();
  }

  getSortIndicator(column: TenantUserDirectorySortColumn): string {
    if (this.sortBy !== column) {
      return '';
    }
    return this.sortDirection === 'asc' ? ' ↑' : ' ↓';
  }

  applyFilters(): void {
    const trimmed = this.searchQuery.trim();
    const query =
      trimmed.length === 0 || trimmed.length >= this.listSearchMinChars ? trimmed : '';
    this.filteredUsers = this.allUsers.filter((user) =>
      tenantUserDirectoryMatchesQuery(user, query)
    );
    this.filteredUsers.sort((a, b) =>
      compareTenantUserDirectoryRows(a, b, this.sortBy, this.sortDirection)
    );
    this.totalItems = this.filteredUsers.length;
    this.currentPage = 1;
    this.loadPageData();
  }

  loadPageData(): void {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    this.users = this.filteredUsers.slice(startIndex, endIndex);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalItems / this.pageSize) || 1);
  }

  get isFirstPage(): boolean {
    return this.currentPage <= 1;
  }

  get isLastPage(): boolean {
    return this.currentPage >= this.totalPages || this.totalItems === 0;
  }

  onPageSizeChange(value: string): void {
    const next = Number.parseInt(value, 10);
    if (!Number.isFinite(next) || next <= 0) {
      return;
    }
    this.pageSize = next;
    this.currentPage = 1;
    this.loadPageData();
    this.cdr.markForCheck();
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) {
      return;
    }
    this.currentPage = page;
    this.loadPageData();
    this.cdr.markForCheck();
  }

  previousPage(): void {
    if (!this.isFirstPage) {
      this.goToPage(this.currentPage - 1);
    }
  }

  nextPage(): void {
    if (!this.isLastPage) {
      this.goToPage(this.currentPage + 1);
    }
  }

  getPaginationRange(): number[] {
    const pages: number[] = [];
    const maxPagesToShow = this.maxPaginationButtons;
    const totalPages = Math.ceil(this.totalItems / this.pageSize);
    if (totalPages <= 1) {
      return [];
    }

    if (totalPages <= maxPagesToShow) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      const half = Math.floor(maxPagesToShow / 2);
      let start = Math.max(1, this.currentPage - half);
      let end = Math.min(totalPages, start + maxPagesToShow - 1);
      if (end - start + 1 < maxPagesToShow) {
        start = Math.max(1, end - maxPagesToShow + 1);
      }
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
    }
    return pages;
  }
}
