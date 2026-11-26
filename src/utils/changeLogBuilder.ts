import { applyDataActionsToFields, applyDataActionsToTableRows } from "~/utils/workflowRunner";
import type { WorkflowStep } from "~/types/workflow";
import type {
  ChangeEventCategory,
  ComparisonFieldModel,
  FieldChangeEvent,
} from "~/app/matching/_components/detailTypes";

export function stripStaleActionKeys(
  rec: Record<string, unknown>,
  manualEditsMap: Record<string, { oldValue?: string; newValue?: string }>
): Record<string, unknown> {
  const editedTokens = new Set(
    Object.keys(manualEditsMap || {}).map((mk) => normalizeFieldToken(mk))
  );
  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rec || {})) {
    if (k.toLowerCase().endsWith("_action") || k.toLowerCase().endsWith(" action")) {
      const baseToken = normalizeFieldToken(k);
      if (!editedTokens.has(baseToken)) {
        continue;
      }
    }
    cleaned[k] = v;
  }
  return cleaned;
}

export function normalizeDocCode(typeRaw?: string | null): string {
  const t = String(typeRaw || "").trim().toLowerCase();
  if (!t) return "Dokumen";
  if (t === "batch") return "Batch";
  if (t === "pib" || t.includes("file acuan") || t.startsWith("pib")) return "PIB";
  if (t === "invoice" || t === "ci" || t.includes("commercial invoice")) return "Invoice";
  if (t === "pl" || t.includes("packing") || t.includes("paking")) return "PL";
  if (t === "bl" || t.includes("lading") || t.includes("ladding")) return "BL";
  if (t === "ak" || t.includes("coo") || t.includes("origin")) return "AK";
  if (t === "wl" || t.includes("weight")) return "WL";
  if (t === "ms" || t === "mtc" || t.includes("mill") || t.includes("sheet")) return "MS";
  return String(typeRaw || "").trim();
}

export function formatDocDisplayName(typeRaw?: string | null): string {
  const code = normalizeDocCode(typeRaw);
  const map: Record<string, string> = {
    PIB: "PIB (Acuan)",
    Invoice: "Invoice",
    PL: "Packing List",
    BL: "Bill of Lading",
    AK: "Form AK",
    WL: "Weight List",
    MS: "Mill Sheet",
    Batch: "Batch",
  };
  return map[code] || code;
}

export function normalizeFieldToken(name?: string | null): string {
  return String(name || "")
    .toLowerCase()
    .replace(/_action$/i, "")
    .replace(/ action$/i, "")
    .replace(/[^a-z0-9]/g, "");
}

function parseRawIsiObj(isi: unknown): Record<string, unknown> {
  if (!isi) return {};
  try {
    const parsed = typeof isi === "string" ? JSON.parse(isi) : isi;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function readCellText(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "object") {
    const v = (val as { value?: unknown }).value;
    return v === null || v === undefined ? "" : String(v).trim();
  }
  return String(val).trim();
}

function classifyDbActionLog(log: {
  oldValue?: string | null;
  newValue?: string | null;
  notes?: string | null;
  docType?: string | null;
}): { category: ChangeEventCategory; categoryLabel: string; cleanNotes: string } {
  const rawNotes = String(log.notes || "").trim();

  if (rawNotes.startsWith("[Setujui Massal") || rawNotes.includes("Konfirmasi Massal")) {
    return {
      category: "SETUJUI_ALL",
      categoryLabel: "Setujui Massal (All)",
      cleanNotes: rawNotes.replace(/^\[Setujui Massal[^\]]*\]\s*/i, ""),
    };
  }
  if (rawNotes.startsWith("[Batal Setujui") || rawNotes.toLowerCase().includes("batal konfirmasi")) {
    return {
      category: "BATAL_SETUJUI",
      categoryLabel: "Batal Setujui",
      cleanNotes: rawNotes.replace(/^\[Batal Setujui[^\]]*\]\s*/i, ""),
    };
  }
  if (
    rawNotes.startsWith("[Setujui Berkas") ||
    normalizeDocCode(log.docType) === "Batch"
  ) {
    return {
      category: "SETUJUI_BERKAS",
      categoryLabel: "Setujui Berkas",
      cleanNotes: rawNotes.replace(/^\[Setujui Berkas[^\]]*\]\s*/i, ""),
    };
  }
  if (
    rawNotes.startsWith("[Setujui Satuan") ||
    rawNotes.toLowerCase().startsWith("konfirmasi manual") ||
    String(log.oldValue || "").trim() === "MISMATCH"
  ) {
    return {
      category: "SETUJUI_SATUAN",
      categoryLabel: "Setujui Satuan",
      cleanNotes: rawNotes.replace(/^\[Setujui Satuan[^\]]*\]\s*/i, ""),
    };
  }

  return {
    category: "EDIT",
    categoryLabel: "Edit Manual",
    cleanNotes: rawNotes.replace(/^\[Edit Nilai[^\]]*\]\s*/i, ""),
  };
}

/**
 * Extracts all active Data Action transformations from a batch's details.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractDataActionEvents(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  details: any[],
  dataActions?: WorkflowStep[]
): FieldChangeEvent[] {
  const events: FieldChangeEvent[] = [];
  const seenPerDocField = new Set<string>();
  const hasLiveDataActions = Array.isArray(dataActions);

  for (const det of details || []) {
    if (!det?.isi) continue;
    const p = parseRawIsiObj(det.isi);
    const docCode = normalizeDocCode(det.fileType);
    const manualEditsMap = (p.manualEdits as Record<string, { oldValue?: string; newValue?: string }>) || {};
    const dataActionOriginals = (p.dataActionOriginals as Record<string, { rawValue?: string; actionValue?: string }>) || {};

    let fields = { ...((p.fields as Record<string, unknown>) || {}) };
    let table = Array.isArray(p.table)
      ? (p.table as Array<Record<string, unknown>>).map((r) => ({ ...r }))
      : [];

    if (hasLiveDataActions) {
      fields = stripStaleActionKeys(fields, manualEditsMap);
      table = table.map((row) => stripStaleActionKeys(row, manualEditsMap));
      try {
        if (dataActions.length > 0) {
          fields = applyDataActionsToFields(fields as Record<string, string>, docCode || "all", dataActions);
          if (table.length > 0) {
            table = applyDataActionsToTableRows(table, docCode || "all", dataActions);
          }
        }
      } catch {
        // Ignore pipeline evaluation fallback error
      }
    }

    const collectFromRecord = (rec: Record<string, unknown>) => {
      // Check saved pre-edit Data Action originals first
      for (const [origKey, origMeta] of Object.entries(dataActionOriginals)) {
        const rawOrig = readCellText(origMeta?.rawValue);
        let actOrig = readCellText(origMeta?.actionValue);
        if (hasLiveDataActions) {
          if (dataActions.length === 0) continue;
          const liveCheck = applyDataActionsToFields({ [origKey]: rawOrig }, docCode || "all", dataActions);
          const liveVal = readCellText(liveCheck[`${origKey}_action`]);
          if (!liveVal || liveVal === "-" || liveVal === rawOrig) continue;
          actOrig = liveVal;
        }
        if (!rawOrig || rawOrig === "-" || !actOrig || actOrig === "-" || rawOrig === actOrig) {
          continue;
        }
        const dedupeKey = `${docCode}::${normalizeFieldToken(origKey)}`;
        if (seenPerDocField.has(dedupeKey)) continue;
        seenPerDocField.add(dedupeKey);
        events.push({
          id: `da-${det.id ?? docCode}-${origKey}`,
          category: "DATA_ACTION",
          categoryLabel: "Data Action",
          docType: docCode,
          fieldName: origKey,
          fieldLabel: origKey.replace(/_/g, " "),
          oldValue: rawOrig,
          newValue: actOrig,
          notes: `Transformasi otomatis Data Action pada ${formatDocDisplayName(docCode)} (${origKey.replace(/_/g, " ")})`,
          actor: "Sistem (Data Action)",
          timestamp: det.updatedAt ? String(det.updatedAt) : det.createdAt ? String(det.createdAt) : undefined,
        });
      }

      for (const [k, v] of Object.entries(rec)) {
        if (!k.toLowerCase().endsWith("_action") && !k.toLowerCase().endsWith(" action")) continue;
        const baseKey = k.replace(/_action$/i, "").replace(/ action$/i, "");
        const dedupeKey = `${docCode}::${normalizeFieldToken(baseKey)}`;
        if (seenPerDocField.has(dedupeKey)) continue;

        let actVal = readCellText(v);
        const rawVal = readCellText(rec[baseKey]);

        // Guard: if _action currently holds a manualEdit value, re-compute true Data Action from rawVal
        const baseToken = normalizeFieldToken(baseKey);
        const matchingManual = Object.entries(manualEditsMap).find(
          ([mk]) => normalizeFieldToken(mk) === baseToken
        )?.[1];
        if (matchingManual?.newValue !== undefined && String(matchingManual.newValue).trim() === actVal) {
          try {
            if (hasLiveDataActions && dataActions.length > 0 && rawVal && rawVal !== "-") {
              const recomputed = applyDataActionsToFields({ [baseKey]: rawVal }, docCode || "all", dataActions);
              actVal = readCellText(recomputed[`${baseKey}_action`]);
            } else {
              actVal = "";
            }
          } catch {
            actVal = "";
          }
        }

        if (!actVal || actVal === "-" || !rawVal || rawVal === "-" || actVal === rawVal) {
          continue;
        }

        seenPerDocField.add(dedupeKey);

        events.push({
          id: `da-${det.id ?? docCode}-${baseKey}`,
          category: "DATA_ACTION",
          categoryLabel: "Data Action",
          docType: docCode,
          fieldName: baseKey,
          fieldLabel: baseKey.replace(/_/g, " "),
          oldValue: rawVal,
          newValue: actVal,
          notes: `Transformasi otomatis Data Action pada ${formatDocDisplayName(docCode)} (${baseKey.replace(/_/g, " ")})`,
          actor: "Sistem (Data Action)",
          timestamp: det.updatedAt ? String(det.updatedAt) : det.createdAt ? String(det.createdAt) : undefined,
        });
      }
    };

    collectFromRecord(fields);
    if (table.length > 0 && table[0]) {
      collectFromRecord(table[0]);
    }
  }

  return events;
}

/**
 * Extracts Kamus Ekuivalensi match events from evaluated comparison fields.
 */
export function extractKamusEvents(fields: ComparisonFieldModel[]): FieldChangeEvent[] {
  const events: FieldChangeEvent[] = [];
  const seen = new Set<string>();

  for (const f of fields || []) {
    const reason = f.kamusReason || (f.matchReason?.includes("Kamus") ? f.matchReason : "");
    if (!reason || !reason.toLowerCase().includes("kamus")) continue;

    const docCode = normalizeDocCode(f.docCode);
    const dedupeKey = `${docCode}::${normalizeFieldToken(f.fieldName || f.id)}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const cleanReason = reason.replace(/^\(|\)$/g, "").trim();
    const canonicalMatch = /"([^"]+)"/.exec(cleanReason);
    const canonicalLabel = canonicalMatch?.[1] ? `Setara: ${canonicalMatch[1]}` : "Setara (Kamus)";

    events.push({
      id: `kamus-${docCode}-${f.id}`,
      category: "KAMUS",
      categoryLabel: "Kamus Ekuivalensi",
      docType: docCode,
      fieldName: f.fieldName,
      fieldLabel: f.label,
      oldValue: `${f.pibValue || "-"}  <->  ${f.supportingValue || "-"}`,
      newValue: canonicalLabel,
      notes: cleanReason,
      actor: "Sistem (Kamus)",
    });
  }

  return events;
}

/**
 * Builds complete chronological audit/change history for a batch across:
 * 1) Data Actions, 2) Kamus Ekuivalensi, 3) DB ActionLogs (Edits, Setujui Satuan/All, Batal, Setujui Berkas),
 * 4) JSON fallback history (older edits/manualMatches/document updates without DB ActionLog rows).
 */
export function buildBatchChangeLogs(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawBatch: { details?: any[]; actionLogs?: any[]; createdBy?: { name?: string | null } | null },
  evaluatedFields: ComparisonFieldModel[] = [],
  dataActions?: WorkflowStep[]
): FieldChangeEvent[] {
  const details = Array.isArray(rawBatch?.details) ? rawBatch.details : [];
  const dbLogs = Array.isArray(rawBatch?.actionLogs) ? rawBatch.actionLogs : [];
  const defaultCreator = rawBatch?.createdBy?.name || "Operator";

  const dataActionEvents = extractDataActionEvents(details, dataActions);
  const kamusEvents = extractKamusEvents(evaluatedFields);

  // Build persistent ActionLog events chronologically
  const dbEvents: FieldChangeEvent[] = dbLogs.map((log, idx) => {
    const { category, categoryLabel, cleanNotes } = classifyDbActionLog(log);
    const docCode = normalizeDocCode(log.docType);
    return {
      id: `al-${log.id ?? idx}`,
      category,
      categoryLabel,
      docType: docCode,
      fieldName: String(log.fieldName || "-"),
      fieldLabel: String(log.fieldName || "-").replace(/_/g, " "),
      oldValue: String(log.oldValue || "-"),
      newValue: String(log.newValue || "-"),
      notes: cleanNotes || `${categoryLabel} pada ${log.fieldName || "-"}`,
      actor: String(log.actionBy || defaultCreator),
      timestamp: log.createdAt ? String(log.createdAt) : undefined,
    };
  });

  // Fallback for JSON history entries not present in actionLogs (legacy data safety)
  const fallbackEvents: FieldChangeEvent[] = [];
  for (const det of details) {
    if (!det?.isi) continue;
    const p = parseRawIsiObj(det.isi);
    const docCode = normalizeDocCode(det.fileType);

    // 1. Edit history fallback (array or legacy map deduplicated by timestamp+value)
    const editHistory = Array.isArray(p.manualEditHistory)
      ? (p.manualEditHistory as Array<Record<string, unknown>>)
      : [];

    if (editHistory.length > 0) {
      editHistory.forEach((entry, idx) => {
        const fName = String(entry.fieldName || "-");
        const oldVal = String(entry.oldValue || "-");
        const newVal = String(entry.newValue || "-");
        const alreadyInDb = dbEvents.some(
          (e) =>
            e.category === "EDIT" &&
            normalizeDocCode(e.docType) === docCode &&
            normalizeFieldToken(e.fieldName) === normalizeFieldToken(fName) &&
            e.oldValue === oldVal &&
            e.newValue === newVal
        );
        if (!alreadyInDb) {
          fallbackEvents.push({
            id: `fb-edit-hist-${det.id ?? docCode}-${idx}`,
            category: "EDIT",
            categoryLabel: "Edit Manual",
            docType: docCode,
            fieldName: fName,
            fieldLabel: fName.replace(/_/g, " "),
            oldValue: oldVal,
            newValue: newVal,
            notes: `Koreksi nilai manual oleh ${String(entry.editedBy || defaultCreator)}`,
            actor: String(entry.editedBy || defaultCreator),
            timestamp: entry.editedAt ? String(entry.editedAt) : undefined,
          });
        }
      });
    } else if (p.manualEdits && typeof p.manualEdits === "object") {
      const seenEditSignatures = new Set<string>();
      for (const [k, rawV] of Object.entries(p.manualEdits as Record<string, Record<string, unknown>>)) {
        const oldVal = String(rawV?.oldValue || "-");
        const newVal = String(rawV?.newValue || "-");
        const editedAt = rawV?.editedAt ? String(rawV.editedAt) : "";
        const sig = `${editedAt}::${oldVal}::${newVal}`;
        if (seenEditSignatures.has(sig)) continue;
        seenEditSignatures.add(sig);

        const alreadyInDb = dbEvents.some(
          (e) =>
            e.category === "EDIT" &&
            normalizeDocCode(e.docType) === docCode &&
            e.oldValue === oldVal &&
            e.newValue === newVal
        );
        if (!alreadyInDb && newVal !== "-") {
          fallbackEvents.push({
            id: `fb-edit-${det.id ?? docCode}-${k}`,
            category: "EDIT",
            categoryLabel: "Edit Manual",
            docType: docCode,
            fieldName: k,
            fieldLabel: k.replace(/_/g, " "),
            oldValue: oldVal,
            newValue: newVal,
            notes: `Perubahan nilai manual pada ${k.replace(/_/g, " ")}`,
            actor: String(rawV?.editedBy || defaultCreator),
            timestamp: editedAt || undefined,
          });
        }
      }
    }

    // 2. Manual match history fallback (e.g., legacy Bulk Setujui before actionLog recording)
    const matchHistory = Array.isArray(p.manualMatchHistory)
      ? (p.manualMatchHistory as Array<Record<string, unknown>>)
      : [];

    if (matchHistory.length > 0) {
      matchHistory.forEach((entry, idx) => {
        const fName = String(entry.fieldLabel || entry.fieldName || entry.fieldId || "-");
        const isBulk = String(entry.actionMode || "").toUpperCase() === "MASSAL";
        const isConfirmed = entry.confirmed !== false;
        const alreadyInDb = dbEvents.some(
          (e) =>
            (e.category === "SETUJUI_SATUAN" || e.category === "SETUJUI_ALL" || e.category === "BATAL_SETUJUI") &&
            normalizeDocCode(e.docType) === docCode &&
            (normalizeFieldToken(e.fieldName) === normalizeFieldToken(fName) ||
              normalizeFieldToken(e.fieldName) === normalizeFieldToken(String(entry.fieldName || "")))
        );
        if (!alreadyInDb) {
          fallbackEvents.push({
            id: `fb-match-hist-${det.id ?? docCode}-${idx}`,
            category: !isConfirmed ? "BATAL_SETUJUI" : isBulk ? "SETUJUI_ALL" : "SETUJUI_SATUAN",
            categoryLabel: !isConfirmed
              ? "Batal Setujui"
              : isBulk
              ? "Setujui Massal (All)"
              : "Setujui Satuan",
            docType: docCode,
            fieldName: fName,
            fieldLabel: fName,
            oldValue: isConfirmed ? "MISMATCH" : "MATCH",
            newValue: isConfirmed
              ? isBulk
                ? "MATCH (Setujui Massal)"
                : "MATCH (Setujui Satuan)"
              : "MISMATCH",
            notes: isConfirmed
              ? `${isBulk ? "Konfirmasi massal" : "Konfirmasi satuan"} oleh ${String(entry.confirmedBy || defaultCreator)}`
              : `Batal konfirmasi oleh ${String(entry.confirmedBy || defaultCreator)}`,
            actor: String(entry.confirmedBy || defaultCreator),
            timestamp: entry.confirmedAt ? String(entry.confirmedAt) : undefined,
          });
        }
      });
    } else if (p.manualMatches && typeof p.manualMatches === "object") {
      const seenMatchSig = new Set<string>();
      for (const [mk, mv] of Object.entries(p.manualMatches as Record<string, Record<string, unknown>>)) {
        if (!mv || !mv.confirmed) continue;
        const confAt = mv.confirmedAt ? String(mv.confirmedAt) : "";
        const confBy = mv.confirmedBy ? String(mv.confirmedBy) : defaultCreator;
        const sig = `${confAt}::${confBy}::${mk.includes("-") ? mk : normalizeFieldToken(mk)}`;
        if (seenMatchSig.has(sig)) continue;
        seenMatchSig.add(sig);

        // Skip duplicate clean lowercase token if full key exists at exact same timestamp
        const isNormalizedDuplicate =
          !/[-_\s]/.test(mk) &&
          Object.entries(p.manualMatches as Record<string, Record<string, unknown>>).some(
            ([ok, ov]) =>
              ok !== mk &&
              normalizeFieldToken(ok) === normalizeFieldToken(mk) &&
              String(ov?.confirmedAt || "") === confAt
          );
        if (isNormalizedDuplicate) continue;

        const alreadyInDb = dbEvents.some(
          (e) =>
            (e.category === "SETUJUI_SATUAN" || e.category === "SETUJUI_ALL") &&
            normalizeDocCode(e.docType) === docCode &&
            normalizeFieldToken(e.fieldName) === normalizeFieldToken(mk)
        );
        if (!alreadyInDb) {
          fallbackEvents.push({
            id: `fb-match-${det.id ?? docCode}-${mk}`,
            category: "SETUJUI_SATUAN",
            categoryLabel: "Setujui Manual",
            docType: docCode,
            fieldName: mk,
            fieldLabel: mk.replace(/_/g, " "),
            oldValue: "MISMATCH",
            newValue: "MATCH (Dikonfirmasi Manual)",
            notes: `Konfirmasi manual oleh ${confBy}`,
            actor: confBy,
            timestamp: confAt || undefined,
          });
        }
      }
    }

    // 3. Document file replacement history
    if (Array.isArray(p.updateHistory)) {
      (p.updateHistory as Array<Record<string, unknown>>).forEach((upd, idx) => {
        fallbackEvents.push({
          id: `doc-upd-${det.id ?? docCode}-${idx}`,
          category: "DOC_UPDATE",
          categoryLabel: "Pembaruan Dokumen",
          docType: docCode,
          fieldName: "Berkas PDF",
          fieldLabel: "Berkas PDF",
          oldValue: String(upd.previousFileName || "-"),
          newValue: String(upd.fileName || "-"),
          notes: `Mengunggah ulang / mengganti dokumen ${formatDocDisplayName(docCode)}`,
          actor: String(upd.updatedBy || defaultCreator),
          timestamp: upd.updatedAt ? String(upd.updatedAt) : undefined,
        });
      });
    }
  }

  // Merge: Data Actions -> Kamus -> Timestamped DB & fallback events sorted chronologically
  const timestamped = [...dbEvents, ...fallbackEvents].sort((a, b) => {
    const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return ta - tb;
  });

  return [...dataActionEvents, ...kamusEvents, ...timestamped];
}

/**
 * Matches all batch-level FieldChangeEvents that apply to a specific comparison card field.
 */
export function getChangeEventsForField(
  allEvents: FieldChangeEvent[],
  field: {
    id: string;
    fieldName: string;
    label: string;
    docCode?: string;
    pibKeys?: string[];
    supportingKeys?: string[];
  }
): FieldChangeEvent[] {
  if (!allEvents || allEvents.length === 0) return [];

  const supCode = normalizeDocCode(field.docCode);
  const pibTokens = new Set(
    [field.fieldName, field.label, ...(field.pibKeys || [])].map(normalizeFieldToken).filter(Boolean)
  );
  const supTokens = new Set(
    [field.id, field.fieldName, field.label, ...(field.supportingKeys || [])]
      .map(normalizeFieldToken)
      .filter(Boolean)
  );

  return allEvents.filter((ev) => {
    const evDoc = normalizeDocCode(ev.docType);
    const evTokens = [ev.fieldName, ev.fieldLabel]
      .map(normalizeFieldToken)
      .filter(Boolean);

    if (evDoc === "PIB") {
      return evTokens.some((t) => pibTokens.has(t));
    }
    if (evDoc === supCode) {
      return evTokens.some((t) => supTokens.has(t)) || ev.id.endsWith(`-${field.id}`);
    }
    return false;
  });
}

export interface ExtractedManualNoteRow {
  docType: string;
  targetKey: string;
  note: string;
  author: string;
  timestampRaw?: string;
}

/**
 * Extracts all operator manual notes from batch details cleanly (handles both `.text` and legacy `.note`).
 */
export function extractManualNotesFromBatch(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawBatch: { details?: any[]; createdBy?: { name?: string | null } | null }
): ExtractedManualNoteRow[] {
  const rows: ExtractedManualNoteRow[] = [];
  const defaultAuthor = rawBatch?.createdBy?.name || "Operator";

  for (const det of rawBatch?.details || []) {
    if (!det?.isi) continue;
    const p = parseRawIsiObj(det.isi);
    const notes = Array.isArray(p.manualNotes) ? (p.manualNotes as Array<Record<string, unknown>>) : [];
    for (const n of notes) {
      const noteText = String(n.text || n.note || "").trim();
      if (!noteText) continue;
      rows.push({
        docType: formatDocDisplayName(String(n.docCode || det.fileType || "Dokumen")),
        targetKey: String(n.targetKey || "Umum").replace(/_/g, " "),
        note: noteText,
        author: String(n.author || defaultAuthor),
        timestampRaw: n.updatedAt
          ? String(n.updatedAt)
          : n.createdAt
          ? String(n.createdAt)
          : undefined,
      });
    }
  }

  return rows;
}
