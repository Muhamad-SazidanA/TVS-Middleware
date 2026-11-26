"use client";

import React, { useState, useEffect, useCallback } from "react";
import ToastNotification, {
  useToastState,
} from "@/app/_components/ui/ToastNotification";
import WorkflowBuilder from "./_components/WorkflowBuilder";
import EquivalencyManager from "./_components/EquivalencyManager";
import AuditLogViewer from "./_components/AuditLogViewer";

interface ModelConfig {
  name: string;
  key: string;
  modelId: string;
  status: "Active" | "Testing" | "Inactive";
}

export default function ManageSystemPage() {
  const [activeTab, setActiveTab] = useState<"workflow" | "equivalency" | "audit" | "models">("workflow");
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const { toast, showToast, dismissToast } = useToastState();

  // Load configuration from backend API
  const fetchSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/system-settings");
      const json = await res.json();
      if (json.success && json.settings) {
        setApiKey(json.settings.apiKey || "");
        setModels(json.settings.models || []);
      }
    } catch (err) {
      console.warn("Gagal memuat pengaturan sistem:", err);
      showToast("Gagal memuat pengaturan sistem dari server.", "error");
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSaveSettings = async () => {
    try {
      setIsSaving(true);
      const res = await fetch("/api/system-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey,
          models,
        }),
      });

      const json = await res.json();
      if (json.success) {
        showToast("Konfigurasi sistem berhasil disimpan ke server.", "success");
      } else {
        showToast(`Gagal menyimpan: ${json.error || "Terjadi kesalahan"}`, "error");
      }
    } catch (err) {
      showToast(
        `Gagal menyimpan: ${err instanceof Error ? err.message : "Kesalahan koneksi"}`,
        "error"
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      setTestingConnection(true);
      const res = await fetch("/api/system-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test-connection",
          apiKey,
        }),
      });

      const json = await res.json();
      if (json.success) {
        showToast(json.message || "Berhasil terhubung ke Nanonets API.", "success");
      } else {
        showToast(json.message || "Gagal terhubung ke Nanonets API.", "error");
      }
    } catch (err) {
      showToast(
        `Error saat menguji koneksi: ${err instanceof Error ? err.message : "Network error"}`,
        "error"
      );
    } finally {
      setTestingConnection(false);
    }
  };

  const tabs: { id: "workflow" | "equivalency" | "audit" | "models"; label: string }[] = [
    { id: "workflow", label: "Data Actions" },
    { id: "equivalency", label: "Kamus Ekuivalensi" },
    { id: "audit", label: "Riwayat & Audit Log" },
    { id: "models", label: "Model OCR & API" },
  ];

  return (
    <div className="flex-1 min-h-0 h-full flex flex-col overflow-hidden w-full p-4 sm:p-5 gap-3.5">
      <ToastNotification toast={toast} onClose={dismissToast} />

      {/* Card 1 (Fixed): Header + Clean Single-Row Tab Bar */}
      <div className="shrink-0 bg-white rounded-xl border border-slate-200/90 px-5 pt-4 shadow-2xs w-full">
        <div className="pb-3">
          <h1 className="text-base font-bold text-slate-900">Manage System</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Konfigurasi integrasi OCR, aturan matching, dan model data DocMatch
          </p>
        </div>

        <div className="flex items-center gap-1 border-t border-slate-100 overflow-x-auto overflow-y-hidden no-scrollbar">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-2.5 text-xs font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  isActive
                    ? "border-blue-600 text-blue-700 font-semibold"
                    : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Full-Width Tab Content Area (Card 2 stays fixed, bottom content scrolls) */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden w-full">
        {activeTab === "workflow" && <WorkflowBuilder />}

        {activeTab === "equivalency" && <EquivalencyManager />}

        {activeTab === "audit" && <AuditLogViewer />}

        {activeTab === "models" && (
          <div className="flex-1 min-h-0 flex flex-col gap-3.5 w-full">
            {/* Card 2 (Fixed): API Key Config */}
            <div className="shrink-0 bg-white rounded-xl border border-slate-200 p-5 space-y-3 shadow-2xs">
              <div className="pb-3 border-b border-slate-100">
                <h2 className="text-sm font-semibold text-slate-900">Kredensial API Nanonets OCR</h2>
                <p className="text-xs text-slate-500 mt-0.5">Kunci otentikasi engine Nanonets untuk ekstraksi 7 dokumen import DocMatch</p>
              </div>

              <div className="max-w-xl space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Nanonets API Key</label>
                <div className="flex items-center gap-2">
                  <input
                    type={showApiKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Masukkan API Key Nanonets..."
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:border-blue-600 focus:bg-white transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                  >
                    {showApiKey ? "Sembunyikan" : "Tampilkan"}
                  </button>
                </div>

                <div className="pt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={testingConnection || isLoading}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
                  >
                    {testingConnection ? "Menguji..." : "Test Koneksi"}
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveSettings}
                    disabled={isSaving || isLoading}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
                  >
                    {isSaving ? "Menyimpan..." : "Simpan Konfigurasi"}
                  </button>
                </div>
              </div>
            </div>

            {/* Scrollable Models Table */}
            <div className="flex-1 min-h-0 flex flex-col bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Model OCR Resmi DocMatch</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Model ID Nanonets aktif untuk 7 jenis dokumen impor</p>
                </div>
                <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                  {models.length} Model Terdaftar
                </span>
              </div>

              <div className="flex-1 min-h-0 overflow-auto px-5 py-2">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-white z-10">
                    <tr className="border-b border-slate-100 text-slate-500 text-[11px] uppercase tracking-wider bg-slate-50/70">
                      <th className="py-2.5 px-3 font-semibold">Tipe Dokumen DocMatch</th>
                      <th className="py-2.5 px-3 font-semibold">Identifier Key</th>
                      <th className="py-2.5 px-3 font-semibold">Nanonets Model ID</th>
                      <th className="py-2.5 px-3 text-right font-semibold">Status Operasional</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {models.map((m, idx) => (
                      <tr key={m.key || idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 font-medium text-slate-800">{m.name}</td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">{m.key}</td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-blue-700 font-semibold">{m.modelId}</td>
                        <td className="py-2.5 px-3 text-right">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            {m.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
