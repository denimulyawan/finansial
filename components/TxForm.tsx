"use client";

import { useState } from "react";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Loader2,
  Save,
} from "lucide-react";
import { ApiError, api, idBaru } from "@/lib/api";
import { picuMuatUlang } from "@/lib/hooks";
import { Field, RupiahInput } from "@/components/ui";
import { useToast } from "@/components/toast";
import { labelTanggal, rp, tanggalHariIni } from "@/lib/format";
import type { Category, Tipe, Tx, Wallet } from "@/lib/types";

/*
 * Ini kontrol paling menentukan di seluruh aplikasi: salah memilih jenis
 * membuat semua laporan ikut salah. Nilainya sudah bahasa Indonesia sejak
 * awal, jadi labelnya disamakan supaya tidak ada dua bahasa di satu tombol.
 */
const TIPE = [
  { v: "Pemasukan", label: "Pemasukan", Ikon: ArrowDownLeft, warna: "var(--success)" },
  { v: "Pengeluaran", label: "Pengeluaran", Ikon: ArrowUpRight, warna: "var(--danger)" },
  { v: "Transfer", label: "Transfer", Ikon: ArrowLeftRight, warna: "var(--info)" },
] as const;

export default function TxForm({
  wallets,
  categories,
  awal,
  onSelesai,
  onBatal,
}: {
  wallets: Wallet[];
  categories: Category[];
  awal?: Tx | null;
  onSelesai: () => void;
  onBatal: () => void;
}) {
  const toast = useToast();

  const [tipe, setTipe] = useState<Tipe>(awal?.tipe || "Pengeluaran");
  const [tanggal, setTanggal] = useState(awal?.tanggal || tanggalHariIni());
  const [jumlah, setJumlah] = useState<number>(awal?.jumlah || 0);
  const [walletId, setWalletId] = useState(awal?.wallet_id || wallets[0]?.id || "");
  const [walletTujuan, setWalletTujuan] = useState(awal?.wallet_tujuan_id || "");
  const [categoryId, setCategoryId] = useState(awal?.category_id || "");
  const [biayaAdmin, setBiayaAdmin] = useState<number>(awal?.biaya_admin || 0);
  const [catatan, setCatatan] = useState(awal?.catatan || "");
  const [sedang, setSedang] = useState(false);

  const transfer = tipe === "Transfer";
  const kategoriTersedia = categories.filter((c) => c.tipe === tipe && c.sistem !== 1);
  const walletTujuanTersedia = wallets.filter((w) => w.id !== walletId);

  async function simpan() {
    if (!(jumlah > 0)) return toast.gagal("Enter an amount.");
    if (!walletId) return toast.gagal("Select a wallet.");
    if (transfer && !walletTujuan) return toast.gagal("Select a destination wallet.");
    if (!transfer && !categoryId) return toast.gagal("Select a category.");

    setSedang(true);
    try {
      const hasil = await api<{ notif?: { terkirim?: number } }>("tx.save", {
        transaction: {
          id: awal?.id || idBaru(),
          tipe,
          tanggal,
          jumlah,
          wallet_id: walletId,
          wallet_tujuan_id: transfer ? walletTujuan : "",
          category_id: transfer ? "" : categoryId,
          biaya_admin: transfer ? biayaAdmin : 0,
          catatan,
        },
      });

      toast.sukses(awal ? "Transaction updated." : "Transaction saved.");
      if (hasil?.notif?.terkirim) toast.info("Budget alert sent to Telegram.");
      picuMuatUlang();
      onSelesai();
    } catch (e) {
      toast.gagal(e instanceof ApiError ? e.message : "Could not save.");
    } finally {
      setSedang(false);
    }
  }

  const keluar = jumlah + (transfer ? biayaAdmin : 0);

  return (
    <div className="space-y-3.5">
      {/* type */}
      <div className="grid grid-cols-3 gap-1 p-1 rounded-xl" style={{ background: "var(--surface-2)" }}>
        {TIPE.map((o) => {
          const aktif = tipe === o.v;
          const Ikon = o.Ikon;
          return (
            <button
              key={o.v}
              type="button"
              onClick={() => {
                setTipe(o.v);
                setCategoryId("");
                setBiayaAdmin(0);
                setWalletTujuan("");
              }}
              className="flex items-center justify-center gap-1.5 h-9 rounded-[9px] text-[13px] font-semibold transition"
              style={{
                background: aktif ? "var(--surface)" : "transparent",
                color: aktif ? o.warna : "var(--muted)",
                boxShadow: aktif ? "var(--shadow-xs)" : "none",
              }}
            >
              <Ikon size={15} strokeWidth={2.5} />
              {o.label}
            </button>
          );
        })}
      </div>

      {/* amount + date */}
      <div className="grid sm:grid-cols-2 gap-3.5">
        <Field label="Amount">
          <RupiahInput value={jumlah} onChange={setJumlah} autoFocus />
        </Field>
        <Field label="Date">
          <input
            type="date"
            className="input"
            value={tanggal}
            onChange={(e) => setTanggal(e.target.value)}
          />
        </Field>
      </div>

      {/* wallets */}
      <div className="grid sm:grid-cols-2 gap-3.5">
        <Field label={transfer ? "From" : "Wallet"}>
          <select
            className="select"
            value={walletId}
            onChange={(e) => {
              setWalletId(e.target.value);
              if (e.target.value === walletTujuan) setWalletTujuan("");
            }}
          >
            {wallets.length === 0 && <option value="">No wallet</option>}
            {wallets.map((w) => (
              <option key={w.id} value={w.id}>
                {w.nama}
              </option>
            ))}
          </select>
        </Field>

        {transfer ? (
          <Field label="To">
            <select
              className="select"
              value={walletTujuan}
              onChange={(e) => setWalletTujuan(e.target.value)}
            >
              <option value="">Select wallet</option>
              {walletTujuanTersedia.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.nama}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <Field label="Category">
            <select
              className="select"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">Select category</option>
              {kategoriTersedia.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nama}
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>

      {transfer && (
        <div className="grid sm:grid-cols-2 gap-3.5">
          <Field label="Admin fee">
            <RupiahInput value={biayaAdmin} onChange={setBiayaAdmin} />
          </Field>
          <div className="flex items-end">
            <div
              className="w-full rounded-[10px] px-3 flex items-center justify-between text-[12.5px]"
              style={{ height: 40, background: "var(--surface-2)" }}
            >
              <span className="muted">Total out</span>
              <span className="num font-semibold">{rp(keluar)}</span>
            </div>
          </div>
        </div>
      )}

      <Field label="Note">
        <textarea
          className="textarea"
          style={{ minHeight: 56 }}
          value={catatan}
          onChange={(e) => setCatatan(e.target.value)}
          placeholder="Optional"
        />
      </Field>

      {awal && (
        <p className="text-[11.5px] muted">
          Recorded {labelTanggal(awal.tanggal)}
        </p>
      )}

      <div className="flex items-center justify-end gap-2 pt-1">
        <button className="btn btn-ghost" onClick={onBatal} disabled={sedang}>
          Cancel
        </button>
        <button className="btn btn-primary" onClick={simpan} disabled={sedang}>
          {sedang ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          {awal ? "Save changes" : "Save"}
        </button>
      </div>
    </div>
  );
}
