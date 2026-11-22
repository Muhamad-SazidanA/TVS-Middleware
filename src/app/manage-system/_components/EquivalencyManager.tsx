"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";

export interface EquivalencyValueItem {
  id?: number;
  value: string;
}

export interface EquivalencyGroupItem {
  id: number;
  name: string;
  category: "port" | "company" | "incoterms" | "general" | string;
  canonical: string;
  values: EquivalencyValueItem[];
}

const CATEGORIES: Array<{ id: string; label: string }> = [
  { id: "all", label: "Semua Kategori" },
  { id: "port", label: "Pelabuhan (Port)" },
  { id: "company", label: "Perusahaan (Company)" },
  { id: "incoterms", label: "Incoterms / Penyerahan" },
  { id: "general", label: "Umum (General)" },
];

const CATEGORY_LABELS: Record<string, string> = {
  port: "Pelabuhan",
  company: "Perusahaan",
  incoterms: "Incoterms",
  general: "Umum",
};

// SVG Icons (Zero Emojis)
const PlusIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const SearchIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
    />
  </svg>
);

const TrashIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
    />
  </svg>
);

const EditIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
    />
  </svg>
);

const XIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const DatabaseIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
    />
  </svg>
);

const StarIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20">
    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
  </svg>
);

export default function EquivalencyManager() {
  const [groups, setGroups] = useState<EquivalencyGroupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<EquivalencyGroupItem | null>(null);
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState("general");
  const [formCanonical, setFormCanonical] = useState("");
  const [formValues, setFormValues] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Delete Confirm State
  const [deleteTarget, setDeleteTarget] = useState<EquivalencyGroupItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Toast State
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((curr) => (curr?.message === message ? null : curr));
    }, 3500);
  };

  // Fetch groups from API
  const fetchGroups = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/equivalencies");
      const data = await res.json();
      if (data.success && Array.isArray(data.groups)) {
        setGroups(data.groups);
      }
    } catch (err) {
      console.warn("Gagal mengambil data ekuivalensi:", err);
      showToast("Gagal memuat kamus ekuivalensi dari server", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingGroup(null);
    setFormName("");
    setFormCategory("general");
    setFormCanonical("");
    setFormValues([]);
    setInputValue("");
    setFormError(null);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (group: EquivalencyGroupItem) => {
    setEditingGroup(group);
    setFormName(group.name);
    setFormCategory(group.category);
    setFormCanonical(group.canonical);
    setFormValues(group.values.map((v) => v.value));
    setInputValue("");
    setFormError(null);
    setIsModalOpen(true);
  };

  // Add alias to form (case-insensitive deduplication)
  const handleAddAlias = () => {
    const val = inputValue.trim();
    if (!val) return;
    if (formValues.some((v) => v.toLowerCase() === val.toLowerCase())) {
      setFormError(`Nilai "${val}" sudah ada dalam daftar (huruf besar/kecil dianggap sama).`);
      return;
    }
    if (formCanonical.trim() && val.toLowerCase() === formCanonical.trim().toLowerCase()) {
      setFormError(`"${val}" adalah nilai Canonical (acuan utama), otomatis sudah termasuk dalam grup.`);
      return;
    }
    setFormValues([...formValues, val]);
    setInputValue("");
    setFormError(null);
  };

  const handleKeyDownInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      handleAddAlias();
    }
  };

  const handleRemoveAlias = (valToRemove: string) => {
    setFormValues(formValues.filter((v) => v.toLowerCase() !== valToRemove.toLowerCase()));
  };

  // Save (Create or Update)
  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError("Nama grup wajib diisi.");
      return;
    }
    if (!formCanonical.trim()) {
      setFormError("Nilai acuan (Canonical) wajib diisi.");
      return;
    }

    // Auto add any remaining input in the alias field (case-insensitive check)
    const finalValues = [...formValues];
    const rem = inputValue.trim();
    if (
      rem &&
      !finalValues.some((v) => v.toLowerCase() === rem.toLowerCase()) &&
      rem.toLowerCase() !== formCanonical.trim().toLowerCase()
    ) {
      finalValues.push(rem);
    }

    try {
      setIsSaving(true);
      setFormError(null);

      if (editingGroup) {
        // PUT update
        const res = await fetch(`/api/equivalencies/${editingGroup.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName.trim(),
            category: formCategory,
            canonical: formCanonical.trim(),
            values: finalValues,
          }),
        });
        const data = await res.json();
        if (data.success) {
          showToast(`Grup "${formName}" berhasil diperbarui.`, "success");
          setIsModalOpen(false);
          fetchGroups();
        } else {
          setFormError(data.error || "Gagal memperbarui grup.");
        }
      } else {
        // POST create
        const res = await fetch("/api/equivalencies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName.trim(),
            category: formCategory,
            canonical: formCanonical.trim(),
            values: finalValues,
          }),
        });
        const data = await res.json();
        if (data.success) {
          showToast(`Grup "${formName}" berhasil ditambahkan ke database.`, "success");
          setIsModalOpen(false);
          fetchGroups();
        } else {
          setFormError(data.error || "Gagal menambahkan grup.");
        }
      }
    } catch {
      setFormError("Terjadi kesalahan jaringan.");
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Group
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      setIsDeleting(true);
      const res = await fetch(`/api/equivalencies/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Grup "${deleteTarget.name}" berhasil dihapus.`, "info");
        setDeleteTarget(null);
        fetchGroups();
      } else {
        showToast(data.error || "Gagal menghapus grup.", "error");
      }
    } catch {
      showToast("Terjadi kesalahan jaringan saat menghapus.", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  // Filter groups
  const filteredGroups = useMemo(() => {
    return groups.filter((g) => {
      const matchCat = selectedCategory === "all" || g.category === selectedCategory;
      const q = search.trim().toLowerCase();
      const matchSearch =
        q === "" ||
        g.name.toLowerCase().includes(q) ||
        g.canonical.toLowerCase().includes(q) ||
        g.values.some((v) => v.value.toLowerCase().includes(q));
      return matchCat && matchSearch;
    });
  }, [groups, selectedCategory, search]);

  return (
    <div className="space-y-4">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`px-3.5 py-2.5 rounded-lg text-xs font-medium border flex items-center justify-between transition-all ${
            toast.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : toast.type === "error"
              ? "bg-rose-50 border-rose-200 text-rose-800"
              : "bg-slate-50 border-slate-200 text-slate-800"
          }`}
        >
          <span>{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-slate-700 ml-3 font-bold cursor-pointer"
          >
            ×
          </button>
        </div>
      )}

      {/* Header Card & Actions */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <DatabaseIcon className="w-4 h-4 text-blue-950" />
              <span>Database Kamus Ekuivalensi Nilai</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Daftarkan grup nilai yang dianggap setara dalam pencocokan antar dokumen (misal: pelabuhan, nama perusahaan, incoterms). Nilai yang tidak terdaftar hanya akan cocok jika sama persis (exact match).
            </p>
          </div>

          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-950 hover:bg-blue-900 text-white transition-colors cursor-pointer shrink-0 shadow-2xs"
          >
            <PlusIcon className="w-3.5 h-3.5" />
            <span>Tambah Grup</span>
          </button>
        </div>

        {/* Filters: Category and Search */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 pt-1">
          {/* Category Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
            {CATEGORIES.map((cat) => {
              const isActive = selectedCategory === cat.id;
              const count =
                cat.id === "all"
                  ? groups.length
                  : groups.filter((g) => g.category === cat.id).length;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    isActive
                      ? "bg-blue-950 text-white shadow-2xs"
                      : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200"
                  }`}
                >
                  <span>{cat.label}</span>
                  <span
                    className={`ml-1.5 text-[10px] px-1.5 py-0.2 rounded-full ${
                      isActive ? "bg-white/20 text-white font-bold" : "bg-slate-200/80 text-slate-600"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-64">
            <SearchIcon className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari grup, canonical, atau nilai..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-950 focus:bg-white transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <XIcon className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Groups List */}
      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-xs text-slate-500">
          Memuat kamus ekuivalensi dari database...
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center space-y-3">
          <div className="mx-auto w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
            <DatabaseIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-slate-800">
              {groups.length === 0 ? "Belum ada grup ekuivalensi terdaftar" : "Tidak ada grup yang sesuai filter pencarian"}
            </h3>
            <p className="text-[11px] text-slate-500 max-w-sm mx-auto mt-0.5">
              {groups.length === 0
                ? "Tambahkan grup baru untuk menyatukan variasi penulisan nilai yang setara (misal: 'TANJUNG PRIOK' dengan 'JAKARTA')."
                : "Coba ubah kata kunci pencarian atau kategori filter."}
            </p>
          </div>
          {groups.length === 0 && (
            <button
              type="button"
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-950 hover:bg-blue-900 text-white transition-colors cursor-pointer shadow-2xs"
            >
              <PlusIcon className="w-3.5 h-3.5" />
              <span>Tambah Grup Pertama</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredGroups.map((group) => {
            const catLabel = CATEGORY_LABELS[group.category] || group.category;
            return (
              <div
                key={group.id}
                className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-2xs hover:border-slate-300 transition-all flex flex-col justify-between"
              >
                <div className="space-y-2.5">
                  {/* Top Bar: Category badge & Actions */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-900 border border-blue-200">
                      {catLabel}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(group)}
                        title="Edit Grup"
                        className="p-1 rounded text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                      >
                        <EditIcon className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(group)}
                        title="Hapus Grup"
                        className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Group Name */}
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">{group.name}</h3>
                  </div>

                  {/* Canonical Value */}
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <StarIcon className="w-3 h-3 text-amber-500" />
                      <span>Nilai Acuan Utama (Canonical):</span>
                    </span>
                    <span className="block text-xs font-mono font-bold text-blue-950 truncate">
                      {group.canonical}
                    </span>
                  </div>

                  {/* Equivalent Values Chips */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Variasi Nilai Setara ({group.values.length}):
                    </span>
                    <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto no-scrollbar">
                      {group.values.length === 0 ? (
                        <span className="text-[11px] text-slate-400 italic">
                          Belum ada variasi nilai tambahan.
                        </span>
                      ) : (
                        group.values.map((v, idx) => (
                          <span
                            key={v.id || idx}
                            className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono bg-slate-100 text-slate-700 border border-slate-200"
                          >
                            {v.value}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer Count */}
                <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-400 flex items-center justify-between">
                  <span>Total {group.values.length + 1} entri dalam grup ini</span>
                  <span className="font-mono text-slate-300">ID #{group.id}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-lg p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {editingGroup ? "Edit Grup Ekuivalensi" : "Tambah Grup Ekuivalensi Baru"}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Semua nilai dalam grup ini akan dianggap MATCH satu sama lain dalam sistem matching.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="px-3 py-2 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveForm} className="space-y-3">
              {/* Nama Grup & Kategori */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Nama Grup:
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="misal: Pelabuhan Tanjung Priok"
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-950 focus:bg-white transition-all"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Kategori:
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-950 focus:bg-white transition-all"
                  >
                    <option value="port">Pelabuhan (Port)</option>
                    <option value="company">Perusahaan (Company)</option>
                    <option value="incoterms">Incoterms / Penyerahan</option>
                    <option value="general">Umum (General)</option>
                  </select>
                </div>
              </div>

              {/* Nilai Canonical */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Nilai Acuan Utama (Canonical):
                </label>
                <input
                  type="text"
                  value={formCanonical}
                  onChange={(e) => setFormCanonical(e.target.value)}
                  placeholder="misal: TANJUNG PRIOK"
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-blue-950 focus:outline-none focus:border-blue-950 focus:bg-white transition-all"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Nilai acuan standar yang akan menjadi representasi utama grup ini.
                </p>
              </div>

              {/* Variasi Nilai Ekuivalen */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 block">
                  Variasi Nilai yang Dianggap Setara:
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDownInput}
                    placeholder="Ketik variasi teks lalu tekan Enter (misal: JAKARTA, INDONESIA)"
                    className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:border-blue-950 focus:bg-white transition-all"
                  />
                  <button
                    type="button"
                    onClick={handleAddAlias}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                  >
                    Tambah
                  </button>
                </div>

                {/* Chips of added values */}
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg min-h-[64px] max-h-36 overflow-y-auto flex flex-wrap gap-1.5">
                  {formValues.length === 0 ? (
                    <span className="text-[11px] text-slate-400 italic">
                      Belum ada variasi nilai ditambahkan. Ketik di atas lalu tekan Enter.
                    </span>
                  ) : (
                    formValues.map((val) => (
                      <span
                        key={val}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono bg-white text-slate-800 border border-slate-200 shadow-2xs"
                      >
                        <span>{val}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveAlias(val)}
                          className="text-slate-400 hover:text-rose-600 p-0.5 cursor-pointer"
                        >
                          <XIcon className="w-2.5 h-2.5" />
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSaving}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-medium border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-blue-950 hover:bg-blue-900 text-white transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
                >
                  {isSaving ? "Menyimpan..." : editingGroup ? "Simpan Perubahan" : "Simpan ke Database"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-sm p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-900">Hapus Grup Ekuivalensi?</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Grup <strong className="text-slate-800">&quot;{deleteTarget.name}&quot;</strong> beserta seluruh variasi nilainya akan dihapus dari database. Dokumen yang sebelumnya cocok melalui grup ini akan menjadi <span className="font-semibold text-rose-600">MISMATCH</span> jika nilainya tidak identik.
            </p>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
              >
                {isDeleting ? "Menghapus..." : "Hapus Grup"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

