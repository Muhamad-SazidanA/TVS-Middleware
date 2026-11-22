"use client";

import React, { useState, useRef, useEffect, useId } from "react";
import { ChevronDown, Check, Search, X } from "lucide-react";

export interface SelectOption {
  label: string;
  value: string | number;
  description?: string;
  icon?: React.ReactNode;
  badge?: string;
}

export interface CustomSelectProps {
  value: string | number;
  onChange: (value: string) => void;
  options: (SelectOption | string)[];
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

export default function CustomSelect({
  value,
  onChange,
  options,
  placeholder = "Pilih opsi...",
  className = "",
  buttonClassName = "",
  menuClassName = "",
  searchable,
  disabled = false,
  size = "md",
  align = "left",
  dropUp = false,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const selectId = useId();

  // Normalize options to SelectOption objects
  const normalizedOptions: SelectOption[] = options.map((opt) => {
    if (typeof opt === "string" || typeof opt === "number") {
      return { label: String(opt), value: String(opt) };
    }
    return opt;
  });

  // Determine whether to show search input (auto-enable if >= 7 options unless explicitly disabled)
  const isSearchable = searchable ?? normalizedOptions.length >= 7;

  // Selected option lookup
  const selectedOption = normalizedOptions.find(
    (opt) => String(opt.value) === String(value)
  );

  // Filtered options based on search query
  const filteredOptions = normalizedOptions.filter((opt) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      opt.label.toLowerCase().includes(q) ||
      String(opt.value).toLowerCase().includes(q) ||
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
      // Auto focus search input when opened
      if (isSearchable && searchInputRef.current) {
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    }

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, isSearchable]);

  const sizeStyles = {
    sm: "h-7 px-2 text-[11px]",
    md: "h-8 px-2.5 text-xs",
    lg: "h-9 px-3 text-xs sm:text-sm",
  };

  return (
    <div
      ref={containerRef}
      className={`relative inline-block w-full ${className}`}
      id={`select-${selectId}`}
    >
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setIsOpen(!isOpen);
            if (!isOpen) setSearchQuery("");
          }
        }}
        className={`w-full flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/80 hover:bg-slate-100/70 hover:border-slate-300 text-slate-800 font-medium transition-all text-left focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-2xs ${
          sizeStyles[size]
        } ${isOpen ? "ring-2 ring-slate-900/10 border-slate-400 bg-white" : ""} ${buttonClassName}`}
      >
        <span className="truncate flex items-center gap-2">
          {selectedOption?.icon && (
            <span className="shrink-0 text-slate-500">{selectedOption.icon}</span>
          )}
          <span className={selectedOption ? "text-slate-800" : "text-slate-400"}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption?.badge && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
              {selectedOption.badge}
            </span>
          )}
        </span>

        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-slate-700" : ""
          }`}
        />
      </button>

      {/* Floating Menu Popover */}
      {isOpen && (
        <div
          className={`absolute ${
            align === "right" ? "right-0" : "left-0"
          } ${
            dropUp ? "bottom-full mb-1.5" : "top-full mt-1.5"
          } min-w-[200px] w-full max-w-sm sm:max-w-md bg-white border border-slate-200/90 rounded-2xl shadow-xl z-50 p-1.5 animate-in fade-in zoom-in-95 duration-100 ${menuClassName}`}
          style={{ minWidth: "100%" }}
        >
          {/* Search Box */}
          {isSearchable && (
            <div className="p-1 pb-1.5 mb-1 border-b border-slate-100">
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari opsi..."
                  className="w-full h-7 pl-7 pr-6 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-400 transition-colors"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-1.5 text-slate-400 hover:text-slate-600 p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Options List */}
          <div className="max-h-60 overflow-y-auto space-y-0.5 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent pr-0.5">
            {filteredOptions.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-400 italic">
                Tidak ada opsi yang cocok.
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = String(opt.value) === String(value);
                return (
                  <button
                    key={String(opt.value)}
                    type="button"
                    onClick={() => {
                      onChange(String(opt.value));
                      setIsOpen(false);
                      setSearchQuery("");
                    }}
                    className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors text-left cursor-pointer ${
                      isSelected
                        ? "bg-slate-900 text-white font-medium shadow-2xs"
                        : "text-slate-700 hover:bg-slate-100/80 hover:text-slate-900"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {opt.icon && (
                        <span
                          className={`shrink-0 ${
                            isSelected ? "text-white" : "text-slate-400"
                          }`}
                        >
                          {opt.icon}
                        </span>
                      )}
                      <div className="truncate">
                        <div className="truncate">{opt.label}</div>
                        {opt.description && (
                          <div
                            className={`text-[10px] truncate ${
                              isSelected ? "text-slate-300" : "text-slate-400"
                            }`}
                          >
                            {opt.description}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {opt.badge && (
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9.5px] font-semibold ${
                            isSelected
                              ? "bg-white/20 text-white"
                              : "bg-slate-100 text-slate-600 border border-slate-200"
                          }`}
                        >
                          {opt.badge}
                        </span>
                      )}
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-white shrink-0" />
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
