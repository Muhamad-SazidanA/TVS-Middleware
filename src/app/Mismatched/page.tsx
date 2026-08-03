"use client";

import React from "react";

const AlertTriangleIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

const XCircleIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

export default function MismatchedPage() {
  const mismatchedDocs = [
    {
      id: "NOPEN_10617",
      pibNo: "040300-000141420240405010617",
      pibDate: "2024-04-25",
      importir: "PT. TVS MOTOR COMPANY INDONESIA",
      invoiceNo: "91842687, 91842688",
      masterBlNo: "S01235842",
      houseBlNo: "ONEYBLRE02110700",
      fobValue: "$ 90,373.04",
      netWeight: "17,006.75 kg",
      itemsCount: 77,
      status: "PARTIAL_MATCH",
      mismatches: [
        {
          level: "Level 3 - Line Item",
          partNo: "R1210020",
          field: "Pos Tarif (HS Code)",
          description: "SEAT ASSY LATCH",
          pibValue: "87141090",
          docValue: "87141010",
          docSource: "Invoice #91842688 (Baris 29)",
          severity: "HIGH",
          reason: "Tarif Bea Masuk di Invoice tidak cocok dengan PIB & Parts List",
        },
        {
          level: "Level 2 - Aggregate",
          partNo: "N/A",
          field: "Jumlah Qty Total",
          description: "Aggregate Part K6210480",
          pibValue: "200 pcs",
          docValue: "180 pcs",
          docSource: "Invoice #91842687",
          severity: "MEDIUM",
          reason: "Selisih 20 pcs pada total item invoice",
        },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header Status Summary */}
      <div className="bg-rose-50/60 border border-rose-200 p-5 rounded-2xl flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-rose-100 rounded-xl text-rose-800">
            <AlertTriangleIcon className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-rose-950">
              Dokumen Mismatched (Perlu Review User)
            </h3>
            <p className="text-xs text-slate-600 font-medium">
              Ditemukan selisih data antara PIB dan dokumen pendukung. Diperlukan perhatian khusus pada field High Severity.
            </p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-2xl font-bold text-rose-700">{mismatchedDocs.length}</span>
          <p className="text-xs text-slate-500 font-medium">Dokumen PIB</p>
        </div>
      </div>

      {/* Mismatched Documents Detail Cards */}
      <div className="space-y-6">
        {mismatchedDocs.map((doc) => (
          <div
            key={doc.id}
            className="bg-white border border-rose-200 p-5 rounded-2xl space-y-5 shadow-sm"
          >
            {/* Header Doc Info */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-mono bg-rose-100 text-rose-900 border border-rose-200 px-2.5 py-0.5 rounded font-bold">
                    {doc.id}
                  </span>
                  <h4 className="text-sm font-bold text-slate-900">{doc.pibNo}</h4>
                </div>
                <p className="text-xs text-slate-500 mt-1 font-medium">
                  Importir: <span className="text-slate-800 font-semibold">{doc.importir}</span> • Invoice:{" "}
                  <span className="text-blue-950 font-bold">{doc.invoiceNo}</span> • BL: {doc.masterBlNo}
                </p>
              </div>

              <span className="bg-rose-100 text-rose-800 border border-rose-200 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5">
                <XCircleIcon className="w-3.5 h-3.5" />
                PARTIAL MATCH (2 Mismatch)
              </span>
            </div>

            {/* Discrepancies Table */}
            <div>
              <h5 className="text-xs font-bold text-blue-950 uppercase tracking-wider mb-3">
                Detail Diskrepansi / Selisih Data:
              </h5>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                      <th className="p-3">Level Check</th>
                      <th className="p-3">Part No / Item</th>
                      <th className="p-3">Field Discrepancy</th>
                      <th className="p-3">Nilai PIB</th>
                      <th className="p-3">Nilai Dokumen Pendukung</th>
                      <th className="p-3">Severity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {doc.mismatches.map((m, idx) => (
                      <tr key={idx} className="hover:bg-blue-50/20">
                        <td className="p-3 font-semibold text-slate-700">{m.level}</td>
                        <td className="p-3">
                          <span className="font-mono font-bold text-blue-950">{m.partNo}</span>
                          <p className="text-[11px] text-slate-500 font-medium">{m.description}</p>
                        </td>
                        <td className="p-3 font-bold text-amber-700">{m.field}</td>
                        <td className="p-3 font-mono font-bold text-emerald-700 bg-emerald-50 rounded">
                          {m.pibValue}
                        </td>
                        <td className="p-3 font-mono font-bold text-rose-700 bg-rose-50 rounded">
                          {m.docValue}
                          <p className="text-[10px] text-slate-500 font-sans font-normal mt-0.5">{m.docSource}</p>
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              m.severity === "HIGH"
                                ? "bg-rose-100 text-rose-800 border border-rose-300"
                                : "bg-amber-100 text-amber-800 border border-amber-300"
                            }`}
                          >
                            {m.severity}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Action Bar */}
            <div className="pt-2 flex justify-end gap-3">
              <button className="bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold px-4 py-2 rounded-xl border border-slate-200 shadow-xs transition">
                Lihat PDF Asli
              </button>
              <button className="bg-blue-950 hover:bg-blue-900 text-white text-xs font-bold px-4 py-2 rounded-xl shadow transition">
                Export Report Audit (JSON)
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
