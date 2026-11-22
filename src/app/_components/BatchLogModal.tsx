"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Sparkles, Zap, Check } from "lucide-react";

// Icons
const XIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const RefreshCwIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
    />
  </svg>
);

const CheckCircleIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const AlertTriangleIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
    />
  </svg>
);

const InfoIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ChevronDownIcon = ({ className = "w-3 h-3" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const ChevronUpIcon = ({ className = "w-3 h-3" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
  </svg>
);

export interface BatchLogItem {
  id: number;
  batchId: string;
  step: string;
  stepNumber: number;
  level: "INFO" | "SUCCESS" | "WARNING" | "ERROR";
  title: string;
  message: string;
  fileType?: string | null;
  fileName?: string | null;
  details?: string | null;
  createdAt: string;
}

interface BatchLogModalProps {
  batchId: string | null;
  batchTitle?: string;
  batchStatus?: string;
  isOpen: boolean;
  onClose: () => void;
}

const PIPELINE_STEPS = [
  { num: 1, name: "Upload batch", code: "UPLOAD_INIT" },
  { num: 2, name: "Kirim OCR", code: "OCR_DISPATCH" },
  { num: 3, name: "Webhook OCR", code: "OCR_WEBHOOK" },
  { num: 4, name: "Ekstraksi data", code: "DATA_EXTRACTED" },
  { num: 5, name: "Cross-check matching", code: "MATCHING_EVAL" },
  { num: 6, name: "Data sempurna", code: "COMPLETED" },
];

export default function BatchLogModal({
  batchId,
  batchTitle,
  batchStatus,
  isOpen,
  onClose,
}: BatchLogModalProps) {
  const [logs, setLogs] = useState<BatchLogItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchLogs = useCallback(async () => {
    if (!batchId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/batches/${batchId}/logs`);
      const data = await res.json();
      if (res.ok && data.logs) {
        setLogs(data.logs);
      }
    } catch (err) {
      console.warn("Failed to fetch logs:", err);
    } finally {
      setIsLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    if (isOpen && batchId) {
      fetchLogs();
    }
  }, [isOpen, batchId, fetchLogs]);

  // Polling logs every 3 seconds if autoRefresh is enabled
  useEffect(() => {
    if (!isOpen || !batchId || !autoRefresh) return;
    const interval = setInterval(() => {
      fetchLogs();
    }, 3000);
    return () => clearInterval(interval);
  }, [isOpen, batchId, autoRefresh, fetchLogs]);

  if (!isOpen || !batchId) return null;

  const maxCompletedStep = logs.reduce((max, log) => Math.max(max, log.stepNumber || 1), 1);
  const isFinished = logs.some((l) => l.step === "COMPLETED") || batchStatus === "Matching" || batchStatus === "Mismatching";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header Modal */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-950 text-white font-bold text-xs flex items-center justify-center shadow-xs">
              #{batchId}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-blue-950">
                  Log audit pipeline {batchTitle ? `- ${batchTitle}` : ""}
                </h3>
                {isFinished ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-emerald-600" />
                    <span>Data sempurna ({batchStatus || "selesai"})</span>
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 animate-pulse inline-flex items-center gap-1">
                    <Zap className="w-3 h-3 text-amber-600" />
                    <span>Dalam proses ({batchStatus || "proses"})</span>
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500">
                Audit trail lengkap dari unggah file hingga restrukturisasi data sempurna.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchLogs()}
              disabled={isLoading}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-blue-950 hover:bg-white transition-all focus:outline-none flex items-center gap-1 text-[11px] font-semibold"
              title="Segarkan log"
            >
              <RefreshCwIcon className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-blue-950" : ""}`} />
              <span className="hidden sm:inline">Segarkan</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all focus:outline-none"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Step-by-Step Progress Pipeline Bar */}
        <div className="px-5 py-3 bg-slate-900 text-white border-b border-slate-800">
          <div className="grid grid-cols-6 gap-1 text-center">
            {PIPELINE_STEPS.map((step) => {
              const isDone = maxCompletedStep >= step.num || isFinished;
              const isCurrent = maxCompletedStep === step.num && !isFinished;

              return (
                <div key={step.num} className="flex flex-col items-center gap-1">
                  <div
                    className={`w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center transition-all ${
                      isDone
                        ? "bg-emerald-500 text-white shadow-xs"
                        : isCurrent
                        ? "bg-blue-500 text-white animate-bounce shadow-xs"
                        : "bg-slate-800 text-slate-500 border border-slate-700"
                    }`}
                  >
                    {isDone ? <Check className="w-3 h-3 text-white" /> : step.num}
                  </div>
                  <span
                    className={`text-[9.5px] leading-tight font-semibold truncate max-w-full ${
                      isDone ? "text-emerald-400" : isCurrent ? "text-blue-400 font-bold" : "text-slate-500"
                    }`}
                  >
                    {step.name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Timeline Log Body */}
        <div className="flex-1 p-5 overflow-y-auto space-y-3 bg-slate-50/30">
          {logs.length === 0 ? (
            <div className="text-center py-10 space-y-2">
              <RefreshCwIcon className="w-6 h-6 text-slate-300 animate-spin mx-auto" />
              <p className="text-xs text-slate-500 font-medium">Memuat log aktivitas batch #{batchId}...</p>
            </div>
          ) : (
            <div className="relative border-l-2 border-slate-200 ml-3 pl-5 space-y-4">
              {logs.map((log) => {
                const isExpanded = expandedLogId === log.id;
                const timeFormatted = log.createdAt
                  ? new Date(log.createdAt).toLocaleTimeString("id-ID", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })
                  : "";

                let levelBadgeClass = "bg-blue-50 text-blue-900 border-blue-200";
                let icon = <InfoIcon className="w-3.5 h-3.5 text-blue-600 shrink-0" />;

                if (log.level === "SUCCESS") {
                  levelBadgeClass = "bg-emerald-50 text-emerald-900 border-emerald-200";
                  icon = <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-600 shrink-0" />;
                } else if (log.level === "WARNING") {
                  levelBadgeClass = "bg-amber-50 text-amber-900 border-amber-200";
                  icon = <AlertTriangleIcon className="w-3.5 h-3.5 text-amber-600 shrink-0" />;
                } else if (log.level === "ERROR") {
                  levelBadgeClass = "bg-rose-50 text-rose-900 border-rose-200";
                  icon = <AlertTriangleIcon className="w-3.5 h-3.5 text-rose-600 shrink-0" />;
                }

                return (
                  <div key={log.id} className="relative group">
                    {/* Timeline Node Icon */}
                    <div className="absolute -left-[29px] top-1 w-4 h-4 rounded-full bg-white border-2 border-blue-950 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-950" />
                    </div>

                    {/* Log Card */}
                    <div className="bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-2xs hover:border-blue-300 transition-all space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {icon}
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border shrink-0 ${levelBadgeClass}`}>
                            Tahap {log.stepNumber || 1}: {log.step}
                          </span>
                          <h4 className="text-xs font-bold text-blue-950 truncate min-w-0">{log.title}</h4>
                        </div>
                        <span className="text-[10px] font-medium text-slate-400 shrink-0">{timeFormatted}</span>
                      </div>

                      <p className="text-xs text-slate-700 leading-relaxed font-medium">{log.message}</p>

                      {/* File Info Badges */}
                      {(log.fileType || log.fileName) && (
                        <div className="flex items-center gap-2 text-[10px]">
                          {log.fileType && (
                            <span className="font-bold text-blue-950 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                              Doc: {log.fileType}
                            </span>
                          )}
                          {log.fileName && (
                            <span className="font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md truncate max-w-[250px]">
                              File: {log.fileName}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Expandable JSON Details */}
                      {log.details && (
                        <div>
                          <button
                            onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                            className="text-[10px] font-bold text-blue-900 hover:text-blue-950 flex items-center gap-1 focus:outline-none pt-1"
                          >
                            <span>{isExpanded ? "Sembunyikan detail JSON" : "Lihat detail data JSON"}</span>
                            {isExpanded ? <ChevronUpIcon className="w-3 h-3" /> : <ChevronDownIcon className="w-3 h-3" />}
                          </button>

                          {isExpanded && (
                            <pre className="mt-2 p-2.5 bg-slate-900 text-slate-200 rounded-lg text-[10px] font-mono overflow-x-auto max-h-48 border border-slate-800">
                              {(() => {
                                try {
                                  return JSON.stringify(JSON.parse(log.details), null, 2);
                                } catch {
                                  return log.details;
                                }
                              })()}
                            </pre>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-slate-300 text-blue-950 focus:ring-blue-900 w-3.5 h-3.5"
              />
              <span>Segarkan otomatis (3 detik)</span>
            </label>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-blue-950 hover:bg-blue-900 text-white font-semibold text-xs shadow-2xs transition-all focus:outline-none"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
