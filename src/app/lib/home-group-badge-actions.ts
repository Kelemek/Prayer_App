/** Payload for marking group prayer badges read from Home group filters. */
export type HomeGroupBadgeMarkReadPayload = {
  status: 'current' | 'answered';
  groupId?: string;
};
