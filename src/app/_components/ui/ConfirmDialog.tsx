"use client";

import React, { useEffect } from "react";
import { AlertTriangle, Trash2, HelpCircle, Info, X } from "lucide-react";

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  title: string;
  description: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "info" | "success";
  isLoading?: boolean;
  isAlert?: boolean;
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText,
  cancelText = "Batal",
  variant = "danger",
  isLoading = false,
  isAlert = false,
}: ConfirmDialogProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isLoading) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  const variantConfig = {
    danger: {
      icon: <Trash2 className="w-5 h-5 text-rose-600" />,
      iconBg: "bg-rose-50 border-rose-100",
      buttonBg: "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-200/50",
      defaultConfirmText: "Hapus",
    },
    warning: {
      icon: <AlertTriangle className="w-5 h-5 text-amber-600" />,
      iconBg: "bg-amber-50 border-amber-100",
      buttonBg: "bg-amber-600 hover:bg-amber-700 text-white shadow-amber-200/50",
      defaultConfirmText: "Lanjutkan",
    },
    info: {
      icon: <HelpCircle className="w-5 h-5 text-indigo-600" />,
      iconBg: "bg-indigo-50 border-indigo-100",
      buttonBg: "bg-slate-900 hover:bg-slate-800 text-white shadow-slate-200/50",
      defaultConfirmText: "Konfirmasi",
    },
    success: {
      icon: <Info className="w-5 h-5 text-emerald-600" />,
      iconBg: "bg-emerald-50 border-emerald-100",
      buttonBg: "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200/50",
      defaultConfirmText: "Mengerti",
    },
  };

  const currentVariant = variantConfig[variant];
  const finalConfirmText = confirmText || (isAlert ? "Mengerti" : currentVariant.defaultConfirmText);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={() => {
          if (!isLoading) onClose();
        }}
      />

      {/* Modal Dialog Card */}
      <div className="relative w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 overflow-hidden animate-in fade-in zoom-in-95 duration-150 z-10">
        <button
          type="button"
          onClick={() => {
            if (!isLoading) onClose();
          }}
          className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          disabled={isLoading}
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-4">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${currentVariant.iconBg}`}
          >
            {currentVariant.icon}
          </div>

          <div className="flex-1 min-w-0 pr-4">
            <h3 className="text-sm sm:text-base font-semibold text-slate-900 leading-snug">
              {title}
            </h3>
            <div className="mt-1.5 text-xs text-slate-600 leading-relaxed">
              {description}
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
          {!isAlert && (
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            >
              {cancelText}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (onConfirm) onConfirm();
              else onClose();
            }}
            disabled={isLoading}
            className={`px-4 py-2 text-xs font-semibold rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2 ${currentVariant.buttonBg}`}
          >
            {isLoading ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Memproses...</span>
              </>
            ) : (
              finalConfirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
