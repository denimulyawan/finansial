"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Filter,
  Pencil,
  Plus,
  Receipt,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { ApiError, api } from "@/lib/api";
import { picuMuatUlang, useApi } from "@/lib/hooks";
import { useAuth } from "@/components/auth";
import { useToast } from "@/components/toast";
import TxForm from "@/components/TxForm";
import {
  Card,
  Galat,
  Kosong,
  Modal,
  PageHeader,
  Skeleton,
} from "@/components/ui";
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

  /* Jeda 400 ms sebelum mencari. Tanpa ini setiap huruf yang diketik memicu
     satu permintaan ke Apps Script, dan aplikasinya terasa sangat berat. */
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

  const { data, loading, error, reload } = useApi<{
    items: Tx[];
    total: number;
  }>("tx.list", {
    from: dari,
    to: sampai,
    tipe,
    walletId,
    categoryId,
    q,
    limit: 500,
  });

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
    !!tipe || !!walletId || !!categoryId || !!q || dari !== AWAL_BULAN() || sampai !== tanggalHariIni();

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
      const hasil = await api<{ notif?: { terkirim?: number } }>("tx.delete", {
        id: hapus.id,
      });
      toast.sukses("Transaksi dihapus.");
      if (hasil?.notif?.terkirim) {
        toast.info("Status budget diperbarui di Telegram.");
      }
      setHapus(null);
      picuMuatUlang();
    } catch (e) {
      toast.gagal(e instanceof ApiError ? e.message : "Gagal menghapus.");
    } finally {
      setMenghapus(false);
    }
  }

  const kategoriTampil = (bootstrap?.categories || []).filter(
    (c) => c.sistem !== 1 && (!tipe || c.tipe === tipe)
  );

  return (
    <>
      <PageHeader
        judul="Transaksi"
        sub={`${items.length} transaksi ditemukan`}
        aksi={
          <>
            <button
              className="btn btn-ghost btn-sm lg:hidden"
              onClick={() => setTampilFilter((v) => !v)}
            >
              <Filter size={15} /> Filter
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setForm({ buka: true, awal: null })}
            >
              <Plus size={16} strokeWidth={2.6} /> Catat
            </button>
          </>
        }
      />

      {/* ------------------------------ filter ------------------------------ */}
      <div
        className={`card card-lg card-pad mb-4 ${tampilFilter ? "" : "hidden lg:block"}`}
      >
        <div className="grid lg:grid-cols-12 gap-3">
          <div className="lg:col-span-4 relative">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 muted pointer-events-none"
            />
            <input
              className="input pl-10"
              placeholder="Cari catatan, kategori, atau nominal…"
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
              title="Dari tanggal"
            />
          </div>

          <div className="lg:col-span-2">
            <input
              type="date"
              className="input"
              value={sampai}
              onChange={(e) => setSampai(e.target.value)}
              title="Sampai tanggal"
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
              <option value="">Semua tipe</option>
              <option value="Pemasukan">Pemasukan</option>
              <option value="Pengeluaran">Pengeluaran</option>
              <option value="Transfer">Transfer</option>
            </select>
          </div>

          <div className="lg:col-span-2">
            <select
              className="select"
              value={walletId}
              onChange={(e) => setWalletId(e.target.value)}
            >
              <option value="">Semua dompet</option>
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
                <option value="">Semua kategori</option>
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
                <X size={15} /> Hapus filter
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ----------------------------- ringkasan ----------------------------- */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-4">
        <RingkasKecil
          label="Pemasukan"
          nilai={ringkas.masuk}
          warna="var(--success)"
          Ikon={ArrowDownLeft}
        />
        <RingkasKecil
          label="Pengeluaran"
          nilai={ringkas.keluar}
          warna="var(--danger)"
          Ikon={ArrowUpRight}
          catatan={ringkas.admin > 0 ? `+${rp(ringkas.admin)} admin` : undefined}
        />
        <RingkasKecil
          label="Selisih"
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

      {/* ------------------------------- daftar ------------------------------- */}
      <Card besar pad={false}>
        {loading ? (
          <div className="p-5 space-y-2">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <Kosong
            ikon={<Receipt size={24} />}
            judul="Tidak ada transaksi"
            isi={
              adaFilter
                ? "Coba ubah filter atau rentang tanggalnya."
                : "Belum ada transaksi pada rentang tanggal ini."
            }
            aksi={
              adaFilter ? (
                <button className="btn btn-ghost btn-sm" onClick={bersihkan}>
                  Hapus filter
                </button>
              ) : (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => setForm({ buka: true, awal: null })}
                >
                  <Plus size={16} /> Catat sekarang
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
                    <th style={{ width: 120 }}>Tanggal</th>
                    <th>Keterangan</th>
                    <th style={{ width: 150 }}>Dompet</th>
                    <th style={{ width: 150, textAlign: "right" }}>Nominal</th>
                    <th style={{ width: 96 }} />
                  </tr>
                </thead>
                <tbody>
                  {items.map((t) => (
                    <tr key={t.id}>
                      <td className="muted whitespace-nowrap text-[13px]">
                        {labelTanggal(t.tanggal)}
                      </td>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
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
                            {t.catatan && (
                              <p className="text-[12px] muted truncate max-w-[280px]">
                                {t.catatan}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="text-[13px] text-2">
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
                          <span className="block text-[10.5px] muted">
                            +{rp(t.biaya_admin)} admin
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            className="btn btn-ghost btn-icon btn-sm"
                            title="Ubah"
                            onClick={() => setForm({ buka: true, awal: t })}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            className="btn btn-ghost btn-icon btn-sm"
                            title="Hapus"
                            onClick={() => setHapus(t)}
                            style={{ color: "var(--danger)" }}
                          >
                            <Trash2 size={14} />
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
                    className="grid place-items-center w-9 h-9 rounded-[10px] shrink-0"
                    style={{
                      background:
                        t.tipe === "Transfer"
                          ? "color-mix(in srgb, var(--info) 13%, transparent)"
                          : t.tipe === "Pemasukan"
                            ? "color-mix(in srgb, var(--success) 13%, transparent)"
                            : "color-mix(in srgb, var(--danger) 13%, transparent)",
                      color:
                        t.tipe === "Transfer"
                          ? "var(--info)"
                          : t.tipe === "Pemasukan"
                            ? "var(--success)"
                            : "var(--danger)",
                    }}
                  >
                    {t.tipe === "Transfer" ? (
                      <ArrowLeftRight size={16} />
                    ) : t.tipe === "Pemasukan" ? (
                      <ArrowDownLeft size={16} />
                    ) : (
                      <ArrowUpRight size={16} />
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-medium truncate">
                      {t.kategori || "Transfer"}
                    </p>
                    <p className="text-[11.5px] muted truncate">
                      {labelTanggal(t.tanggal)} ·{" "}
                      {t.tipe === "Transfer"
                        ? `${t.wallet} → ${t.walletTujuan}`
                        : t.wallet}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <p
                      className="num font-semibold text-[13.5px]"
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
                    <div className="flex items-center justify-end gap-1 mt-1">
                      <button
                        className="btn btn-ghost btn-icon btn-sm"
                        onClick={() => setForm({ buka: true, awal: t })}
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        className="btn btn-ghost btn-icon btn-sm"
                        onClick={() => setHapus(t)}
                        style={{ color: "var(--danger)" }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      {/* ------------------------------- modal ------------------------------- */}
      <Modal
        buka={form.buka}
        onTutup={() => setForm({ buka: false, awal: null })}
        judul={form.awal ? "Ubah transaksi" : "Catat transaksi"}
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
        judul="Hapus transaksi?"
        sub="Tindakan ini tidak bisa dibatalkan."
        lebar={420}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setHapus(null)}>
              Batal
            </button>
            <button
              className="btn btn-danger"
              onClick={konfirmasiHapus}
              disabled={menghapus}
            >
              {menghapus ? "Menghapus…" : "Ya, hapus"}
            </button>
          </>
        }
      >
        {hapus && (
          <div
            className="rounded-xl p-4 text-[13.5px]"
            style={{ background: "var(--surface-2)" }}
          >
            <p className="font-semibold">
              {hapus.kategori || "Transfer"} — {rp(hapus.jumlah)}
            </p>
            <p className="muted mt-1">
              {labelTanggal(hapus.tanggal)}
              {hapus.catatan ? ` · ${hapus.catatan}` : ""}
            </p>
          </div>
        )}
      </Modal>
    </>
  );
}

function RingkasKecil({
  label,
  nilai,
  warna,
  Ikon,
  catatan,
}: {
  label: string;
  nilai: number;
  warna: string;
  Ikon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  catatan?: string;
}) {
  return (
    <div className="card card-pad">
      <div className="flex items-center gap-2 mb-2">
        <span style={{ color: warna }}>
          <Ikon size={15} strokeWidth={2.5} />
        </span>
        <span className="text-[12px] font-medium muted truncate">{label}</span>
      </div>
      <p
        className="num text-[15px] sm:text-[17px] font-semibold title leading-none truncate"
        style={{ color: warna }}
      >
        {rp(nilai)}
      </p>
      {catatan && <p className="text-[10.5px] muted mt-1.5">{catatan}</p>}
    </div>
  );
}
