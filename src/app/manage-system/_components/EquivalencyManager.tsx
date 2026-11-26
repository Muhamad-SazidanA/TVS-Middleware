"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import ToastNotification, {
  useToastState,
} from "@/app/_components/ui/ToastNotification";

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
  { id: "all", label: "Semua" },
  { id: "port", label: "Pelabuhan" },
  { id: "company", label: "Perusahaan" },
  { id: "incoterms", label: "Incoterms" },
  { id: "general", label: "Umum" },
];

const CATEGORY_LABELS: Record<string, string> = {
  port: "Pelabuhan",
  company: "Perusahaan",
  incoterms: "Incoterms",
  general: "Umum",
};

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

  // Toast State (top-right light popup)
  const { toast, showToast, dismissToast } = useToastState();

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
  }, [showToast]);

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

  // Add alias to form (case-insensitive deduplication, supports multiline or comma separated paste)
  const handleAddAlias = () => {
    const raw = inputValue.trim();
    if (!raw) return;

    // Split by newlines or commas
    const tokens = raw
      .split(/[\r\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (tokens.length === 0) return;

    const newValues = [...formValues];
    let addedCount = 0;

    for (const val of tokens) {
      if (
        !newValues.some((v) => v.toLowerCase() === val.toLowerCase()) &&
        val.toLowerCase() !== formCanonical.trim().toLowerCase()
      ) {
        newValues.push(val);
        addedCount++;
      }
    }

    if (addedCount === 0 && tokens.length === 1) {
      if (formValues.some((v) => v.toLowerCase() === raw.toLowerCase())) {
        setFormError(`Nilai "${raw}" sudah ada dalam daftar.`);
        return;
      }
      if (formCanonical.trim() && raw.toLowerCase() === formCanonical.trim().toLowerCase()) {
        setFormError(`"${raw}" adalah nilai Acuan Utama (Canonical), otomatis sudah termasuk.`);
        return;
      }
    }

    setFormValues(newValues);
    setInputValue("");
    setFormError(null);
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
    <div className="flex-1 min-h-0 flex flex-col gap-3.5">
      {/* Top-Right Light Toast Notification */}
      <ToastNotification toast={toast} onClose={dismissToast} />

      {/* Header Card & Actions (Card 2 Fixed) */}
      <div className="shrink-0 bg-white rounded-xl border border-slate-200 px-4 py-3.5 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-900">
              Kamus Ekuivalensi
            </h2>
            <span className="text-[11px] font-medium text-slate-400">
              ({groups.length} aturan)
            </span>
          </div>

          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-[#091E42] hover:bg-[#091E42]/90 text-white transition-colors cursor-pointer shrink-0 shadow-2xs"
          >
            <PlusIcon className="w-3.5 h-3.5" />
            <span>Tambah Grup</span>
          </button>
        </div>

        {/* Filters: Category and Search */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 pt-2.5 border-t border-slate-100">
          {/* Category Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
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
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    isActive
                      ? "bg-slate-900 text-white"
                      : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
                  }`}
                >
                  <span>{cat.label}</span>
                  <span
                    className={`ml-1.5 text-[10px] ${
                      isActive ? "text-slate-300" : "text-slate-400"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-60">
            <SearchIcon className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari aturan atau nilai..."
              className="w-full pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-900 focus:bg-white transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <XIcon className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Groups List (Scrollable below fixed cards) */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-0.5 pb-1">
        {loading ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-xs text-slate-500">
            Memuat kamus ekuivalensi...
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-10 text-center space-y-2.5">
            <p className="text-xs font-medium text-slate-700">
              {groups.length === 0
                ? "Belum ada aturan kamus terdaftar."
                : "Tidak ada aturan yang sesuai filter."}
            </p>
            {groups.length === 0 && (
              <button
                type="button"
                onClick={handleOpenCreate}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#091E42] hover:bg-[#091E42]/90 text-white transition-colors cursor-pointer"
              >
                <PlusIcon className="w-3.5 h-3.5" />
                <span>Tambah Grup</span>
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
                  className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-2xs hover:border-slate-300 transition-colors flex flex-col"
                >
                  {/* Top Row: Group Name, Plain Category, Actions */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <h3 className="text-sm font-semibold text-slate-900 truncate">
                        {group.name}
                      </h3>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                        {catLabel}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(group)}
                        title="Edit"
                        className="p-1 rounded text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                      >
                        <EditIcon className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(group)}
                        title="Hapus"
                        className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Canonical Value */}
                  <div className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200/80 space-y-0.5">
                    <span className="text-[11px] font-medium text-slate-500 block">
                      Acuan (PIB)
                    </span>
                    <span className="block text-xs font-mono font-semibold text-slate-900 break-words">
                      {group.canonical}
                    </span>
                  </div>

                  {/* Equivalent Variations */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-medium text-slate-500 block">
                      Variasi ({group.values.length})
                    </span>

                    {group.values.length === 0 ? (
                      <span className="text-xs text-slate-400 block">
                        Belum ada variasi.
                      </span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-0.5">
                        {group.values.map((v, idx) => (
                          <span
                            key={v.id || idx}
                            className="inline-flex items-center px-2.5 py-1 rounded-md bg-white border border-slate-200 text-xs font-mono text-slate-700 break-words max-w-full"
                          >
                            {v.value}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CREATE / EDIT MODAL (Compact single-view without outer popup scroll) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/45 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-xl p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-900">
                {editingGroup ? "Edit Aturan Kamus" : "Tambah Aturan Kamus"}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-slate-100 cursor-pointer transition-colors"
                title="Tutup"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="mt-3 px-3 py-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveForm} className="mt-3.5 space-y-3">
              {/* Row 1: Rule Name & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-slate-700 block mb-1">
                    Nama Aturan
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Contoh: Terms_of_Delivery"
                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-slate-900 transition-colors"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">
                    Kategori
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full h-9 px-2.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-slate-900 transition-colors cursor-pointer"
                  >
                    <option value="port">Pelabuhan</option>
                    <option value="company">Perusahaan</option>
                    <option value="incoterms">Incoterms</option>
                    <option value="general">Umum</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Canonical Value */}
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">
                  Nilai Acuan (PIB)
                </label>
                <input
                  type="text"
                  value={formCanonical}
                  onChange={(e) => setFormCanonical(e.target.value)}
                  placeholder="Contoh: CIF"
                  className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-xs font-mono font-medium text-slate-900 focus:outline-none focus:border-slate-900 transition-colors"
                />
              </div>

              {/* Row 3: Variations Input + Chips */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-700 block">
                  Variasi Nilai ({formValues.length})
                </label>
                <div className="flex items-center gap-2">
                  <textarea
                    rows={1}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleAddAlias();
                      }
                    }}
                    placeholder="Ketik / paste variasi (pisahkan koma atau Enter)"
                    className="flex-1 h-9 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:border-slate-900 transition-colors resize-none leading-snug"
                  />
                  <button
                    type="button"
                    onClick={handleAddAlias}
                    className="h-9 px-3 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                  >
                    + Tambah
                  </button>
                </div>

                {/* Compact Wrap Chip List (only inner chip box scrolls if huge) */}
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg min-h-[54px] max-h-36 overflow-y-auto">
                  {formValues.length === 0 ? (
                    <span className="text-xs text-slate-400 block py-1.5 text-center">
                      Belum ada variasi ditambahkan
                    </span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {formValues.map((val, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-slate-200 text-xs font-mono text-slate-800 max-w-full"
                        >
                          <span className="break-words leading-snug">{val}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveAlias(val)}
                            className="text-slate-400 hover:text-rose-600 cursor-pointer shrink-0"
                            title="Hapus"
                          >
                            <XIcon className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Sticky/Docked Modal Footer Buttons */}
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
                  className="px-4 py-1.5 rounded-lg text-xs font-medium bg-[#091E42] hover:bg-[#091E42]/90 text-white transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
                >
                  {isSaving ? "Menyimpan..." : editingGroup ? "Simpan Perubahan" : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/45 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-sm p-5 space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">Hapus Aturan?</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Aturan <strong className="text-slate-800">&quot;{deleteTarget.name}&quot;</strong> beserta seluruh variasinya akan dihapus permanen.
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
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-rose-600 hover:bg-rose-700 text-white transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
              >
                {isDeleting ? "Menghapus..." : "Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

