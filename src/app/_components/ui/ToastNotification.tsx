"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Info,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  X,
} from "lucide-react";

export type ToastType = "success" | "info" | "warning" | "error";

export interface ToastItem {
  id: string;
  message: string;
  type?: ToastType;
  actionLabel?: string;
  onAction?: () => void | Promise<void>;
  actionLoading?: boolean;
  /** Duration in ms before auto-dismiss. Set to 0 to keep visible until dismissed/actioned. */
  duration?: number;
  /** Show animated spinner icon instead of static status icon. */
  isLoading?: boolean;
}

export interface ToastShowOptions {
  type?: ToastType;
  duration?: number;
  actionLabel?: string;
  onAction?: () => void | Promise<void>;
  isLoading?: boolean;
}

const DEFAULT_DURATION_BY_TYPE: Record<ToastType, number> = {
  success: 3500,
  info: 3500,
  warning: 4500,
  error: 5000,
};

const VARIANT_STYLES: Record<
  ToastType,
  { border: string; iconWrap: string }
> = {
  success: {
    border: "border-emerald-200/90",
    iconWrap: "bg-emerald-50 text-emerald-600",
  },
  info: {
    border: "border-blue-200/90",
    iconWrap: "bg-blue-50 text-blue-600",
  },
  warning: {
    border: "border-amber-200/90",
    iconWrap: "bg-amber-50 text-amber-600",
  },
  error: {
    border: "border-rose-200/90",
    iconWrap: "bg-rose-50 text-rose-600",
  },
};

/**
 * Shared transient toast state with automatic timer cleanup so newer messages
 * never get dismissed prematurely by stale timers.
 */
export function useToastState() {
  const [toast, setToast] = useState<ToastItem | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idSeqRef = useRef(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const dismissToast = useCallback(() => {
    clearTimer();
    setToast(null);
  }, [clearTimer]);

  const showToast = useCallback(
    (
      message: string,
      typeOrOptions?: ToastType | ToastShowOptions,
      durationOverride?: number
    ) => {
      clearTimer();
      const opts: ToastShowOptions =
        typeof typeOrOptions === "string"
          ? { type: typeOrOptions }
          : typeOrOptions || {};
      const resolvedType: ToastType = opts.type || "success";
      const duration =
        durationOverride !== undefined
          ? durationOverride
          : opts.duration !== undefined
          ? opts.duration
          : opts.actionLabel
          ? 0
          : DEFAULT_DURATION_BY_TYPE[resolvedType];

      const id = `toast-${++idSeqRef.current}`;
      setToast({
        id,
        message,
        type: resolvedType,
        actionLabel: opts.actionLabel,
        onAction: opts.onAction,
        isLoading: opts.isLoading,
        duration,
      });

      if (duration > 0) {
        timerRef.current = setTimeout(() => {
          setToast((curr) => (curr?.id === id ? null : curr));
          timerRef.current = null;
        }, duration);
      }
    },
    [clearTimer]
  );

  useEffect(() => {
    return () => clearTimer();
  }, [clearTimer]);

  return { toast, showToast, dismissToast };
}

function ToastCard({
  item,
  onClose,
}: {
  item: ToastItem;
  onClose?: (id: string) => void;
}) {
  const [runningAction, setRunningAction] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const type: ToastType = item.type || "success";
  const styles = VARIANT_STYLES[type];
  const isActionBusy = Boolean(item.actionLoading || runningAction);

  const renderIcon = () => {
    if (item.isLoading) {
      return <RefreshCw className="w-3.5 h-3.5 animate-spin" />;
    }
    switch (type) {
      case "success":
        return <CheckCircle2 className="w-3.5 h-3.5" />;
      case "warning":
        return <AlertTriangle className="w-3.5 h-3.5" />;
      case "error":
        return <AlertCircle className="w-3.5 h-3.5" />;
      default:
        return <Info className="w-3.5 h-3.5" />;
    }
  };

  const handleActionClick = async () => {
    if (!item.onAction || isActionBusy) return;
    try {
      const maybePromise = item.onAction();
      if (maybePromise && typeof (maybePromise as Promise<void>).then === "function") {
        setRunningAction(true);
        await maybePromise;
      }
    } finally {
      if (isMountedRef.current) {
        setRunningAction(false);
      }
    }
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-auto w-full sm:w-auto min-w-[230px] max-w-sm bg-white/95 backdrop-blur-xs rounded-xl border ${styles.border} shadow-[0_8px_24px_-6px_rgba(15,23,42,0.12)] px-3 py-2 flex items-center gap-2.5 animate-in fade-in slide-in-from-top-2 duration-200`}
    >
      <span
        className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${styles.iconWrap}`}
      >
        {renderIcon()}
      </span>

      <span className="flex-1 text-xs font-medium text-slate-700 leading-snug">
        {item.message}
      </span>

      {item.actionLabel && item.onAction && (
        <button
          type="button"
          onClick={handleActionClick}
          disabled={isActionBusy}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-2xs transition-colors cursor-pointer shrink-0 disabled:opacity-60"
        >
          <RefreshCw
            className={`w-3 h-3 ${isActionBusy ? "animate-spin" : ""}`}
          />
          <span>{item.actionLabel}</span>
        </button>
      )}

      {onClose && (
        <button
          type="button"
          onClick={() => onClose(item.id)}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
          aria-label="Tutup notifikasi"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

export interface ToastNotificationProps {
  toast?: ToastItem | null;
  items?: Array<ToastItem | null | undefined>;
  onClose?: (id: string) => void;
}

export default function ToastNotification({
  toast,
  items,
  onClose,
}: ToastNotificationProps) {
  const list: ToastItem[] = [];
  if (Array.isArray(items)) {
    for (const item of items) {
      if (item) list.push(item);
    }
  }
  if (toast) {
    list.push(toast);
  }

  if (list.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[90] flex flex-col items-end gap-2 max-w-[calc(100vw-2rem)] sm:max-w-sm pointer-events-none">
      {list.map((item) => (
        <ToastCard key={item.id} item={item} onClose={onClose} />
      ))}
    </div>
  );
}
