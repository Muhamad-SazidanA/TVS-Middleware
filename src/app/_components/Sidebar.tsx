"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Database, LogOut, User as UserIcon } from "lucide-react";

// Inline SVG Icons
const DashboardIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);

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

const SettingsIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  // Hide sidebar on login route
  if (pathname === "/login" || pathname?.startsWith("/login")) {
    return null;
  }

  const isDashboardActive = pathname === "/";
  const isUploadActive = pathname === "/upload" || pathname?.startsWith("/upload");
  const isMatchingActive = pathname === "/matching" || pathname?.startsWith("/matching") || pathname === "/Matching";
  const isAllDataActive = pathname === "/all-data" || pathname?.startsWith("/all-data");
  const isManageActive = pathname === "/manage-system" || pathname?.startsWith("/manage-system");

  const userName = session?.user?.name || "DocMatch User";
  const userEmail = session?.user?.email || "";
  const userRole = (session?.user as { role?: string })?.role || "STAFF";

  return (
    <aside className="w-56 bg-white text-slate-700 flex flex-col h-screen border-r border-slate-200 shrink-0 select-none shadow-xs sticky top-0">
      {/* Brand Header */}
      <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h1 className="font-bold text-sm tracking-wide text-blue-950">Docmatch</h1>
          <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">PT. USC INDONESIA</p>
        </div>
        <span className="w-2 h-2 rounded-full bg-emerald-500" title="System Online"></span>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-2.5 py-3 space-y-1 overflow-y-auto">
        <div className="px-2 pb-1 text-[9px] font-bold text-blue-950/50 uppercase tracking-wider">
          Main Menu
        </div>

        {/* 1. Dashboard Link */}
        <Link
          href="/"
          className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 focus:outline-none ${
            isDashboardActive
              ? "text-blue-950 font-bold bg-blue-50/80"
              : "text-slate-600 hover:text-blue-950 hover:bg-slate-50"
          }`}
        >
          <DashboardIcon className={`w-3.5 h-3.5 ${isDashboardActive ? "text-blue-950" : "text-slate-400"}`} />
          <span className={isDashboardActive ? "text-blue-950 font-bold" : ""}>Dashboard</span>
        </Link>

        {/* 2. Upload Link */}
        <Link
          href="/upload"
          className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 focus:outline-none ${
            isUploadActive
              ? "text-blue-950 font-bold bg-blue-50/80"
              : "text-slate-600 hover:text-blue-950 hover:bg-slate-50"
          }`}
        >
          <UploadCloudIcon className={`w-3.5 h-3.5 ${isUploadActive ? "text-blue-950" : "text-slate-400"}`} />
          <span className={isUploadActive ? "text-blue-950 font-bold" : ""}>Upload dokumen</span>
        </Link>

        {/* 3. Matching Workspace Link (Personal data for Staff) */}
        <Link
          href="/matching"
          className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 focus:outline-none ${
            isMatchingActive
              ? "text-blue-950 font-bold bg-blue-50/80"
              : "text-slate-600 hover:text-blue-950 hover:bg-slate-50"
          }`}
        >
          <LayersIcon className={`w-3.5 h-3.5 ${isMatchingActive ? "text-blue-950" : "text-slate-400"}`} />
          <span className={isMatchingActive ? "text-blue-950 font-bold" : ""}>Matching Workspace</span>
        </Link>

        {/* 4. All Data Room Link (Approved Only) */}
        <Link
          href="/all-data"
          className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 focus:outline-none ${
            isAllDataActive
              ? "text-blue-950 font-bold bg-blue-50/80"
              : "text-slate-600 hover:text-blue-950 hover:bg-slate-50"
          }`}
        >
          <Database className={`w-3.5 h-3.5 ${isAllDataActive ? "text-blue-950" : "text-slate-400"}`} />
          <span className={isAllDataActive ? "text-blue-950 font-bold" : ""}>All Data (Approved)</span>
        </Link>

        <div className="pt-4 px-2 pb-1 text-[9px] font-bold text-blue-950/50 uppercase tracking-wider">
          Pengaturan
        </div>

        {/* 5. Manage System Link */}
        <Link
          href="/manage-system"
          className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 focus:outline-none ${
            isManageActive
              ? "text-blue-950 font-bold bg-blue-50/80"
              : "text-slate-600 hover:text-blue-950 hover:bg-slate-50"
          }`}
        >
          <SettingsIcon className={`w-3.5 h-3.5 ${isManageActive ? "text-blue-950" : "text-slate-400"}`} />
          <span className={isManageActive ? "text-blue-950 font-bold" : ""}>Manage System</span>
        </Link>
      </nav>

      {/* User Session & Logout Panel */}
      <div className="p-2 border-t border-slate-200 bg-white">
        <div className="p-2 rounded-lg border border-slate-200/80 space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
              <UserIcon className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-bold text-slate-800 truncate" title={userName}>
                {userName}
              </div>
              <div className="text-[9.5px] text-slate-400 truncate font-mono" title={userEmail}>
                {userEmail || "Terautentikasi"}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-slate-100">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200/60">
              {userRole}
            </span>

            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 px-1.5 py-0.5 rounded transition-colors cursor-pointer"
              title="Keluar dari sesi ini"
            >
              <LogOut className="w-3 h-3" />
              <span>Keluar</span>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
