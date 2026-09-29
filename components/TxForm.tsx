"use client";

import { useState } from "react";
import {
  ArrowLeftRight,
  ArrowDownLeft,
  ArrowUpRight,
  Loader2,
  Save,
} from "lucide-react";
import { ApiError, api, idBaru } from "@/lib/api";
import { picuMuatUlang } from "@/lib/hooks";
import { Field, RupiahInput } from "@/components/ui";
import { useToast } from "@/components/toast";
import { tanggalHariIni } from "@/lib/format";
import type { Category, Tipe, Tx, Wallet } from "@/lib/types";

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
  const [walletId, setWalletId] = useState(
    awal?.wallet_id || wallets[0]?.id || ""
  );
  const [walletTujuan, setWalletTujuan] = useState(
    awal?.wallet_tujuan_id || ""
  );
  const [categoryId, setCategoryId] = useState(awal?.category_id || "");
  const [biayaAdmin, setBiayaAdmin] = useState<number>(awal?.biaya_admin || 0);
  const [catatan, setCatatan] = useState(awal?.catatan || "");
  const [sedang, setSedang] = useState(false);

  const kategoriTersedia = categories.filter(
    (c) => c.tipe === tipe && c.sistem !== 1
  );

  const walletTujuanTersedia = wallets.filter((w) => w.id !== walletId);

  async function simpan() {
    if (!(jumlah > 0)) {
      toast.gagal("Nominal harus lebih dari 0.");
      return;
    }
    if (!walletId) {
      toast.gagal("Pilih dompet dulu.");
      return;
    }
    if (tipe === "Transfer" && !walletTujuan) {
      toast.gagal("Pilih dompet tujuan.");
      return;
    }
    if (tipe !== "Transfer" && !categoryId) {
      toast.gagal("Pilih kategori dulu.");
      return;
    }

    setSedang(true);
    try {
      const hasil = await api<{ notif?: { terkirim?: number } }>("tx.save", {
        transaction: {
          id: awal?.id || idBaru(),
          tipe,
          tanggal,
          jumlah,
          wallet_id: walletId,
          wallet_tujuan_id: tipe === "Transfer" ? walletTujuan : "",
          category_id: tipe === "Transfer" ? "" : categoryId,
          biaya_admin: tipe === "Transfer" ? biayaAdmin : 0,
          catatan,
        },
      });

      toast.sukses(awal ? "Transaksi diperbarui." : "Transaksi tersimpan.");
      if (hasil?.notif?.terkirim) {
        toast.info("Peringatan budget dikirim ke Telegram.");
      }
      picuMuatUlang();
      onSelesai();
    } catch (e) {
      toast.gagal(e instanceof ApiError ? e.message : "Gagal menyimpan transaksi.");
    } finally {
      setSedang(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* pemilih tipe */}
      <div
        className="grid grid-cols-3 gap-1 p-1 rounded-xl"
        style={{ background: "var(--surface-3)" }}
      >
        {(
          [
            { v: "Pemasukan", l: "Pemasukan", i: ArrowDownLeft, w: "var(--success)" },
            { v: "Pengeluaran", l: "Pengeluaran", i: ArrowUpRight, w: "var(--danger)" },
            { v: "Transfer", l: "Transfer", i: ArrowLeftRight, w: "var(--info)" },
          ] as const
        ).map((o) => {
          const aktif = tipe === o.v;
          const Ikon = o.i;
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
                color: aktif ? o.w : "var(--muted)",
                boxShadow: aktif ? "var(--shadow-sm)" : "none",
              }}
            >
              <Ikon size={15} strokeWidth={2.5} />
              <span className="hidden sm:inline">{o.l}</span>
              <span className="sm:hidden">{o.l.slice(0, 4)}</span>
            </button>
          );
        })}
      </div>

      {/* nominal */}
      <Field label="Nominal">
        <RupiahInput value={jumlah} onChange={setJumlah} autoFocus />
      </Field>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Tanggal">
          <input
            type="date"
            className="input"
            value={tanggal}
            onChange={(e) => setTanggal(e.target.value)}
          />
        </Field>

        <Field label={tipe === "Transfer" ? "Dari dompet" : "Dompet"}>
          <select
            className="select"
            value={walletId}
            onChange={(e) => {
              setWalletId(e.target.value);
              if (e.target.value === walletTujuan) setWalletTujuan("");
            }}
          >
            {wallets.length === 0 && <option value="">Belum ada dompet</option>}
            {wallets.map((w) => (
              <option key={w.id} value={w.id}>
                {w.nama}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {tipe === "Transfer" ? (
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Ke dompet">
            <select
              className="select"
              value={walletTujuan}
              onChange={(e) => setWalletTujuan(e.target.value)}
            >
              <option value="">Pilih dompet tujuan</option>
              {walletTujuanTersedia.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.nama}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Biaya admin"
            hint="Kosongkan kalau tidak ada. Biaya ini dihitung sebagai pengeluaran."
          >
            <RupiahInput value={biayaAdmin} onChange={setBiayaAdmin} />
          </Field>
        </div>
      ) : (
        <Field label="Kategori">
          <select
            className="select"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">Pilih kategori</option>
            {kategoriTersedia.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nama}
              </option>
            ))}
          </select>
        </Field>
      )}

      <Field label="Catatan" hint="Opsional, misalnya tempat atau keterangan.">
        <textarea
          className="textarea"
          value={catatan}
          onChange={(e) => setCatatan(e.target.value)}
          placeholder="Contoh: makan siang bareng tim"
        />
      </Field>

      {tipe === "Transfer" && jumlah > 0 && (
        <div
          className="rounded-xl p-3.5 text-[13px]"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
        >
          <RincianTransfer
            jumlah={jumlah}
            biaya={biayaAdmin}
            wallets={wallets}
            dari={walletId}
            ke={walletTujuan}
          />
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-2">
        <button className="btn btn-ghost" onClick={onBatal} disabled={sedang}>
          Batal
        </button>
        <button className="btn btn-primary" onClick={simpan} disabled={sedang}>
          {sedang ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {awal ? "Simpan perubahan" : "Simpan"}
        </button>
      </div>
    </div>
  );
}

function RincianTransfer({
  jumlah,
  biaya,
  wallets,
  dari,
  ke,
}: {
  jumlah: number;
  biaya: number;
  wallets: Wallet[];
  dari: string;
  ke: string;
}) {
  const namaDari = wallets.find((w) => w.id === dari)?.nama || "—";
  const namaKe = wallets.find((w) => w.id === ke)?.nama || "belum dipilih";

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between">
        <span className="muted">Dari {namaDari} berkurang</span>
        <span className="num font-semibold">{rpRingkas(jumlah + biaya)}</span>
      </div>
      <div className="flex justify-between">
        <span className="muted">{namaKe} bertambah</span>
        <span className="num font-semibold" style={{ color: "var(--success)" }}>
          {rpRingkas(jumlah)}
        </span>
      </div>
      {biaya > 0 && (
        <div className="flex justify-between">
          <span className="muted">Biaya admin (pengeluaran)</span>
          <span className="num" style={{ color: "var(--kritis)" }}>
            {rpRingkas(biaya)}
          </span>
        </div>
      )}
    </div>
  );
}

function rpRingkas(n: number) {
  const s = String(Math.round(n));
  let out = "";
  for (let i = s.length; i > 3; i -= 3) out = "." + s.slice(i - 3, i) + out;
  return "Rp " + s.slice(0, ((s.length - 1) % 3) + 1) + out;
}
