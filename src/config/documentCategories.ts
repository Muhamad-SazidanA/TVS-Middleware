export interface DocumentCategoryConfig {
  num: number;
  code: string;
  title: string;
  allowMultiple: boolean;
}

/**
 * 7 official USC document categories matching `/upload`.
 */
export const DOCUMENT_CATEGORIES: DocumentCategoryConfig[] = [
  { num: 1, code: "PIB", title: "PIB (File Acuan)", allowMultiple: false },
  { num: 2, code: "AK", title: "AK", allowMultiple: false },
  { num: 3, code: "WL", title: "WL", allowMultiple: false },
  { num: 4, code: "MS", title: "MS", allowMultiple: false },
  { num: 5, code: "BL", title: "Bill of Lading", allowMultiple: false },
  { num: 6, code: "PL", title: "Packing List", allowMultiple: true },
  { num: 7, code: "Invoice", title: "Invoice", allowMultiple: true },
];

/**
 * Normalizes any raw fileType or category label into one of the 7 official codes.
 */
export function normalizeCategoryCode(rawType: string): string {
  const ft = (rawType || "").trim().toLowerCase();
  if (ft === "pib" || ft.includes("file acuan") || ft.startsWith("pib")) return "PIB";
  if (ft.includes("invoice") || ft === "ci") return "Invoice";
  if (ft.includes("packing") || ft.includes("paking") || ft === "pl") return "PL";
  if (ft.includes("lading") || ft.includes("ladding") || ft === "bl") return "BL";
  if (ft === "ak" || ft.includes("form ak") || ft.includes("coo") || ft.includes("origin")) return "AK";
  if (ft === "wl" || ft.includes("weight")) return "WL";
  if (ft === "ms" || ft === "mtc" || ft.includes("mill") || ft.includes("sheet")) return "MS";
  return rawType.trim();
}

export function getCategoryConfigByInput(input: string): DocumentCategoryConfig {
  const normalizedCode = normalizeCategoryCode(input);
  return (
    DOCUMENT_CATEGORIES.find(
      (c) =>
        c.code.toLowerCase() === normalizedCode.toLowerCase() ||
        c.title.toLowerCase() === (input || "").trim().toLowerCase()
    ) || DOCUMENT_CATEGORIES[0]!
  );
}
