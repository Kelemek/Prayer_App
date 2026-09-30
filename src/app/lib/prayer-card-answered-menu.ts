import type { PersonalPrayerAnsweredStatusMode } from '../components/personal-prayer-answered-status-modal/personal-prayer-answered-status-modal.component';

export type AnsweredSubject =
  | { kind: 'personal'; category: string | null }
  | { kind: 'group'; status: string };

export interface AnsweredMenuState {
  label: string;
  tone: 'blue' | 'green';
  filled: boolean;
}

export type AnsweredPrompt =
  | { kind: 'personal'; mode: PersonalPrayerAnsweredStatusMode }
  | {
      kind: 'group';
      title: string;
      message: string;
      confirmText: string;
      nextAnswered: boolean;
    };

export function answeredSubjectForPrayer(input: {
  groupId: string | null | undefined;
  status: string | null | undefined;
  category: string | null | undefined;
  isPersonal: boolean;
}): AnsweredSubject | null {
  if (input.groupId) {
    return { kind: 'group', status: input.status ?? 'current' };
  }
  if (!input.isPersonal) {
    return null;
  }
  return { kind: 'personal', category: input.category ?? null };
}

function subjectIsAnswered(subject: AnsweredSubject): boolean {
  switch (subject.kind) {
    case 'group':
      return subject.status === 'answered';
    case 'personal':
      return subject.category === 'Answered';
    default: {
      const _exhaustive: never = subject;
      return _exhaustive;
    }
  }
}

export function answeredMenuState(subject: AnsweredSubject): AnsweredMenuState {
  const answered = subjectIsAnswered(subject);
  return {
    label: answered ? 'Answered' : 'Mark as answered',
    tone: answered ? 'green' : 'blue',
    filled: answered,
  };
}

export function answeredPromptFor(subject: AnsweredSubject): AnsweredPrompt {
  switch (subject.kind) {
    case 'personal':
      return {
        kind: 'personal',
        mode: subject.category === 'Answered' ? 'unmark' : 'mark',
      };
    case 'group':
      if (subject.status === 'answered') {
        return {
          kind: 'group',
          title: 'Move back to Current?',
          message: 'Move this prayer back to Current?',
          confirmText: 'Move back to Current',
          nextAnswered: false,
        };
      }
      return {
        kind: 'group',
        title: 'Mark as answered?',
        message:
          'Move this prayer to Answered? You can open the menu again later to move it back to Current.',
        confirmText: 'Mark as answered',
        nextAnswered: true,
      };
    default: {
      const _exhaustive: never = subject;
      return _exhaustive;
    }
  }
}
