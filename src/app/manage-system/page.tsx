"use client";

import React, { useState } from "react";

// SVG Icons
const ServerIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
  </svg>
);

const CpuChipIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M3 9h2m-2 6h2m14-6h2m-2 6h2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
  </svg>
);

const KeyIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
  </svg>
);

const CheckCircleIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const RefreshIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const ShieldCheckIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

interface ModelConfig {
  name: string;
  key: string;
  modelId: string;
  status: "Active" | "Testing" | "Inactive";
}

export default function ManageSystemPage() {
  const [apiKey, setApiKey] = useState("80ca02b6-a812-11ef-a5c2-9eec1a95a8bf");
  const [showApiKey, setShowApiKey] = useState(false);
  const [strictMatching, setStrictMatching] = useState(true);
  const [autoMatchingTrigger, setAutoMatchingTrigger] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string | null>(null);

  const [models] = useState<ModelConfig[]>([
    { name: "PIB (Pemberitahuan Impor Barang)", key: "pib", modelId: "e887f4f2-953f-4e0c-a9df-6d736bfb15fa", status: "Active" },
    { name: "PIB Lanjutan", key: "pib_lanjutan", modelId: "c168f180-2c77-4fa5-985c-ffce10cbb21b", status: "Active" },
    { name: "Commercial Invoice", key: "invoice", modelId: "3047bb6c-1bd6-4e59-b13c-74a96bbfd1ea", status: "Active" },
    { name: "Packing List", key: "packing_list", modelId: "5df6c2ef-8339-4402-985d-ef3ef49313db", status: "Active" },
    { name: "House Bill of Lading (BL)", key: "house_bl", modelId: "b78345bf-6701-4dd9-a5bd-b9eeec1c8764", status: "Active" },
    { name: "Master Bill of Lading", key: "master_bl", modelId: "d6014e36-f089-4bbf-b38b-d7796eb071b7", status: "Active" },
    { name: "Rekap Document", key: "rekap", modelId: "01d4a04d-e9ee-474c-b197-0f8139589d98", status: "Active" },
  ]);

  const handleSaveSettings = () => {
    setIsSaving(true);
    setSaveSuccess(false);
    setTimeout(() => {
      setIsSaving(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }, 800);
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus(null);
    setTimeout(() => {
      setTestingConnection(false);
      setConnectionStatus("Berhasil terhubung ke Nanonets OCR Engine API! (Latency: 98ms)");
    }, 1200);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-950 text-white rounded-lg shadow-xs">
              <ServerIcon className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-blue-950 tracking-tight">Manage System</h1>
              <p className="text-xs text-slate-500 font-medium">
                Pengaturan Layanan Integrasi OCR Nanonets, Aturan Matching Engine, & Status Server
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleTestConnection}
            disabled={testingConnection}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 hover:text-blue-950 transition-colors shadow-xs disabled:opacity-50"
          >
            <RefreshIcon className={`w-4 h-4 ${testingConnection ? "animate-spin text-blue-950" : "text-slate-400"}`} />
            <span>{testingConnection ? "Menguji Koneksi..." : "Test Koneksi API"}</span>
          </button>

          <button
            onClick={handleSaveSettings}
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-blue-950 text-white hover:bg-blue-900 transition-colors shadow-sm disabled:opacity-50"
          >
            <CheckCircleIcon className="w-4 h-4 text-emerald-400" />
            <span>{isSaving ? "Menyimpan..." : "Simpan Konfigurasi"}</span>
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {saveSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center justify-between animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <CheckCircleIcon className="w-4 h-4 text-emerald-600" />
            <span>Konfigurasi sistem berhasil diperbarui dan disimpan!</span>
          </div>
        </div>
      )}

      {connectionStatus && (
        <div className="p-3.5 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl text-xs font-semibold flex items-center justify-between animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <ShieldCheckIcon className="w-4 h-4 text-blue-700" />
            <span>{connectionStatus}</span>
          </div>
        </div>
      )}

      {/* System Health Overview Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Status Service OCR</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Online
            </span>
          </div>
          <p className="text-lg font-bold text-blue-950">Nanonets Engine</p>
          <p className="text-[11px] text-slate-500">API Latency: ~120ms</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Database Middleware</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Connected
            </span>
          </div>
          <p className="text-lg font-bold text-blue-950">Prisma (SQLite)</p>
          <p className="text-[11px] text-slate-500">Active Storage OK</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Aturan Matching</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
              Strict
            </span>
          </div>
          <p className="text-lg font-bold text-blue-950">Exact String Match</p>
          <p className="text-[11px] text-slate-500">Tanpa Auto-Normalize</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Auto Webhook</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
              Listening
            </span>
          </div>
          <p className="text-lg font-bold text-blue-950">Active Listener</p>
          <p className="text-[11px] text-slate-500">/api/webhooks/nanonets</p>
        </div>
      </div>

      {/* Section 1: Nanonets API Credentials */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <KeyIcon className="w-5 h-5 text-blue-950" />
          <div>
            <h2 className="text-sm font-bold text-blue-950">Kredensial API Nanonets</h2>
            <p className="text-xs text-slate-500">Kunci otentikasi API utama yang digunakan untuk mengekstrak dokumen OCR</p>
          </div>
        </div>

        <div className="max-w-xl space-y-1.5">
          <label className="text-xs font-semibold text-slate-700">Nanonets API Key</label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type={showApiKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:border-blue-950 focus:bg-white transition-all"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-blue-950 bg-slate-100 rounded-xl transition-colors"
            >
              {showApiKey ? "Sembunyikan" : "Tampilkan"}
            </button>
          </div>
        </div>
      </div>

      {/* Section 2: OCR Model ID Mappings */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <CpuChipIcon className="w-5 h-5 text-blue-950" />
            <div>
              <h2 className="text-sm font-bold text-blue-950">Pemetaan ID Model OCR Nanonets</h2>
              <p className="text-xs text-slate-500">ID Model spesifik untuk ekstraksi data tiap jenis dokumen import</p>
            </div>
          </div>
          <span className="text-[11px] font-bold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
            7 Active Models
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase text-[10px]">
                <th className="py-2.5 px-3">Tipe Dokumen</th>
                <th className="py-2.5 px-3">Key Model</th>
                <th className="py-2.5 px-3">Nanonets Model ID</th>
                <th className="py-2.5 px-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {models.map((m) => (
                <tr key={m.key} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3 px-3 font-semibold text-slate-800">{m.name}</td>
                  <td className="py-3 px-3 font-mono text-[11px] text-slate-500">{m.key}</td>
                  <td className="py-3 px-3 font-mono text-[11px] text-blue-950 font-medium">{m.modelId}</td>
                  <td className="py-3 px-3 text-center">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {m.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 3: Matching Rules & System Logic */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <ShieldCheckIcon className="w-5 h-5 text-blue-950" />
          <div>
            <h2 className="text-sm font-bold text-blue-950">Aturan Engine Pencocokan (Matching Rules)</h2>
            <p className="text-xs text-slate-500">Pengaturan logika dan toleransi pencocokan nilai dokumen PIB vs Dokumen Pembanding</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-100">
            <div>
              <p className="text-xs font-bold text-blue-950">Strict Exact String Matching</p>
              <p className="text-[11px] text-slate-500">
                Bandingkan teks nilai secara langsung tanpa penghapusan karakter simbol/tanda baca otomatis.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={strictMatching}
                onChange={(e) => setStrictMatching(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-950"></div>
            </label>
          </div>

          <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-100">
            <div>
              <p className="text-xs font-bold text-blue-950">Auto-Matching Trigger saat Extract Webhook Complete</p>
              <p className="text-[11px] text-slate-500">
                Otomatis evaluasi ulang status batch setelah hasil parsing webhook Nanonets diterima.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={autoMatchingTrigger}
                onChange={(e) => setAutoMatchingTrigger(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-950"></div>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
