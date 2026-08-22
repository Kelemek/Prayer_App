export type CardActionsOverflowActionId =
  | 'reminder'
  | 'answered'
  | 'edit'
  | 'share'
  | 'delete';

export type CardActionsOverflowIcon = 'bell' | 'check' | 'edit' | 'share' | 'trash';

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
