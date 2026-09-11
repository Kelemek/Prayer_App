export type BookletInsertMimeType = 'image/png' | 'image/jpeg';

export interface BookletInsertPage {
  id: string;
  sort_order: number;
  label: string | null;
  mime_type: BookletInsertMimeType;
  image_data: string;
  created_at?: string;
  updated_at?: string;
}
