"use client";

import React, { useState, useRef, useEffect, useId } from "react";
import { ChevronDown, Check, Search, X } from "lucide-react";

export interface MultiSelectOption {
  label: string;
  value: string;
  description?: string;
  badge?: string;
}

export interface CustomMultiSelectProps {
  values: string[];
  onChange: (values: string[]) => void;
  options: (MultiSelectOption | string)[];
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  searchable?: boolean;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  align?: "left" | "right";
  dropUp?: boolean;
}

export default function CustomMultiSelect({
  values = [],
  onChange,
  options,
  placeholder = "Select one or more fields",
  className = "",
  buttonClassName = "",
  menuClassName = "",
  searchable,
  disabled = false,
  size = "md",
  align = "left",
  dropUp = false,
}: CustomMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const selectId = useId();

  // Normalize & deduplicate options by value
  const normalizedOptions: MultiSelectOption[] = React.useMemo(() => {
    const seen = new Set<string>();
    const res: MultiSelectOption[] = [];
    for (const raw of options) {
      const opt: MultiSelectOption =
        typeof raw === "string" ? { label: raw, value: raw } : raw;
      if (!seen.has(opt.value)) {
        seen.add(opt.value);
        res.push(opt);
      }
    }
    return res;
  }, [options]);

  const isSearchable = searchable ?? normalizedOptions.length >= 4;

  // Filtered options based on search query
  const filteredOptions = normalizedOptions.filter((opt) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      opt.label.toLowerCase().includes(q) ||
      opt.value.toLowerCase().includes(q) ||
      (opt.description && opt.description.toLowerCase().includes(q))
    );
  });

  // Handle outside click & escape key
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchQuery("");
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false);
        setSearchQuery("");
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
      document.addEventListener("keydown", handleKeyDown);
      if (isSearchable && searchInputRef.current) {
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    }

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, isSearchable]);

  const toggleOption = (val: string) => {
    if (values.includes(val)) {
      onChange(values.filter((v) => v !== val));
    } else {
      onChange([...values, val]);
    }
  };

  const removeSingleValue = (e: React.MouseEvent, val: string) => {
    e.stopPropagation();
    onChange(values.filter((v) => v !== val));
  };

  const clearAll = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    onChange([]);
  };

  const selectAll = () => {
    const allVals = normalizedOptions.map((o) => o.value);
    onChange(allVals);
  };

  // Size variations
  const sizeClasses = {
    sm: "px-2.5 py-1.5 text-xs min-h-[36px]",
    md: "px-3 py-2 text-xs min-h-[40px]",
    lg: "px-3.5 py-2.5 text-sm min-h-[44px]",
  };

  const optionSizeClasses = {
    sm: "py-1.5 px-3 text-xs",
    md: "py-2 px-3.5 text-xs",
    lg: "py-2.5 px-4 text-sm",
  };

  // Find selected options objects
  const selectedOptions = normalizedOptions.filter((opt) =>
    values.includes(opt.value)
  );

  return (
    <div
      ref={containerRef}
      className={`relative inline-block w-full text-left ${className}`}
    >
      {/* Trigger Button */}
      <button
        type="button"
        id={selectId}
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-2 bg-white border rounded-lg text-left font-medium transition-all cursor-pointer ${
          sizeClasses[size]
        } ${
          isOpen
            ? "border-blue-500 bg-white ring-2 ring-blue-500/20 shadow-xs"
            : "border-slate-300 hover:border-slate-400 bg-white"
        } ${
          disabled
            ? "opacity-50 cursor-not-allowed bg-slate-100 border-slate-200"
            : ""
        } ${buttonClassName}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex flex-wrap items-center gap-1.5 flex-1 overflow-hidden">
          {values.length === 0 ? (
            <span className="text-slate-400 font-normal">{placeholder}</span>
          ) : (
            selectedOptions.slice(0, 3).map((opt) => (
              <span
                key={opt.value}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-800 border border-slate-200 max-w-[160px] truncate"
              >
                <span className="truncate">{opt.label}</span>
                <span
                  onClick={(e) => removeSingleValue(e, opt.value)}
                  className="hover:text-rose-600 transition-colors cursor-pointer shrink-0 p-0.5"
                >
                  <X className="w-2.5 h-2.5" />
                </span>
              </span>
            ))
          )}

          {selectedOptions.length > 3 && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
              +{selectedOptions.length - 3} lainnya
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 text-slate-400">
          {values.length > 0 && !disabled && (
            <span
              onClick={clearAll}
              className="p-1 hover:text-slate-600 rounded transition-colors cursor-pointer"
              title="Clear selection"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${
              isOpen ? "rotate-180 text-blue-600" : "text-slate-400"
            }`}
          />
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={`absolute z-50 w-full min-w-[280px] bg-white border border-slate-200 rounded-lg shadow-xl py-1 transition-all animate-in fade-in-50 zoom-in-95 duration-100 ${
            dropUp ? "bottom-full mb-1" : "top-full mt-1"
          } ${align === "right" ? "right-0" : "left-0"} ${menuClassName}`}
          role="listbox"
        >
          {/* Search Box & Quick Controls */}
          {isSearchable && (
            <div className="p-2 border-b border-slate-100 bg-slate-50/50">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari field..."
                  className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-md text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>

              {/* Quick Actions Header */}
              <div className="flex items-center justify-between pt-1.5 px-0.5 text-[11px] text-slate-500">
                <button
                  type="button"
                  onClick={selectAll}
                  className="font-medium text-blue-600 hover:text-blue-800 cursor-pointer"
                >
                  Pilih Semua ({normalizedOptions.length})
                </button>
                {values.length > 0 && (
                  <button
                    type="button"
                    onClick={() => clearAll()}
                    className="text-slate-400 hover:text-rose-600 cursor-pointer"
                  >
                    Kosongkan ({values.length})
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Options List */}
          <div className="max-h-64 overflow-y-auto overflow-x-hidden p-1 space-y-0.5">
            {filteredOptions.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400 italic">
                Tidak ada field yang cocok
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = values.includes(opt.value);

                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => toggleOption(opt.value)}
                    className={`w-full flex items-center justify-between gap-3 rounded-md transition-colors cursor-pointer text-left ${
                      optionSizeClasses[size]
                    } ${
                      isSelected
                        ? "bg-blue-50/60 text-slate-900"
                        : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* Checkbox Box */}
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all ${
                          isSelected
                            ? "bg-blue-600 border-blue-600 text-white"
                            : "border-slate-300 bg-white hover:border-slate-400"
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>

                      <div className="truncate">
                        <span className="block truncate text-xs font-medium text-slate-800">
                          {opt.label}
                        </span>
                        {opt.description && opt.description !== opt.label && (
                          <span className="block text-[10px] text-slate-400 font-normal truncate mt-0.5">
                            {opt.description}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right Badge — only shown when explicitly provided */}
                    {opt.badge && (
                      <span className="shrink-0 text-[10px] px-2 py-0.5 rounded font-mono font-medium bg-slate-100 text-slate-500 border border-slate-200">
                        {opt.badge}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer count */}
          <div className="border-t border-slate-100 px-3 py-1.5 text-[10px] text-slate-400 flex items-center justify-between bg-slate-50/50">
            <span>{values.length} field dipilih</span>
            <span>Total {normalizedOptions.length} opsi</span>
          </div>
        </div>
      )}
    </div>
  );
}
