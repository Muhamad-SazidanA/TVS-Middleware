export type UscDocumentType =
  | "pib"
  | "ci"
  | "pl"
  | "bl"
  | "ak"
  | "wl"
  | "ms";

export type WorkflowDocScope =
  | "all"
  | "pib"
  | "ci"
  | "invoice"
  | "packing_list"
  | "packing"
  | "pl"
  | "bl"
  | "ak"
  | "wl"
  | "ms";

export type WorkflowActionType =
  | "remove_characters"
  | "number_formatting"
  | "replace_text"
  | "trim_whitespace"
  | "case_transform"
  | "date_normalize"
  | "prefix_suffix"
  | "validation_rule"
  | "value_mapping";

export interface RemoveCharactersConfig {
  mode?: "punctuation" | "non_alphanumeric" | "non_numeric" | "custom" | "quick";
  customChars?: string;
  removePunctuation?: boolean;
  removeNumbers?: boolean;
  removeAlphabets?: boolean;
  removeSpecialChars?: boolean;
  removeWhitespace?: boolean;
}

export interface NumberFormattingConfig {
  removeCommas?: boolean;
  thousandsSeparator?: "none" | "comma" | "dot"; // "none" (1234567), "comma" (1,234,567), "dot" (1.234.567)
  decimalFormat?: "dot" | "comma";
  roundDecimals?: number; // -1 = keep original, 0, 2, 4
  stripCurrency?: boolean;
  stripUnits?: boolean;
}

export interface ReplaceTextConfig {
  findText: string;
  replaceWith: string;
  isRegex?: boolean;
  matchCase?: boolean;
}

export interface TrimWhitespaceConfig {
  trimEdges?: boolean;
  collapseMultiple?: boolean;
  removeAllSpaces?: boolean;
}

export interface CaseTransformConfig {
  transform: "uppercase" | "lowercase" | "titlecase";
}

export interface DateNormalizeConfig {
  targetFormat: "DD/MM/YYYY" | "YYYY-MM-DD" | "DD-MM-YYYY" | "DD MMM YYYY";
}

export interface PrefixSuffixConfig {
  operation: "add_prefix" | "remove_prefix" | "add_suffix" | "remove_suffix";
  value: string;
}

export interface ValidationRuleConfig {
  condition: "not_empty" | "is_number" | "min_length" | "max_length" | "regex_match";
  paramValue?: string;
  onFail: "warning" | "error" | "fallback";
  fallbackValue?: string;
}

export interface ValueMappingItem {
  keyword: string;
  mappedValue: string;
}

export interface ValueMappingConfig {
  mappings: ValueMappingItem[];
  mode: "replace" | "append";
}

export type ActionConfig =
  | { type: "remove_characters"; config: RemoveCharactersConfig }
  | { type: "number_formatting"; config: NumberFormattingConfig }
  | { type: "replace_text"; config: ReplaceTextConfig }
  | { type: "trim_whitespace"; config: TrimWhitespaceConfig }
  | { type: "case_transform"; config: CaseTransformConfig }
  | { type: "date_normalize"; config: DateNormalizeConfig }
  | { type: "prefix_suffix"; config: PrefixSuffixConfig }
  | { type: "validation_rule"; config: ValidationRuleConfig }
  | { type: "value_mapping"; config: ValueMappingConfig };

export interface WorkflowStep {
  id: string;
  name: string;
  description?: string;
  docScope: WorkflowDocScope;
  targetField?: string;
  targetFields?: string[];
  outputMode?: "new_field" | "original_field"; // default "new_field"
  outputFieldName?: string;
  quickCheckboxes?: {
    numbers?: boolean;
    alphabets?: boolean;
    specialCharacters?: boolean;
    whitespace?: boolean;
    punctuation?: boolean;
  };
  action: ActionConfig;
  enabled: boolean;
  sampleInput?: string;
}

export interface WorkflowPipeline {
  id: string;
  name: string;
  description: string;
  version: string;
  updatedAt: string;
  steps: WorkflowStep[];
}
