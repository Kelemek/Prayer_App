export type InfoHeaderPreviewAction =
  | "help"
  | "settings"
  | "pray"
  | "request"
  | "search"
  | "card-update"
  | "card-pray-for";

export type InfoPersonalActionPreview = "answered" | "edit" | "delete";

export type InfoPreviewModalState =
  | { kind: "header"; action: InfoHeaderPreviewAction }
  | { kind: "promptCategories" }
  | { kind: "badges" }
  | { kind: "personalAction"; action: InfoPersonalActionPreview }
  | { kind: "personalCategories" };

export type InfoPreviewFilter =
  | "current"
  | "answered"
  | "archived"
  | "total"
  | "prompts"
  | "personal";

export function isPublicPreviewFilter(
  filter: InfoPreviewFilter
): filter is "current" | "answered" | "archived" | "total" {
  return (
    filter === "current" ||
    filter === "answered" ||
    filter === "archived" ||
    filter === "total"
  );
}

/** True when the Public top tab or its sub-tabs (including Prompts) are active in the preview. */
export function isPublicAreaPreviewFilter(filter: InfoPreviewFilter): boolean {
  return isPublicPreviewFilter(filter) || filter === "prompts";
}
