import { describe, it, expect } from 'vitest';
import { PrayerCardMetaHeaderComponent } from './prayer-card-meta-header.component';

describe('PrayerCardMetaHeaderComponent overflow items', () => {
  it('includes reminder, answered, edit, and delete for a personal card', () => {
    const component = new PrayerCardMetaHeaderComponent();
    component.prayerCreatedAt = '2026-01-01T00:00:00Z';
    component.isPersonal = true;
    component.showReminder = true;
    component.hasReminder = false;
    component.showDelete = true;
    component.answeredSubject = { kind: 'personal', category: 'Health' };
    component.reminderBellTourId = 'tour-prayer-reminder-bell';
    component.personalAnsweredTourId = 'tour-walkthrough-personal-answered';
    component.personalEditTourId = 'tour-walkthrough-personal-edit';
    component.personalDeleteTourId = 'tour-walkthrough-personal-delete';

    expect(component.overflowItems.map((item) => item.id)).toEqual([
      'reminder',
      'answered',
      'edit',
      'delete',
    ]);
    expect(component.overflowItems[0]?.tourAnchorId).toBe(
      'tour-prayer-reminder-bell'
    );
    expect(component.overflowItems[1]?.tourAnchorId).toBe(
      'tour-walkthrough-personal-answered'
    );
    expect(component.overflowItems[2]?.tourAnchorId).toBe(
      'tour-walkthrough-personal-edit'
    );
    expect(component.overflowItems[3]?.tourAnchorId).toBe(
      'tour-walkthrough-personal-delete'
    );
  });

  it('shows a green Answered action when a personal prayer is answered', () => {
    const component = new PrayerCardMetaHeaderComponent();
    component.prayerCreatedAt = '2026-01-01T00:00:00Z';
    component.isPersonal = true;
    component.answeredSubject = { kind: 'personal', category: 'Answered' };

    const answered = component.overflowItems.find((item) => item.id === 'answered');
    expect(answered?.label).toBe('Answered');
    expect(answered?.tone).toBe('green');
    expect(answered?.icon).toBe('check');
    expect(answered?.filled).toBe(true);
  });

  it('shows a green Answered action when a group prayer is answered', () => {
    const component = new PrayerCardMetaHeaderComponent();
    component.prayerCreatedAt = '2026-01-01T00:00:00Z';
    component.isPersonal = true;
    component.groupName = 'Family';
    component.answeredSubject = { kind: 'group', status: 'answered' };

    const answered = component.overflowItems.find((item) => item.id === 'answered');
    expect(answered?.label).toBe('Answered');
    expect(answered?.tone).toBe('green');
    expect(answered?.icon).toBe('check');
    expect(answered?.filled).toBe(true);
  });

  it('keeps Mark as answered for a current group prayer', () => {
    const component = new PrayerCardMetaHeaderComponent();
    component.prayerCreatedAt = '2026-01-01T00:00:00Z';
    component.isPersonal = true;
    component.groupName = 'Family';
    component.answeredSubject = { kind: 'group', status: 'current' };

    const answered = component.overflowItems.find((item) => item.id === 'answered');
    expect(answered?.label).toBe('Mark as answered');
    expect(answered?.tone).toBe('blue');
    expect(answered?.filled).toBe(false);
  });

  it('exposes stable styles for a group name header label', () => {
    const component = new PrayerCardMetaHeaderComponent();
    component.groupName = 'Family';
    expect(component.groupNameStyles['--category-pill-bg']).toBeTruthy();
    expect(component.groupNameStyles['--category-pill-text']).toBeTruthy();
  });

  it('runs the matching action from overflow item onSelect', () => {
    const component = new PrayerCardMetaHeaderComponent();
    const emitted: string[] = [];
    component.edit.subscribe(() => emitted.push('edit'));
    component.delete.subscribe(() => emitted.push('delete'));
    component.reminder.subscribe(() => emitted.push('reminder'));
    component.toggleAnswered.subscribe(() => emitted.push('answered'));
    component.isPersonal = true;
    component.answeredSubject = { kind: 'personal', category: null };
    component.showReminder = true;
    component.showDelete = true;
    component.prayerCreatedAt = '2026-01-01T00:00:00Z';

    for (const item of component.overflowItems) {
      item.onSelect();
    }
    expect(emitted).toEqual(['reminder', 'answered', 'edit', 'delete']);
  });
});
