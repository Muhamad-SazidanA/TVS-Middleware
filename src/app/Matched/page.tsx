"use client";

import React from "react";

const FileCheckIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const CheckCircle2Icon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

export default function MatchedPage() {
  const matchedDocs = [
    {
      id: "NOPEN_10618",
      pibNo: "040300-000141420240405010618",
      pibDate: "2024-04-26",
      importir: "PT. TVS MOTOR COMPANY INDONESIA",
      invoiceNo: "91842690",
      masterBlNo: "S01235899",
      fobValue: "$ 45,210.00",
      netWeight: "8,500.00 kg",
      itemsCount: 34,
      status: "FULL_MATCH",
    },
    {
      id: "NOPEN_10619",
      pibNo: "040300-000141420240405010619",
      pibDate: "2024-04-27",
      importir: "PT. TVS MOTOR COMPANY INDONESIA",
      invoiceNo: "91842695",
      masterBlNo: "S01235912",
      fobValue: "$ 112,450.50",
      netWeight: "22,100.00 kg",
      itemsCount: 88,
      status: "FULL_MATCH",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header Status Summary */}
      <div className="bg-emerald-50/60 border border-emerald-200 p-5 rounded-2xl flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-100 rounded-xl text-emerald-800">
            <FileCheckIcon className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-emerald-950">
              Dokumen Matched (Sesuai 100%)
            </h3>
            <p className="text-xs text-slate-600 font-medium">
              Seluruh dokumen pendukung (Invoice, BL, Packing List) konsisten dengan PIB.
            </p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-2xl font-bold text-emerald-800">{matchedDocs.length}</span>
          <p className="text-xs text-slate-500 font-medium">Dokumen PIB</p>
        </div>
      </div>

      {/* Matched Documents Cards List */}
      <div className="space-y-4">
        {matchedDocs.map((doc) => (
          <div
            key={doc.id}
            className="bg-white border border-slate-200 hover:border-blue-900/30 p-5 rounded-2xl space-y-4 shadow-sm transition"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-mono bg-blue-50 text-blue-950 border border-blue-200 px-2.5 py-0.5 rounded font-bold">
                    {doc.id}
                  </span>
                  <h4 className="text-sm font-bold text-slate-900">{doc.pibNo}</h4>
                </div>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">
                  Importir: <span className="text-slate-800 font-semibold">{doc.importir}</span> • Tgl: {doc.pibDate}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5">
                  <CheckCircle2Icon className="w-3.5 h-3.5" />
                  FULL MATCH
                </span>
              </div>
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div>
                <p className="text-slate-400 mb-0.5 font-medium">No. Invoice</p>
                <p className="font-bold text-slate-800">{doc.invoiceNo}</p>
              </div>
              <div>
                <p className="text-slate-400 mb-0.5 font-medium">No. Master BL</p>
                <p className="font-bold text-slate-800">{doc.masterBlNo}</p>
              </div>
              <div>
                <p className="text-slate-400 mb-0.5 font-medium">Nilai FOB</p>
                <p className="font-bold text-blue-950">{doc.fobValue}</p>
              </div>
              <div>
                <p className="text-slate-400 mb-0.5 font-medium">Berat Bersih / Item</p>
                <p className="font-bold text-slate-800">
                  {doc.netWeight} ({doc.itemsCount} Jenis Barang)
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
