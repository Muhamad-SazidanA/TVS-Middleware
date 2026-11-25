"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  Layers,
  CloudUpload,
  Database,
  Settings,
  ChevronsUpDown,
  LogOut,
  type LucideIcon,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  matchPrefixes: string[];
}

const PRIMARY_NAV_ITEMS: NavItem[] = [
  {
    href: "/matching",
    label: "Matching Workspace",
    icon: Layers,
    matchPrefixes: ["/matching", "/Matching"],
  },
  {
    href: "/upload",
    label: "Upload dokumen",
    icon: CloudUpload,
    matchPrefixes: ["/upload"],
  },
  {
    href: "/all-data",
    label: "All Data (Approved)",
    icon: Database,
    matchPrefixes: ["/all-data"],
  },
];

const SETTINGS_NAV_ITEMS: NavItem[] = [
  {
    href: "/manage-system",
    label: "Manage System",
    icon: Settings,
    matchPrefixes: ["/manage-system"],
  },
];

function isPathActive(pathname: string | null, prefixes: string[]): boolean {
  if (!pathname) return false;
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`) || pathname.startsWith(prefix));
}

function NavLinkItem({ item, pathname }: { item: NavItem; pathname: string | null }) {
  const Icon = item.icon;
  const active = isPathActive(pathname, item.matchPrefixes);

  return (
    <Link
      href={item.href}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[14px] leading-snug transition-colors duration-150 focus:outline-none ${
        active
          ? "bg-[#E2ECFE] text-[#1D4ED8] font-medium"
          : "text-slate-800 hover:bg-slate-100/80 font-normal"
      }`}
    >
      <Icon
        className={`w-[18px] h-[18px] shrink-0 stroke-[1.75] ${
          active ? "text-[#1D4ED8]" : "text-slate-700"
        }`}
      />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const footerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (footerRef.current && !footerRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  // Hide sidebar on login route
  if (pathname === "/login" || pathname?.startsWith("/login")) {
    return null;
  }

  const userName = session?.user?.name || "DocMatch User";
  const userEmail = session?.user?.email || "";
  const userRole = (session?.user as { role?: string })?.role || "STAFF";
  const userInitial = (userName.trim()[0] || userEmail.trim()[0] || "U").toUpperCase();

  return (
    <aside className="w-60 bg-white text-slate-800 flex flex-col h-screen border-r border-slate-200/80 shrink-0 select-none sticky top-0">
      {/* Clean Wordmark Header */}
      <div className="px-5 pt-6 pb-5">
        <span className="text-[17px] font-bold tracking-[0.06em] text-slate-900">
          DOCMATCH
        </span>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-3 py-1 space-y-1 overflow-y-auto">
        {PRIMARY_NAV_ITEMS.map((item) => (
          <NavLinkItem key={item.href} item={item} pathname={pathname} />
        ))}

        <div className="pt-5 pb-1.5 px-3 text-[13px] font-medium text-slate-500">
          Pengaturan
        </div>

        {SETTINGS_NAV_ITEMS.map((item) => (
          <NavLinkItem key={item.href} item={item} pathname={pathname} />
        ))}
      </nav>

      {/* Clean Profile Switcher / Session Footer */}
      <div ref={footerRef} className="p-3 relative bg-white">
        {menuOpen && (
          <div className="absolute bottom-full left-3 right-3 mb-2 bg-white rounded-xl border border-slate-200 shadow-lg p-1.5 z-50">
            <div className="flex items-center justify-between px-2.5 py-2 border-b border-slate-100 mb-1">
              <span className="text-[11px] font-medium text-slate-500">Role</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider bg-slate-100 text-slate-700">
                {userRole}
              </span>
            </div>

            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span>Keluar</span>
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-expanded={menuOpen}
          className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-slate-100/80 transition-colors cursor-pointer text-left focus:outline-none"
        >
          <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200/90 flex items-center justify-center text-[13px] font-medium text-slate-600 shrink-0">
            {userInitial}
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-medium text-slate-900 truncate leading-tight" title={userName}>
              {userName}
            </div>
            <div className="text-[12.5px] text-slate-500 truncate leading-tight mt-0.5" title={userEmail}>
              {userEmail || "Terautentikasi"}
            </div>
          </div>

          <ChevronsUpDown className="w-4 h-4 text-slate-500 shrink-0" />
        </button>
      </div>
    </aside>
  );
}
