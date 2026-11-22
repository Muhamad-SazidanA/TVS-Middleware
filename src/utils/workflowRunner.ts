import type { WorkflowStep, WorkflowDocScope } from "~/types/workflow";
import { FIELD_SYNONYMS } from "~/utils/documentRegistry";

export interface StepExecutionResult {
  stepId: string;
  stepName: string;
  actionType: string;
  input: string;
  output: string;
  applied: boolean;
  error?: string;
  warning?: string;
}

export interface PipelineExecutionResult {
  initialValue: string;
  finalValue: string;
  durationMs: number;
  stepResults: StepExecutionResult[];
  hasError: boolean;
  hasWarning: boolean;
}

/**
 * Executes a single transformation step on an input string
 */
export function applyWorkflowStep(
  input: string,
  step: WorkflowStep,
  docType?: string
): StepExecutionResult {
  const result: StepExecutionResult = {
    stepId: step.id,
    stepName: step.name,
    actionType: step.action.type,
    input: input,
    output: input,
    applied: false,
  };

  // Check if step is enabled
  if (!step.enabled) {
    return result;
  }

  // Check document scope filter
  if (step.docScope !== "all" && docType) {
    const normalizedScope = step.docScope.toLowerCase().replace(/[\s_-]+/g, "");
    const normalizedDoc = docType.toLowerCase().replace(/[\s_-]+/g, "");
    const match =
      normalizedDoc.includes(normalizedScope) ||
      normalizedScope.includes(normalizedDoc) ||
      ((normalizedScope === "ci" || normalizedScope === "invoice" || normalizedScope === "commercialinvoice") &&
        (normalizedDoc.includes("invoice") || normalizedDoc.includes("ci") || normalizedDoc.includes("commercial"))) ||
      ((normalizedScope === "pl" || normalizedScope === "packinglist" || normalizedScope === "packing") &&
        (normalizedDoc.includes("packing") || normalizedDoc.includes("pl") || normalizedDoc.includes("paking"))) ||
      ((normalizedScope === "bl" || normalizedScope === "billoflading") &&
        (normalizedDoc.includes("bl") || normalizedDoc.includes("lading") || normalizedDoc.includes("ladding") || normalizedDoc.includes("waybill"))) ||
      ((normalizedScope === "ak" || normalizedScope === "formak") &&
        (normalizedDoc.includes("ak") || normalizedDoc.includes("coo") || normalizedDoc.includes("origin"))) ||
      ((normalizedScope === "wl" || normalizedScope === "weightlist") &&
        (normalizedDoc.includes("wl") || normalizedDoc.includes("weight"))) ||
      ((normalizedScope === "ms" || normalizedScope === "mtc" || normalizedScope === "milltestcertificate" || normalizedScope === "millsheet") &&
        (normalizedDoc.includes("ms") || normalizedDoc.includes("mtc") || normalizedDoc.includes("mill") || normalizedDoc.includes("test") || normalizedDoc.includes("sheet"))) ||
      ((normalizedScope === "pib") &&
        (normalizedDoc.includes("pib") || normalizedDoc.includes("acuan")));
    if (!match) {
      return result;
    }
  }

  let val = input;
  const action = step.action;

  try {
    switch (action.type) {
      case "remove_characters": {
        const {
          mode,
          customChars,
          removePunctuation,
          removeNumbers,
          removeAlphabets,
          removeSpecialChars,
          removeWhitespace,
        } = action.config;

        if (mode === "punctuation" || removePunctuation) {
          // Remove common punctuation: . - / , # _ ( ) [ ] : ;
          val = val.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()\[\]]/g, "");
        }
        if (mode === "non_alphanumeric") {
          // Keep only letters and digits
          val = val.replace(/[^a-zA-Z0-9]/g, "");
        }
        if (mode === "non_numeric") {
          // Keep only digits and decimal point
          val = val.replace(/[^0-9.]/g, "");
        }
        if (removeNumbers) {
          // Remove all digits 0-9
          val = val.replace(/[0-9]/g, "");
        }
        if (removeAlphabets) {
          // Remove all letters a-z, A-Z
          val = val.replace(/[a-zA-Z]/g, "");
        }
        if (removeSpecialChars) {
          // Remove special symbols
          val = val.replace(/[@&*=~_`^|()[\]{}<>+\\#$%'"]/g, "");
        }
        if (removeWhitespace) {
          // Remove all whitespace
          val = val.replace(/\s+/g, "");
        }
        if (customChars && customChars.trim()) {
          // Escape special regex chars
          const escaped = customChars.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
          if (escaped) {
            const regex = new RegExp(`[${escaped}]`, "g");
            val = val.replace(regex, "");
          }
        }
        result.applied = true;
        break;
      }

      case "number_formatting": {
        const { removeCommas, thousandsSeparator, decimalFormat, roundDecimals, stripCurrency, stripUnits } =
          action.config;

        if (stripCurrency) {
          val = val.replace(/(?:USD|IDR|Rp|RP|\$|EUR|SGD|JPY|CNY)\s*/gi, "").trim();
        }

        if (stripUnits) {
          val = val.replace(/\s*(?:kg|kgs|pcs|pc|box|boxes|ctn|pkgs|pkg|ton|m3|cbm)\b/gi, "").trim();
        }

        if (thousandsSeparator || removeCommas || (typeof roundDecimals === "number" && roundDecimals >= 0)) {
          // Parse number cleanly
          let cleanStr = val.trim();
          // Detect European notation vs US notation
          if (cleanStr.includes(".") && cleanStr.includes(",")) {
            const lastDot = cleanStr.lastIndexOf(".");
            const lastComma = cleanStr.lastIndexOf(",");
            if (lastComma > lastDot) {
              // European: dots are thousands, comma is decimal
              cleanStr = cleanStr.replace(/\./g, "").replace(",", ".");
            } else {
              // US: commas are thousands, dot is decimal
              cleanStr = cleanStr.replace(/,/g, "");
            }
          } else if (cleanStr.includes(",")) {
            // Only comma: check if decimal or thousands
            if (/\d+,\d{1,4}$/.test(cleanStr)) {
              cleanStr = cleanStr.replace(",", ".");
            } else {
              cleanStr = cleanStr.replace(/,/g, "");
            }
          } else if ((cleanStr.match(/\./g) || []).length > 1) {
            // Multiple dots (e.g. 1.053.689.0000 or 1.053.689)
            const lastDotIdx = cleanStr.lastIndexOf(".");
            const intPart = cleanStr.slice(0, lastDotIdx).replace(/\./g, "");
            const decPart = cleanStr.slice(lastDotIdx + 1);
            if (decPart.length === 4 || decPart === "00" || decPart === "000") {
              cleanStr = `${intPart}.${decPart}`;
            } else {
              cleanStr = `${intPart}${decPart}`;
            }
          }

          const num = parseFloat(cleanStr);
          if (!isNaN(num)) {
            const decPlaces =
              typeof roundDecimals === "number" && roundDecimals >= 0
                ? roundDecimals
                : cleanStr.includes(".")
                ? cleanStr.split(".")[1]?.length || 0
                : 0;

            const fixedStr = decPlaces >= 0 ? num.toFixed(decPlaces) : String(num);
            const [intPart = "0", decPart] = fixedStr.split(".");

            let formattedInt = intPart;
            if (thousandsSeparator === "comma") {
              formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
            } else if (thousandsSeparator === "dot") {
              formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
            } else if (thousandsSeparator === "none" || removeCommas) {
              formattedInt = intPart.replace(/[,\.]/g, "");
            }

            const decSep =
              decimalFormat === "comma" || (thousandsSeparator === "dot" && decimalFormat !== "dot")
                ? ","
                : ".";

            val =
              decPart !== undefined && decPlaces > 0
                ? `${formattedInt}${decSep}${decPart}`
                : formattedInt;
          }
        } else {
          if (decimalFormat === "dot") {
            if (/\d+,\d{1,4}$/.test(val)) val = val.replace(",", ".");
          } else if (decimalFormat === "comma") {
            if (/\d+\.\d{1,4}$/.test(val)) val = val.replace(".", ",");
          }
        }

        result.applied = true;
        break;
      }

      case "replace_text": {
        const { findText, replaceWith, isRegex, matchCase } = action.config;
        if (findText) {
          if (isRegex) {
            const regex = new RegExp(findText, matchCase ? "g" : "gi");
            val = val.replace(regex, replaceWith || "");
          } else {
            if (matchCase) {
              val = val.split(findText).join(replaceWith || "");
            } else {
              const regex = new RegExp(
                findText.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&"),
                "gi"
              );
              val = val.replace(regex, replaceWith || "");
            }
          }
        }
        result.applied = true;
        break;
      }

      case "trim_whitespace": {
        const { trimEdges, collapseMultiple, removeAllSpaces } = action.config;
        if (removeAllSpaces) {
          val = val.replace(/\s+/g, "");
        } else {
          if (collapseMultiple) {
            val = val.replace(/\s+/g, " ");
          }
          if (trimEdges) {
            val = val.trim();
          }
        }
        result.applied = true;
        break;
      }

      case "case_transform": {
        const { transform } = action.config;
        if (transform === "uppercase") {
          val = val.toUpperCase();
        } else if (transform === "lowercase") {
          val = val.toLowerCase();
        } else if (transform === "titlecase") {
          val = val.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
        }
        result.applied = true;
        break;
      }

      case "date_normalize": {
        const { targetFormat } = action.config;
        // Parse common date string formats
        const cleanDateStr = val.trim();
        let dateObj: Date | null = null;

        // Try YYYY-MM-DD or YYYY/MM/DD
        const ymdMatch = cleanDateStr.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
        if (ymdMatch) {
          const [, y, m, d] = ymdMatch;
          dateObj = new Date(parseInt(y!, 10), parseInt(m!, 10) - 1, parseInt(d!, 10));
        } else {
          // Try DD-MM-YYYY or DD/MM/YYYY
          const dmyMatch = cleanDateStr.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
          if (dmyMatch) {
            const [, d, m, y] = dmyMatch;
            dateObj = new Date(parseInt(y!, 10), parseInt(m!, 10) - 1, parseInt(d!, 10));
          } else {
            // General Date parse fallback
            const parsed = new Date(cleanDateStr);
            if (!isNaN(parsed.getTime())) {
              dateObj = parsed;
            }
          }
        }

        if (dateObj && !isNaN(dateObj.getTime())) {
          const dd = String(dateObj.getDate()).padStart(2, "0");
          const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
          const yyyy = String(dateObj.getFullYear());
          const monthNames = [
            "Jan", "Feb", "Mar", "Apr", "May", "Jun",
            "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
          ];
          const mmm = monthNames[dateObj.getMonth()] || mm;

          if (targetFormat === "DD/MM/YYYY") {
            val = `${dd}/${mm}/${yyyy}`;
          } else if (targetFormat === "YYYY-MM-DD") {
            val = `${yyyy}-${mm}-${dd}`;
          } else if (targetFormat === "DD-MM-YYYY") {
            val = `${dd}-${mm}-${yyyy}`;
          } else if (targetFormat === "DD MMM YYYY") {
            val = `${dd} ${mmm} ${yyyy}`;
          }
        }
        result.applied = true;
        break;
      }

      case "prefix_suffix": {
        const { operation, value: affixVal } = action.config;
        if (affixVal) {
          if (operation === "add_prefix" && !val.startsWith(affixVal)) {
            val = affixVal + val;
          } else if (operation === "remove_prefix") {
            const trimmed = val.trim();
            if (trimmed.startsWith(affixVal)) {
              val = trimmed.slice(affixVal.length);
            } else if (val.startsWith(affixVal)) {
              val = val.slice(affixVal.length);
            }
          } else if (operation === "add_suffix" && !val.endsWith(affixVal)) {
            val = val + affixVal;
          } else if (operation === "remove_suffix") {
            const trimmed = val.trim();
            if (trimmed.endsWith(affixVal)) {
              val = trimmed.slice(0, -affixVal.length);
            } else if (val.endsWith(affixVal)) {
              val = val.slice(0, -affixVal.length);
            }
          }
        }
        result.applied = true;
        break;
      }

      case "validation_rule": {
        const { condition, paramValue, onFail, fallbackValue } = action.config;
        let isValid = true;
        let reason = "";

        if (condition === "not_empty") {
          isValid = val.trim().length > 0;
          reason = "Nilai tidak boleh kosong";
        } else if (condition === "is_number") {
          const num = parseFloat(val.replace(/,/g, ""));
          isValid = !isNaN(num);
          reason = "Nilai harus berupa angka numerik";
        } else if (condition === "min_length" && paramValue) {
          const min = parseInt(paramValue, 10) || 0;
          isValid = val.length >= min;
          reason = `Panjang karakter minimal ${min}`;
        } else if (condition === "max_length" && paramValue) {
          const max = parseInt(paramValue, 10) || 999;
          isValid = val.length <= max;
          reason = `Panjang karakter maksimal ${max}`;
        } else if (condition === "regex_match" && paramValue) {
          try {
            const regex = new RegExp(paramValue);
            isValid = regex.test(val);
            reason = `Pola tidak cocok dengan regex: ${paramValue}`;
          } catch {
            isValid = false;
            reason = "Ekspresi regex tidak valid";
          }
        }

        if (!isValid) {
          if (onFail === "error") {
            result.error = `[Validasi Gagal]: ${reason}`;
          } else if (onFail === "warning") {
            result.warning = `[Peringatan]: ${reason}`;
          } else if (onFail === "fallback") {
            val = fallbackValue || "";
            result.warning = `[Fallback]: Nilai diganti otomatis karena validasi gagal (${reason})`;
          }
        }
        result.applied = true;
        break;
      }

      case "value_mapping": {
        const { mappings, mode } = action.config;
        for (const m of mappings) {
          if (m.keyword && val.toLowerCase().includes(m.keyword.toLowerCase())) {
            if (mode === "replace") {
              val = m.mappedValue;
            } else if (mode === "append") {
              if (!val.toLowerCase().includes(m.mappedValue.toLowerCase())) {
                val = `${val} (${m.mappedValue})`;
              }
            }
            break;
          }
        }
        result.applied = true;
        break;
      }
    }
  } catch (err: unknown) {
    result.error = err instanceof Error ? err.message : String(err);
  }

  result.output = val;
  return result;
}

/**
 * Runs a complete pipeline sequence on an input value
 */
export function executeDataPipeline(
  input: string,
  field: string,
  docType: WorkflowDocScope | string,
  steps: WorkflowStep[]
): PipelineExecutionResult {
  const startTime = performance.now();
  let currentValue = input;
  const stepResults: StepExecutionResult[] = [];
  let hasError = false;
  let hasWarning = false;

  for (const step of steps) {
    // Check if targetField / targetFields matches (supports multiple select)
    const targets: string[] =
      Array.isArray(step.targetFields) && step.targetFields.length > 0
        ? step.targetFields
        : (step.targetField || "*").split(",").map((s) => s.trim()).filter(Boolean);

    const fieldMatch =
      targets.includes("*") ||
      targets.some((tf) => {
        const tfLow = tf.toLowerCase();
        const fLow = field.toLowerCase();
        if (tfLow === fLow || fLow.includes(tfLow) || tfLow.includes(fLow)) return true;
        const synonyms = FIELD_SYNONYMS[tf] || [];
        return synonyms.some((s) => {
          const sLow = s.toLowerCase();
          return sLow === fLow || fLow.includes(sLow) || sLow.includes(fLow);
        });
      });

    if (!fieldMatch) {
      continue;
    }

    const res = applyWorkflowStep(currentValue, step, docType);
    stepResults.push(res);
    if (res.applied) {
      currentValue = res.output;
    }
    if (res.error) {
      hasError = true;
    }
    if (res.warning) {
      hasWarning = true;
    }
  }

  const durationMs = Math.round((performance.now() - startTime) * 100) / 100;

  return {
    initialValue: input,
    finalValue: currentValue,
    durationMs,
    stepResults,
    hasError,
    hasWarning,
  };
}

/**
 * Default preset steps for workflow pipeline (default: empty, user creates steps as needed)
 */
export const DEFAULT_WORKFLOW_STEPS: WorkflowStep[] = [];

/**
 * Applies active Data Actions pipeline to all fields in an extracted document,
 * adding a `${key}_action` alongside the original `${key}`.
 */
export function applyDataActionsToFields(
  fields: Record<string, any>,
  docType: string,
  steps: WorkflowStep[]
): Record<string, any> {
  if (!fields || typeof fields !== "object") return fields;
  if (!steps || steps.length === 0) return fields;

  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(fields)) {
    result[key] = value;
    // Do not re-process action fields
    if (key.endsWith("_action")) continue;

    const strVal =
      value === undefined || value === null
        ? ""
        : typeof value === "object"
        ? String(value?.value ?? "")
        : String(value);

    const pipeResult = executeDataPipeline(strVal, key, docType, steps);
    // Put `${key}_action` right next to the original field
    result[`${key}_action`] = pipeResult.finalValue;
  }
  return result;
}

/**
 * Validates a workflow step configuration.
 * Returns isValid: false and warning: "Data masih kosong" if required target fields,
 * step name, or action configuration options are empty.
 */
export function validateWorkflowStep(step: WorkflowStep): { isValid: boolean; warning?: string } {
  if (!step || typeof step !== "object") {
    return { isValid: false, warning: "Data masih kosong" };
  }

  // 1. Validate step name
  if (!step.name || !step.name.trim()) {
    return { isValid: false, warning: "Data masih kosong" };
  }

  // 1b. Validate document scope
  if (!step.docScope || !step.docScope.trim()) {
    return { isValid: false, warning: "Data masih kosong" };
  }

  // 2. Validate target fields (filtering out empty/whitespace entries)
  const rawTargetFields = Array.isArray(step.targetFields)
    ? step.targetFields
        .map((s) => (typeof s === "string" ? s.trim() : ""))
        .filter(Boolean)
    : [];

  const fallbackFields =
    step.targetField && step.targetField.trim()
      ? step.targetField.trim() === "*"
        ? ["*"]
        : step.targetField
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
      : [];

  const targetFields = rawTargetFields.length > 0 ? rawTargetFields : fallbackFields;

  if (targetFields.length === 0) {
    return { isValid: false, warning: "Data masih kosong" };
  }

  // 3. Validate action specific configuration
  if (!step.action || !step.action.type) {
    return { isValid: false, warning: "Data masih kosong" };
  }

  switch (step.action.type) {
    case "replace_text": {
      const cfg = step.action.config;
      if (!cfg || !cfg.findText || !cfg.findText.trim()) {
        return { isValid: false, warning: "Data masih kosong" };
      }
      break;
    }
    case "prefix_suffix": {
      const cfg = step.action.config;
      if (!cfg || !cfg.value || !cfg.value.trim()) {
        return { isValid: false, warning: "Data masih kosong" };
      }
      break;
    }
    case "remove_characters": {
      const cfg = step.action.config;
      if (!cfg) {
        return { isValid: false, warning: "Data masih kosong" };
      }
      const hasAny = Boolean(
        cfg.removePunctuation ||
        cfg.removeNumbers ||
        cfg.removeAlphabets ||
        cfg.removeSpecialChars ||
        cfg.removeWhitespace ||
        (cfg.customChars && cfg.customChars.trim().length > 0) ||
        cfg.mode === "punctuation" ||
        cfg.mode === "non_alphanumeric" ||
        cfg.mode === "non_numeric"
      );
      if (!hasAny) {
        return { isValid: false, warning: "Data masih kosong" };
      }
      break;
    }
    case "trim_whitespace": {
      const cfg = step.action.config;
      if (!cfg) {
        return { isValid: false, warning: "Data masih kosong" };
      }
      if (!cfg.trimEdges && !cfg.collapseMultiple && !cfg.removeAllSpaces) {
        return { isValid: false, warning: "Data masih kosong" };
      }
      break;
    }
    case "number_formatting": {
      const cfg = step.action.config;
      if (!cfg) {
        return { isValid: false, warning: "Data masih kosong" };
      }
      const hasFormatting = Boolean(
        cfg.removeCommas ||
        cfg.thousandsSeparator ||
        cfg.stripCurrency ||
        cfg.stripUnits ||
        cfg.decimalFormat ||
        (typeof cfg.roundDecimals === "number" && cfg.roundDecimals >= 0)
      );
      if (!hasFormatting) {
        return { isValid: false, warning: "Data masih kosong" };
      }
      break;
    }
    case "case_transform": {
      const cfg = step.action.config;
      if (!cfg || !cfg.transform || !cfg.transform.trim()) {
        return { isValid: false, warning: "Data masih kosong" };
      }
      break;
    }
    case "date_normalize": {
      const cfg = step.action.config;
      if (!cfg || !cfg.targetFormat || !cfg.targetFormat.trim()) {
        return { isValid: false, warning: "Data masih kosong" };
      }
      break;
    }
    case "validation_rule": {
      const cfg = step.action.config;
      if (!cfg || !cfg.condition) {
        return { isValid: false, warning: "Data masih kosong" };
      }
      if (
        (cfg.condition === "min_length" ||
          cfg.condition === "max_length" ||
          cfg.condition === "regex_match") &&
        (!cfg.paramValue || !cfg.paramValue.trim())
      ) {
        return { isValid: false, warning: "Data masih kosong" };
      }
      break;
    }
    case "value_mapping": {
      const cfg = step.action.config;
      if (!cfg || !Array.isArray(cfg.mappings)) {
        return { isValid: false, warning: "Data masih kosong" };
      }
      const validMappings = cfg.mappings.filter(
        (m) => m && typeof m.keyword === "string" && m.keyword.trim().length > 0
      );
      if (validMappings.length === 0) {
        return { isValid: false, warning: "Data masih kosong" };
      }
      break;
    }
    default:
      break;
  }

  return { isValid: true };
}

/**
 * Applies active Data Actions pipeline to all rows in an extracted table,
 * adding a `${key}_action` alongside each original `${key}` in every row
 * without corrupting original data.
 */
export function applyDataActionsToTableRows(
  table: Array<Record<string, any>>,
  docType: string,
  steps: WorkflowStep[]
): Array<Record<string, any>> {
  if (!Array.isArray(table)) return table;
  if (!steps || steps.length === 0) return table;

  return table.map((row) => {
    if (!row || typeof row !== "object") return row;
    const newRow: Record<string, any> = {};
    for (const [key, value] of Object.entries(row)) {
      newRow[key] = value;
      // Do not re-process action fields
      if (key.endsWith("_action")) continue;

      const strVal =
        value === undefined || value === null
          ? ""
          : typeof value === "object"
          ? String(value?.value ?? "")
          : String(value);

      const pipeResult = executeDataPipeline(strVal, key, docType, steps);
      newRow[`${key}_action`] = pipeResult.finalValue;
    }
    return newRow;
  });
}


