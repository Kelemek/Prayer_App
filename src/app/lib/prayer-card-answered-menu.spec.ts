import { describe, expect, it } from 'vitest';
import {
  answeredMenuState,
  answeredPromptFor,
  answeredSubjectForPrayer,
} from './prayer-card-answered-menu';

describe('prayer-card-answered-menu', () => {
  it('builds a personal subject only for personal cards without a group', () => {
    expect(
      answeredSubjectForPrayer({
        groupId: null,
        status: 'current',
        category: 'Health',
        isPersonal: true,
      })
    ).toEqual({ kind: 'personal', category: 'Health' });
    expect(
      answeredSubjectForPrayer({
        groupId: null,
        status: 'current',
        category: 'Health',
        isPersonal: false,
      })
    ).toBeNull();
  });

  it('builds a group subject from status when groupId is set', () => {
    expect(
      answeredSubjectForPrayer({
        groupId: 'g1',
        status: 'answered',
        category: 'Health',
        isPersonal: true,
      })
    ).toEqual({ kind: 'group', status: 'answered' });
  });

  it('menu state follows the subject, not a missing field', () => {
    expect(answeredMenuState({ kind: 'group', status: 'answered' })).toEqual({
      label: 'Answered',
      tone: 'green',
      filled: true,
    });
    expect(answeredMenuState({ kind: 'personal', category: 'Health' })).toEqual({
      label: 'Mark as answered',
      tone: 'blue',
      filled: false,
    });
  });

  it('opens the personal category dialog or the group yes/no dialog', () => {
    expect(answeredPromptFor({ kind: 'personal', category: 'Answered' })).toEqual({
      kind: 'personal',
      mode: 'unmark',
    });
    expect(answeredPromptFor({ kind: 'personal', category: 'Health' })).toEqual({
      kind: 'personal',
      mode: 'mark',
    });
    expect(answeredPromptFor({ kind: 'group', status: 'current' })).toMatchObject({
      kind: 'group',
      confirmText: 'Mark as answered',
      nextAnswered: true,
    });
    expect(answeredPromptFor({ kind: 'group', status: 'answered' })).toMatchObject({
      kind: 'group',
      title: 'Move back to Current?',
      nextAnswered: false,
    });
  });
});
