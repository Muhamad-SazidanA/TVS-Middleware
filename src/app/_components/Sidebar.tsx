"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Inline SVG Icons (scaled down ~1.5x for a compact, clean look)
const UploadCloudIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
  </svg>
);

const LayersIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
  </svg>
);

const ChevronDownIcon = ({ className = "w-3 h-3" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const ChevronRightIcon = ({ className = "w-3 h-3" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

const FileCheckIcon = ({ className = "w-3 h-3" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const FileXIcon = ({ className = "w-3 h-3" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const FileTextIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const SettingsIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const LogOutIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
);

export default function Sidebar() {
  const pathname = usePathname();
  const isUploadActive = pathname === "/upload" || pathname === "/";
  const isMatchedActive = pathname === "/Matched" || pathname === "/matched";
  const isMismatchedActive = pathname === "/Mismatched" || pathname === "/mismatched";

  // Automatically close Matching Engine dropdown when active route is Upload Dokumen
  const [isMatchingOpen, setIsMatchingOpen] = useState(isMatchedActive || isMismatchedActive);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  return (
    <aside className="w-48 bg-white text-slate-700 flex flex-col h-screen border-r border-slate-200 shrink-0 select-none shadow-xs sticky top-0">
      {/* Brand Header */}
      <div className="px-4 py-3.5 border-b border-slate-100 flex items-center">
        <h1 className="font-bold text-sm tracking-wide text-blue-950">TVS Middleware</h1>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-2.5 py-3 space-y-1 overflow-y-auto">
        <div className="px-2 pb-1 text-[9px] font-bold text-blue-950/50 uppercase tracking-wider">
          Main Menu
        </div>

        {/* 1. Upload Link */}
        <Link
          href="/upload"
          onClick={() => setIsMatchingOpen(false)}
          className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 focus:outline-none ${
            isUploadActive
              ? "text-blue-950 font-bold"
              : "text-slate-600 hover:text-blue-950"
          }`}
        >
          <UploadCloudIcon className={`w-3.5 h-3.5 ${isUploadActive ? "text-blue-950" : "text-slate-400"}`} />
          <span className={isUploadActive ? "text-blue-950 font-bold" : ""}>Upload Dokumen</span>
        </Link>

        {/* 2. Parent Menu (Collapsible Dropdown) */}
        <div className="pt-1">
          <button
            onClick={() => setIsMatchingOpen(!isMatchingOpen)}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-blue-950 transition-all duration-150 focus:outline-none"
          >
            <div className="flex items-center gap-2">
              <LayersIcon className="w-3.5 h-3.5 text-blue-950" />
              <span>Matching Engine</span>
            </div>
            {isMatchingOpen ? (
              <ChevronDownIcon className="w-3 h-3 text-slate-400 transition-transform duration-200" />
            ) : (
              <ChevronRightIcon className="w-3 h-3 text-slate-400 transition-transform duration-200" />
            )}
          </button>

          {/* Sub-menu Dropdown Links */}
          {isMatchingOpen && (
            <div className="mt-0.5 ml-3 pl-2 space-y-0.5">
              {/* Sub-item 1: Matched */}
              <Link
                href="/Matched"
                className={`w-full flex items-center justify-between px-2.5 py-1 rounded-md text-[11px] font-bold transition-all duration-150 focus:outline-none ${
                  isMatchedActive
                    ? "text-blue-950 font-bold"
                    : "text-slate-500 hover:text-blue-950"
                }`}
              >
                <div className="flex items-center gap-2">
                  <FileCheckIcon className={`w-3 h-3 ${isMatchedActive ? "text-blue-950" : "text-emerald-600"}`} />
                  <span className={isMatchedActive ? "text-blue-950 font-bold" : ""}>Matched</span>
                </div>
                <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold ${
                  isMatchedActive ? "bg-blue-950 text-white" : "bg-emerald-100 text-emerald-800"
                }`}>
                  12
                </span>
              </Link>

              {/* Sub-item 2: Mismatched */}
              <Link
                href="/Mismatched"
                className={`w-full flex items-center justify-between px-2.5 py-1 rounded-md text-[11px] font-bold transition-all duration-150 focus:outline-none ${
                  isMismatchedActive
                    ? "text-blue-950 font-bold"
                    : "text-slate-500 hover:text-blue-950"
                }`}
              >
                <div className="flex items-center gap-2">
                  <FileXIcon className={`w-3 h-3 ${isMismatchedActive ? "text-blue-950" : "text-rose-600"}`} />
                  <span className={isMismatchedActive ? "text-blue-950 font-bold" : ""}>Mismatched</span>
                </div>
                <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold ${
                  isMismatchedActive ? "bg-blue-950 text-white" : "bg-rose-100 text-rose-800"
                }`}>
                  3
                </span>
              </Link>
            </div>
          )}
        </div>

        {/* Additional Navigation Sections */}
        <div className="pt-3 px-2 pb-1 text-[9px] font-bold text-blue-950/50 uppercase tracking-wider">
          Reports & History
        </div>

        <Link
          href="/Matched"
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-blue-950 transition-all duration-150 focus:outline-none"
        >
          <FileTextIcon className="w-3.5 h-3.5 text-slate-400" />
          <span>Semua Dokumen</span>
        </Link>
      </nav>

      {/* Compact Minimal Footer */}
      <div className="px-3.5 py-3 border-t border-slate-100 relative">
        <div className="flex items-center justify-between select-none">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-blue-950 flex items-center justify-center font-bold text-[9px] text-white shadow-xs">
              TV
            </div>
            <div>
              <p className="text-[11px] font-bold text-blue-950 leading-tight">TVS Import Team</p>
              <p className="text-[9px] text-slate-500 font-medium leading-tight">Admin Mode</p>
            </div>
          </div>

          <div className="relative">
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="text-slate-400 hover:text-blue-950 hover:bg-slate-100 transition-all focus:outline-none p-1 rounded-md"
            >
              <SettingsIcon className="w-3.5 h-3.5" />
            </button>

            {/* Compact Side Floating Popover Menu */}
            {isUserMenuOpen && (
              <div className="absolute left-full ml-4 bottom-0 w-28 bg-white border border-slate-200 rounded-lg shadow-xl p-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                <button
                  onClick={() => {
                    if (typeof window !== "undefined") {
                      window.location.href = "/login";
                    }
                  }}
                  className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded text-[11px] font-bold text-rose-600 hover:bg-rose-50 transition-all text-left focus:outline-none"
                >
                  <LogOutIcon className="w-3.5 h-3.5 text-rose-500" />
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
