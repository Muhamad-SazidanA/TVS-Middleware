import { env } from "~/env";

export const CATEGORY_MODEL_MAP: Record<string, string> = {
  PIB: env.MODEL_PIB || "f058f626-44d2-4b98-b529-bf1e521801aa",
  "PIB Lanjutan": env.MODEL_PIB_LANJUTAN || "422f529a-d099-470a-a194-8397f7c25056",
  Invoice: env.MODEL_INVOICE || "2774a4e1-671e-47d4-a7f4-30bde9406e3f",
  "Packing List": env.MODEL_PACKING_LIST || "83e76ec0-1396-4b05-a552-3bd4df81b951",
  BL: env.MODEL_BL || "3971b95f-eff3-4976-88da-9e48804d8f19",
  "Master BL": env.MODEL_MASTER_BL || "892d9b27-c846-480e-8737-4b27f74005fb",
  "Rekap Document": env.MODEL_RECAP_DOCUMENT || "e643773c-620d-488b-873d-3e9f043b1e75",
};

export function getModelIdForCategory(categoryTitle: string): string {
  const modelId = CATEGORY_MODEL_MAP[categoryTitle];
  if (!modelId) {
    throw new Error(`No Nanonets OCR model configured for category: ${categoryTitle}`);
  }
  return modelId;
}
