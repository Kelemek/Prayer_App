import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdminUpdateDenyModalComponent } from './admin-update-deny-modal.component';

describe('AdminUpdateDenyModalComponent', () => {
  let component: AdminUpdateDenyModalComponent;

  const mockUpdate = {
    id: 'update-123',
    content: 'Test Update Content',
    prayer_id: 'prayer-123',
  } as any;

  beforeEach(() => {
    component = new AdminUpdateDenyModalComponent();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should reset denial reason when opened', () => {
    component.denialReason = 'old reason';
    component.isOpen = true;
    component.update = mockUpdate;

    component.ngOnChanges();

    expect(component.denialReason).toBe('');
  });

  it('should emit confirm with trimmed reason and close', () => {
    const confirmSpy = vi.spyOn(component.confirm, 'emit');
    const closeSpy = vi.spyOn(component.close, 'emit');
    component.denialReason = '  Not appropriate  ';

    component.handleSubmit();

    expect(confirmSpy).toHaveBeenCalledWith('Not appropriate');
    expect(closeSpy).toHaveBeenCalled();
  });

  it('should emit null reason when empty', () => {
    const confirmSpy = vi.spyOn(component.confirm, 'emit');
    component.denialReason = '   ';

    component.handleSubmit();

    expect(confirmSpy).toHaveBeenCalledWith(null);
  });

  it('should clear reason and close on cancel', () => {
    const closeSpy = vi.spyOn(component.close, 'emit');
    component.denialReason = 'Some reason';

    component.cancel();

    expect(component.denialReason).toBe('');
    expect(closeSpy).toHaveBeenCalled();
  });
});
