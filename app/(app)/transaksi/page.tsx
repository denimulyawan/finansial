"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Pencil,
  Plus,
  Receipt,
  SlidersHorizontal,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { ApiError, api } from "@/lib/api";
import { picuMuatUlang, useApi } from "@/lib/hooks";
import { useAuth } from "@/components/auth";
import { useToast } from "@/components/toast";
import TxForm from "@/components/TxForm";
import { Card, Galat, Kosong, Modal, PageHeader, Skeleton } from "@/components/ui";
import {
  bulanSekarang,
  labelTanggal,
  rp,
  tanggalHariIni,
} from "@/lib/format";
import type { Tipe, Tx } from "@/lib/types";

const AWAL_BULAN = () => `${bulanSekarang()}-01`;

export default function HalamanTransaksi() {
  const { bootstrap } = useAuth();
  const toast = useToast();

  const [dari, setDari] = useState(AWAL_BULAN());
  const [sampai, setSampai] = useState(tanggalHariIni());
  const [tipe, setTipe] = useState<"" | Tipe>("");
  const [walletId, setWalletId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [tampilFilter, setTampilFilter] = useState(false);

  /* Wait 400 ms before searching. Without this every keystroke fires a
     request to Apps Script and the app feels very slow. */
  useEffect(() => {
    const jeda = setTimeout(() => setQ(qInput), 400);
    return () => clearTimeout(jeda);
  }, [qInput]);

  const [form, setForm] = useState<{ buka: boolean; awal: Tx | null }>({
    buka: false,
    awal: null,
  });
  const [hapus, setHapus] = useState<Tx | null>(null);
  const [menghapus, setMenghapus] = useState(false);

  const { data, loading, error, reload } = useApi<{ items: Tx[]; total: number }>(
    "tx.list",
    { from: dari, to: sampai, tipe, walletId, categoryId, q, limit: 500 }
  );

  const items = data?.items || [];

  const ringkas = useMemo(() => {
    let masuk = 0,
      keluar = 0,
      admin = 0;
    items.forEach((t) => {
      if (t.tipe === "Pemasukan") masuk += t.jumlah;
      else if (t.tipe === "Pengeluaran") keluar += t.jumlah;
      else {
        admin += t.biaya_admin;
        keluar += t.biaya_admin;
      }
    });
    return { masuk, keluar, admin };
  }, [items]);

  const adaFilter =
    !!tipe ||
    !!walletId ||
    !!categoryId ||
    !!q ||
    dari !== AWAL_BULAN() ||
    sampai !== tanggalHariIni();

  function bersihkan() {
    setTipe("");
    setWalletId("");
    setCategoryId("");
    setQInput("");
    setQ("");
    setDari(AWAL_BULAN());
    setSampai(tanggalHariIni());
  }

  async function konfirmasiHapus() {
    if (!hapus) return;
    setMenghapus(true);
    try {
      await api("tx.delete", { id: hapus.id });
      toast.sukses("Transaction deleted.");
      setHapus(null);
      picuMuatUlang();
    } catch (e) {
      toast.gagal(e instanceof ApiError ? e.message : "Could not delete.");
    } finally {
      setMenghapus(false);
    }
  }

  const kategoriTampil = (bootstrap?.categories || []).filter(
    (c) => c.sistem !== 1 && (!tipe || c.tipe === tipe)
  );

  /*
   * Sebelumnya muncul pesan galat DAN tulisan "No transactions" beserta
   * tombol "Add one" - terbaca seolah seluruh catatan sudah terhapus.
   */
  if (error && !data) {
    return (
      <>
        <PageHeader judul="Transactions" />
        <Galat pesan={error.message} onCobaLagi={reload} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        judul="Transactions"
        sub={`${items.length} shown`}
        aksi={
          <>
            <button
              className="btn btn-ghost btn-sm lg:hidden"
              onClick={() => setTampilFilter((v) => !v)}
            >
              <SlidersHorizontal size={14} /> Filter
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setForm({ buka: true, awal: null })}
            >
              <Plus size={15} strokeWidth={2.6} /> New
            </button>
          </>
        }
      />

      {/* filters */}
      <div className={`card card-lg card-pad mb-4 ${tampilFilter ? "" : "hidden lg:block"}`}>
        <div className="grid lg:grid-cols-12 gap-3">
          <div className="lg:col-span-4 relative">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 muted pointer-events-none"
            />
            <input
              className="input input-cari"
              placeholder="Search…"
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
            />
          </div>

          <div className="lg:col-span-2">
            <input
              type="date"
              className="input"
              value={dari}
              onChange={(e) => setDari(e.target.value)}
            />
          </div>

          <div className="lg:col-span-2">
            <input
              type="date"
              className="input"
              value={sampai}
              onChange={(e) => setSampai(e.target.value)}
            />
          </div>

          <div className="lg:col-span-2">
            <select
              className="select"
              value={tipe}
              onChange={(e) => {
                setTipe(e.target.value as "" | Tipe);
                setCategoryId("");
              }}
            >
              <option value="">All types</option>
              <option value="Pemasukan">Income</option>
              <option value="Pengeluaran">Expense</option>
              <option value="Transfer">Transfer</option>
            </select>
          </div>

          <div className="lg:col-span-2">
            <select
              className="select"
              value={walletId}
              onChange={(e) => setWalletId(e.target.value)}
            >
              <option value="">All wallets</option>
              {(bootstrap?.wallets || []).map((w) => (
                <option key={w.id} value={w.id}>
                  {w.nama}
                </option>
              ))}
            </select>
          </div>

          {tipe !== "Transfer" && (
            <div className="lg:col-span-3">
              <select
                className="select"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">All categories</option>
                {kategoriTampil.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nama}
                  </option>
                ))}
              </select>
            </div>
          )}

          {adaFilter && (
            <div className="lg:col-span-3 flex items-end">
              <button className="btn btn-ghost btn-sm" onClick={bersihkan}>
                <X size={14} /> Clear
              </button>
            </div>
          )}
        </div>
      </div>

      {/* totals */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-4">
        <Tile label="Income" nilai={ringkas.masuk} warna="var(--success)" Ikon={ArrowDownLeft} />
        <Tile label="Expenses" nilai={ringkas.keluar} warna="var(--danger)" Ikon={ArrowUpRight} />
        <Tile
          label="Net"
          nilai={ringkas.masuk - ringkas.keluar}
          warna="var(--accent)"
          Ikon={ArrowLeftRight}
        />
      </div>

      {error && (
        <div className="mb-4">
          <Galat pesan={error.message} onCobaLagi={reload} />
        </div>
      )}

      <Card besar pad={false}>
        {loading ? (
          <div className="p-5 space-y-2">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-13 w-full" style={{ height: 52 }} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <Kosong
            ikon={<Receipt size={22} />}
            judul="No transactions"
            aksi={
              adaFilter ? (
                <button className="btn btn-ghost btn-sm" onClick={bersihkan}>
                  Clear filters
                </button>
              ) : (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => setForm({ buka: true, awal: null })}
                >
                  <Plus size={15} /> Add one
                </button>
              )
            }
          />
        ) : (
          <>
            {/* desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th style={{ width: 110 }}>Date</th>
                    <th>Details</th>
                    <th style={{ width: 170 }}>Wallet</th>
                    <th style={{ width: 150, textAlign: "right" }}>Amount</th>
                    <th style={{ width: 84 }} />
                  </tr>
                </thead>
                <tbody>
                  {items.map((t) => (
                    <tr key={t.id}>
                      <td className="muted whitespace-nowrap text-[12.5px]">
                        {labelTanggal(t.tanggal)}
                      </td>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{
                              background:
                                t.tipe === "Transfer"
                                  ? "var(--info)"
                                  : t.tipe === "Pemasukan"
                                    ? "var(--success)"
                                    : "var(--danger)",
                            }}
                          />
                          <div className="min-w-0">
                            <p className="font-medium truncate">
                              {t.kategori || "Transfer"}
                            </p>
                            {(t.catatan || t.dicatatOleh) && (
                              <p className="text-[11.5px] muted truncate max-w-[280px]">
                                {[t.catatan, t.dicatatOleh]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="text-[12.5px] text-2">
                        {t.tipe === "Transfer"
                          ? `${t.wallet} → ${t.walletTujuan}`
                          : t.wallet}
                      </td>
                      <td className="text-right">
                        <span
                          className="num font-semibold"
                          style={{
                            color:
                              t.tipe === "Pemasukan"
                                ? "var(--success)"
                                : t.tipe === "Pengeluaran"
                                  ? "var(--danger)"
                                  : "var(--text-2)",
                          }}
                        >
                          {t.tipe === "Pemasukan" ? "+" : t.tipe === "Pengeluaran" ? "−" : ""}
                          {rp(t.jumlah)}
                        </span>
                        {t.biaya_admin > 0 && (
                          <span className="block text-[10px] muted">
                            +{rp(t.biaya_admin)} fee
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-0.5">
                          <button
                            className="btn btn-ghost btn-icon btn-sm"
                            title="Edit"
                            onClick={() => setForm({ buka: true, awal: t })}
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            className="btn btn-ghost btn-icon btn-sm"
                            title="Delete"
                            style={{ color: "var(--danger)" }}
                            onClick={() => setHapus(t)}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* mobile */}
            <div className="md:hidden divide-y" style={{ borderColor: "var(--border-soft)" }}>
              {items.map((t) => (
                <div key={t.id} className="flex items-center gap-3 p-3.5">
                  <span
                    className="grid place-items-center w-8 h-8 rounded-[9px] shrink-0"
                    style={{
                      background:
                        t.tipe === "Transfer"
                          ? "color-mix(in srgb, var(--info) 11%, transparent)"
                          : t.tipe === "Pemasukan"
                            ? "color-mix(in srgb, var(--success) 11%, transparent)"
                            : "color-mix(in srgb, var(--danger) 11%, transparent)",
                      color:
                        t.tipe === "Transfer"
                          ? "var(--info)"
                          : t.tipe === "Pemasukan"
                            ? "var(--success)"
                            : "var(--danger)",
                    }}
                  >
                    {t.tipe === "Transfer" ? (
                      <ArrowLeftRight size={15} />
                    ) : t.tipe === "Pemasukan" ? (
                      <ArrowDownLeft size={15} />
                    ) : (
                      <ArrowUpRight size={15} />
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium truncate">
                      {t.kategori || "Transfer"}
                    </p>
                    <p className="text-[11px] muted truncate">
                      {labelTanggal(t.tanggal)} ·{" "}
                      {t.tipe === "Transfer"
                        ? `${t.wallet} → ${t.walletTujuan}`
                        : t.wallet}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <p
                      className="num font-semibold text-[13px]"
                      style={{
                        color:
                          t.tipe === "Pemasukan"
                            ? "var(--success)"
                            : t.tipe === "Pengeluaran"
                              ? "var(--danger)"
                              : "var(--text-2)",
                      }}
                    >
                      {t.tipe === "Pemasukan" ? "+" : t.tipe === "Pengeluaran" ? "−" : ""}
                      {rp(t.jumlah)}
                    </p>
                    <div className="flex items-center justify-end gap-0.5 mt-0.5">
                      <button
                        className="btn btn-ghost btn-icon btn-sm"
                        onClick={() => setForm({ buka: true, awal: t })}
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        className="btn btn-ghost btn-icon btn-sm"
                        onClick={() => setHapus(t)}
                        style={{ color: "var(--danger)" }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      <Modal
        buka={form.buka}
        onTutup={() => setForm({ buka: false, awal: null })}
        judul={form.awal ? "Edit transaction" : "New transaction"}
        lebar={620}
      >
        {bootstrap && (
          <TxForm
            wallets={bootstrap.wallets}
            categories={bootstrap.categories}
            awal={form.awal}
            onSelesai={() => setForm({ buka: false, awal: null })}
            onBatal={() => setForm({ buka: false, awal: null })}
          />
        )}
      </Modal>

      <Modal
        buka={!!hapus}
        onTutup={() => setHapus(null)}
        judul="Delete transaction?"
        sub="This cannot be undone."
        lebar={400}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setHapus(null)}>
              Cancel
            </button>
            <button className="btn btn-danger" onClick={konfirmasiHapus} disabled={menghapus}>
              {menghapus ? "Deleting…" : "Delete"}
            </button>
          </>
        }
      >
        {hapus && (
          <div className="rounded-xl p-3.5 text-[13px]" style={{ background: "var(--surface-2)" }}>
            <p className="font-semibold">
              {hapus.kategori || "Transfer"} — {rp(hapus.jumlah)}
            </p>
            <p className="muted mt-0.5">
              {labelTanggal(hapus.tanggal)}
              {hapus.catatan ? ` · ${hapus.catatan}` : ""}
            </p>
          </div>
        )}
      </Modal>
    </>
  );
}

function Tile({
  label,
  nilai,
  warna,
  Ikon,
}: {
  label: string;
  nilai: number;
  warna: string;
  Ikon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
}) {
  return (
    <div className="tile anim-up" style={{ background: `color-mix(in srgb, ${warna} 8%, #fff)`, borderColor: `color-mix(in srgb, ${warna} 18%, #fff)` }}>
      <div className="flex items-center gap-1.5 mb-2">
        <span style={{ color: warna }}>
          <Ikon size={14} strokeWidth={2.5} />
        </span>
        <span className="text-[11.5px] font-medium muted truncate">{label}</span>
      </div>
      <p
        className="num text-[14px] sm:text-[16px] font-semibold title leading-none truncate"
        style={{ color: warna }}
      >
        {rp(nilai)}
      </p>
    </div>
  );
}
