export type CardActionsOverflowActionId =
  | 'reminder'
  | 'answered'
  | 'edit'
  | 'members'
  | 'delete'
  /** Home reorder surfaces — see {@link HomeReorderHandlesUi}. */
  | 'reorder';

export type CardActionsOverflowIcon =
  | 'bell'
  | 'check'
  | 'edit'
  | 'users'
  | 'trash'
  | 'grip';

export type CardActionsOverflowTone = 'blue' | 'green' | 'gray' | 'red';

export interface CardActionsOverflowItem {
  id: CardActionsOverflowActionId;
  label: string;
  icon: CardActionsOverflowIcon;
  tone: CardActionsOverflowTone;
  onSelect: () => void;
  ariaLabel?: string;
  tourAnchorId?: string | null;
  filled?: boolean;
}
