"use client";

import React, { useState, useEffect, useCallback } from "react";
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
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{ text: string; isError: boolean } | null>(null);

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
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSaveSettings = async () => {
    try {
      setIsSaving(true);
      setSaveSuccess(null);
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
        setSaveSuccess("Konfigurasi sistem berhasil disimpan ke server.");
        setTimeout(() => setSaveSuccess(null), 4000);
      } else {
        setConnectionStatus({
          text: `Gagal menyimpan: ${json.error || "Terjadi kesalahan"}`,
          isError: true,
        });
      }
    } catch (err) {
      setConnectionStatus({
        text: `Gagal menyimpan: ${err instanceof Error ? err.message : "Kesalahan koneksi"}`,
        isError: true,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      setTestingConnection(true);
      setConnectionStatus(null);
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
        setConnectionStatus({
          text: json.message || "Berhasil terhubung ke Nanonets API.",
          isError: false,
        });
      } else {
        setConnectionStatus({
          text: json.message || "Gagal terhubung ke Nanonets API.",
          isError: true,
        });
      }
    } catch (err) {
      setConnectionStatus({
        text: `Error saat menguji koneksi: ${err instanceof Error ? err.message : "Network error"}`,
        isError: true,
      });
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
    <div className="h-full overflow-y-auto px-6 sm:px-8 py-8 max-w-7xl mx-auto w-full space-y-5">
      {/* Header */}
      <div className="pb-3 border-b border-slate-200">
        <h1 className="text-base font-bold text-blue-950">Manage System</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Konfigurasi integrasi OCR, aturan matching, dan model data PT. UNITED STEEL CENTER INDONESIA
        </p>
      </div>

      {/* Inline feedback */}
      {saveSuccess && (
        <div className="px-3.5 py-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs flex items-center justify-between">
          <span>{saveSuccess}</span>
          <button onClick={() => setSaveSuccess(null)} className="text-emerald-600 hover:text-emerald-900 font-bold ml-2">×</button>
        </div>
      )}

      {connectionStatus && (
        <div
          className={`px-3.5 py-2.5 border rounded-lg text-xs flex items-center justify-between ${
            connectionStatus.isError
              ? "bg-rose-50 border-rose-200 text-rose-800"
              : "bg-emerald-50 border-emerald-200 text-emerald-800"
          }`}
        >
          <span>{connectionStatus.text}</span>
          <button onClick={() => setConnectionStatus(null)} className="font-bold ml-2">×</button>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto scrollbar-none">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3.5 py-2 text-xs font-medium border-b-2 transition-colors cursor-pointer -mb-px whitespace-nowrap ${
              activeTab === tab.id
                ? "border-blue-950 text-blue-950 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Visual Workflow Builder (Data Actions) */}
      {activeTab === "workflow" && <WorkflowBuilder />}

      {/* Tab 2: Kamus Ekuivalensi Nilai Database */}
      {activeTab === "equivalency" && <EquivalencyManager />}

      {/* Tab 3: System Audit Logs & History */}
      {activeTab === "audit" && <AuditLogViewer />}

      {/* Tab 4: OCR Models & API Credentials */}
      {activeTab === "models" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3 shadow-2xs">
            <div className="pb-3 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-900">Kredensial API Nanonets OCR</h2>
              <p className="text-xs text-slate-500 mt-0.5">Kunci otentikasi engine Nanonets untuk ekstraksi 7 dokumen import USC</p>
            </div>

            <div className="max-w-xl space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Nanonets API Key</label>
              <div className="flex items-center gap-2">
                <input
                  type={showApiKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Masukkan API Key Nanonets..."
                  className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:border-blue-950 focus:bg-white transition-all"
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
                  className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-blue-950 text-white hover:bg-blue-900 transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
                >
                  {isSaving ? "Menyimpan..." : "Simpan Konfigurasi"}
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Model OCR Resmi PT. UNITED STEEL CENTER INDONESIA</h2>
                <p className="text-xs text-slate-500 mt-0.5">Model ID Nanonets aktif untuk 7 jenis dokumen baja import</p>
              </div>
              <span className="text-xs font-semibold text-blue-950 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                {models.length} Model Terdaftar
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-500 text-[11px] uppercase tracking-wider bg-slate-50/50">
                    <th className="py-2.5 px-3 font-semibold">Tipe Dokumen USC</th>
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
                      <td className="py-2.5 px-3 font-mono text-[11px] text-blue-900 font-semibold">{m.modelId}</td>
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
  );
}
