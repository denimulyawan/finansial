"use client";

import { useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  HandCoins,
  Plus,
  Wallet as WalletIcon,
} from "lucide-react";
import { ApiError, api } from "@/lib/api";
import { picuBootstrap, picuMuatUlang, useApi } from "@/lib/hooks";
import { useToast } from "@/components/toast";
import {
  Field,
  Galat,
  Kosong,
  Modal,
  PageHeader,
  RupiahInput,
  Skeleton,
} from "@/components/ui";
import { labelTanggal, rp, tanggalHariIni } from "@/lib/format";
import type { Wallet } from "@/lib/types";

type WalletSaldo = Wallet & { saldo: number; jmlTransaksi: number };

type Mode = "piutang-baru" | "hutang-baru" | "terima" | "bayar";

interface Konteks {
  mode: Mode;
  wallet?: WalletSaldo;
}

export default function HalamanHutang() {
  const toast = useToast();
  const { data, loading, error, reload } = useApi<{ wallets: WalletSaldo[] }>(
    "wallet.list"
  );
  const [form, setForm] = useState<Konteks | null>(null);
  const [lunas, setLunas] = useState<WalletSaldo | null>(null);

  const semua = data?.wallets || [];
  const aktif = semua.filter((w) => w.aktif === 1);
  const biasa = aktif.filter((w) => w.jenis !== "piutang" && w.jenis !== "hutang");
  const piutang = aktif.filter((w) => w.jenis === "piutang");
  const hutang = aktif.filter((w) => w.jenis === "hutang");

  const totalPiutang = piutang.reduce((a, w) => a + w.saldo, 0);
  const totalHutang = hutang.reduce((a, w) => a + w.saldo, 0);

  async function arsipkan(w: WalletSaldo) {
    try {
      await api("wallet.archive", { id: w.id, aktif: 0, paksa: true });
      toast.sukses(`${w.nama} dipindahkan ke arsip.`);
      setLunas(null);
      picuBootstrap();
    } catch (e) {
      toast.gagal(e instanceof ApiError ? e.message : "Gagal mengarsipkan.");
    }
  }

  return (
    <>
      <PageHeader
        judul="Hutang & Piutang"
        sub="Uang yang dipinjamkan dan yang kamu pinjam, supaya saldo tetap jujur."
        aksi={
          <>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setForm({ mode: "hutang-baru" })}
            >
              <ArrowDownLeft size={15} /> Saya pinjam
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setForm({ mode: "piutang-baru" })}
            >
              <Plus size={16} strokeWidth={2.6} /> Saya pinjamkan
            </button>
          </>
        }
      />

      {error && (
        <div className="mb-4">
          <Galat pesan={error.message} onCobaLagi={reload} />
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4 mb-5">
        <div className="card card-lg card-pad">
          <div className="flex items-center gap-2.5 mb-3">
            <span
              className="grid place-items-center w-9 h-9 rounded-[10px]"
              style={{
                background: "color-mix(in srgb, var(--success) 13%, transparent)",
                color: "var(--success)",
              }}
            >
              <ArrowUpRight size={17} />
            </span>
            <div>
              <p className="text-[13px] font-semibold">Piutang</p>
              <p className="text-[11.5px] muted">Orang berhutang ke kamu</p>
            </div>
          </div>
          <p className="num text-[22px] font-semibold title leading-none" style={{ color: "var(--success)" }}>
            {rp(totalPiutang)}
          </p>
          <p className="text-[11.5px] muted mt-2">
            {piutang.length} orang belum melunasi
          </p>
        </div>

        <div className="card card-lg card-pad">
          <div className="flex items-center gap-2.5 mb-3">
            <span
              className="grid place-items-center w-9 h-9 rounded-[10px]"
              style={{
                background: "color-mix(in srgb, var(--danger) 13%, transparent)",
                color: "var(--danger)",
              }}
            >
              <ArrowDownLeft size={17} />
            </span>
            <div>
              <p className="text-[13px] font-semibold">Hutang</p>
              <p className="text-[11.5px] muted">Kamu berhutang ke orang</p>
            </div>
          </div>
          <p className="num text-[22px] font-semibold title leading-none" style={{ color: "var(--danger)" }}>
            {rp(Math.abs(totalHutang))}
          </p>
          <p className="text-[11.5px] muted mt-2">
            {hutang.length} hutang belum dibayar
          </p>
        </div>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 gap-4">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-44 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          <DaftarUtang
            judul="Piutang"
            keterangan="Orang yang berhutang ke kamu"
            kosongIsi="Belum ada piutang. Kalau kamu meminjamkan uang ke seseorang, catat di sini supaya saldo dompetmu tetap benar."
            items={piutang}
            jenis="piutang"
            aksiLabel="Terima"
            onAksi={(w) => setForm({ mode: "terima", wallet: w })}
            onTambah={() => setForm({ mode: "piutang-baru" })}
            onLunas={(w) => setLunas(w)}
          />

          <DaftarUtang
            judul="Hutang"
            keterangan="Utangmu ke orang lain"
            kosongIsi="Belum ada hutang tercatat. Kalau kamu meminjam uang, catat di sini supaya pengeluaranmu tidak terlihat lebih besar dari sebenarnya."
            items={hutang}
            jenis="hutang"
            aksiLabel="Bayar"
            onAksi={(w) => setForm({ mode: "bayar", wallet: w })}
            onTambah={() => setForm({ mode: "hutang-baru" })}
            onLunas={(w) => setLunas(w)}
          />
        </div>
      )}

      <Modal
        buka={!!form}
        onTutup={() => setForm(null)}
        judul={judulForm(form?.mode)}
        sub={subForm(form?.mode)}
        lebar={520}
      >
        {form && (
          <FormUtang
            konteks={form}
            walletBiasa={biasa}
            onSelesai={() => {
              setForm(null);
              picuBootstrap();
              picuMuatUlang();
            }}
            onBatal={() => setForm(null)}
          />
        )}
      </Modal>

      <Modal
        buka={!!lunas}
        onTutup={() => setLunas(null)}
        judul="Sudah lunas?"
        lebar={430}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setLunas(null)}>
              Nanti saja
            </button>
            <button
              className="btn btn-primary"
              onClick={() => lunas && arsipkan(lunas)}
            >
              Pindahkan ke arsip
            </button>
          </>
        }
      >
        {lunas && (
          <p className="text-[13.5px] text-2 leading-relaxed">
            <b>{lunas.nama}</b> sudah lunas. Memindahkannya ke arsip membuat daftar
            ini tetap bersih — riwayat transaksinya tetap tersimpan dan bisa
            dilihat di halaman Transaksi.
          </p>
        )}
      </Modal>
    </>
  );
}

function judulForm(mode?: Mode): string {
  switch (mode) {
    case "piutang-baru":
      return "Catat piutang baru";
    case "hutang-baru":
      return "Catat hutang baru";
    case "terima":
      return "Terima pembayaran";
    case "bayar":
      return "Bayar hutang";
    default:
      return "";
  }
}

function subForm(mode?: Mode): string | undefined {
  switch (mode) {
    case "piutang-baru":
      return "Uang keluar dari dompetmu, tapi bukan pengeluaran.";
    case "hutang-baru":
      return "Uang masuk ke dompetmu, tapi bukan pemasukan.";
    case "terima":
      return "Uang kembali ke dompetmu.";
    case "bayar":
      return "Uang keluar dari dompetmu untuk melunasi.";
    default:
      return undefined;
  }
}

/* ============================== DAFTAR UTANG ============================== */

function DaftarUtang({
  judul,
  keterangan,
  kosongIsi,
  items,
  jenis,
  aksiLabel,
  onAksi,
  onTambah,
  onLunas,
}: {
  judul: string;
  keterangan: string;
  kosongIsi: string;
  items: WalletSaldo[];
  jenis: "piutang" | "hutang";
  aksiLabel: string;
  onAksi: (w: WalletSaldo) => void;
  onTambah: () => void;
  onLunas: (w: WalletSaldo) => void;
}) {
  const warna = jenis === "piutang" ? "var(--success)" : "var(--danger)";

  return (
    <div className="card card-lg" >
      <div className="flex items-center justify-between p-5 pb-3">
        <div>
          <h2 className="text-[15px] font-semibold title">{judul}</h2>
          <p className="text-[12.5px] muted mt-0.5">{keterangan}</p>
        </div>
        <button className="btn btn-ghost btn-icon btn-sm" onClick={onTambah} title="Tambah">
          <Plus size={16} />
        </button>
      </div>

      <div className="px-5 pb-5">
        {items.length === 0 ? (
          <Kosong
            ikon={<HandCoins size={24} />}
            judul={`Belum ada ${judul.toLowerCase()}`}
            isi={kosongIsi}
            aksi={
              <button className="btn btn-ghost btn-sm" onClick={onTambah}>
                <Plus size={15} /> Tambah
              </button>
            }
          />
        ) : (
          <div className="space-y-2">
            {items.map((w) => {
              const nominal = jenis === "piutang" ? w.saldo : Math.abs(w.saldo);
              const beres = Math.abs(w.saldo) < 0.5;

              return (
                <div
                  key={w.id}
                  className="rounded-xl p-3.5"
                  style={{ background: "var(--surface-2)" }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="grid place-items-center w-9 h-9 rounded-[10px] shrink-0 font-semibold text-[12.5px]"
                      style={{
                        background: `color-mix(in srgb, ${warna} 13%, transparent)`,
                        color: warna,
                      }}
                    >
                      {w.nama.slice(0, 2).toUpperCase()}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-medium truncate">{w.nama}</p>
                      <p className="text-[11px] muted truncate">
                        {w.jmlTransaksi} transaksi
                        {w.catatan ? ` · ${w.catatan}` : ""}
                      </p>
                    </div>

                    <p
                      className="num font-semibold text-[14px] shrink-0"
                      style={{ color: beres ? "var(--muted)" : warna }}
                    >
                      {rp(nominal)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 mt-3">
                    {beres ? (
                      <button
                        className="btn btn-ghost btn-sm flex-1"
                        onClick={() => onLunas(w)}
                      >
                        <CheckCircle2 size={14} /> Sudah lunas
                      </button>
                    ) : (
                      <button
                        className="btn btn-ghost btn-sm flex-1"
                        onClick={() => onAksi(w)}
                      >
                        {jenis === "piutang" ? (
                          <ArrowDownLeft size={14} />
                        ) : (
                          <ArrowUpRight size={14} />
                        )}
                        {aksiLabel}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* =============================== FORM UTANG =============================== */

function FormUtang({
  konteks,
  walletBiasa,
  onSelesai,
  onBatal,
}: {
  konteks: Konteks;
  walletBiasa: WalletSaldo[];
  onSelesai: () => void;
  onBatal: () => void;
}) {
  const toast = useToast();
  const { mode, wallet } = konteks;

  const butuhNama = mode === "piutang-baru" || mode === "hutang-baru";

  const [nama, setNama] = useState(wallet?.nama || "");
  const [dompetId, setDompetId] = useState(walletBiasa[0]?.id || "");
  const [jumlah, setJumlah] = useState(0);
  const [tanggal, setTanggal] = useState(tanggalHariIni());
  const [catatan, setCatatan] = useState("");
  const [sedang, setSedang] = useState(false);

  async function simpan() {
    if (butuhNama && !nama.trim()) {
      toast.gagal("Nama orangnya wajib diisi.");
      return;
    }
    if (!dompetId) {
      toast.gagal("Pilih dompet dulu. Tambahkan dompet di menu Dompet.");
      return;
    }
    if (!(jumlah > 0)) {
      toast.gagal("Nominal harus lebih dari 0.");
      return;
    }

    setSedang(true);
    try {
      let walletId = wallet?.id || "";

      if (butuhNama) {
        const jenis = mode === "piutang-baru" ? "piutang" : "hutang";
        const hasil = await api<{ wallet: { id: string } }>("wallet.save", {
          wallet: { nama: nama.trim(), jenis, saldo_awal: 0, catatan },
        });
        walletId = hasil.wallet.id;
      }

      let dari = dompetId;
      let ke = walletId;

      if (mode === "hutang-baru" || mode === "bayar") {
        dari = walletId;
        ke = dompetId;
      }

      await api("tx.save", {
        transaction: {
          tipe: "Transfer",
          tanggal,
          jumlah,
          wallet_id: dari,
          wallet_tujuan_id: ke,
          biaya_admin: 0,
          catatan:
            catatan ||
            (mode === "piutang-baru"
              ? "Pinjaman diberikan"
              : mode === "hutang-baru"
                ? "Pinjaman diterima"
                : mode === "terima"
                  ? "Pembayaran piutang"
                  : "Pembayaran hutang"),
        },
      });

      toast.sukses("Tercatat.");
      onSelesai();
    } catch (e) {
      toast.gagal(e instanceof ApiError ? e.message : "Gagal menyimpan.");
    } finally {
      setSedang(false);
    }
  }

  return (
    <div className="space-y-4">
      {butuhNama && (
        <Field label="Nama orang">
          <input
            className="input"
            value={nama}
            autoFocus
            placeholder="Contoh: Budi"
            onChange={(e) => setNama(e.target.value)}
          />
        </Field>
      )}

      {!butuhNama && wallet && (
        <div
          className="rounded-xl p-3.5"
          style={{ background: "var(--surface-2)" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-2">{wallet.nama}</span>
            <span className="num font-semibold text-[14px]">
              {rp(Math.abs(wallet.saldo))}
            </span>
          </div>
        </div>
      )}

      <Field label="Nominal">
        <RupiahInput value={jumlah} onChange={setJumlah} autoFocus={!butuhNama} />
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

        <Field label="Dompet lawan">
          <select
            className="select"
            value={dompetId}
            onChange={(e) => setDompetId(e.target.value)}
          >
            {walletBiasa.length === 0 && <option value="">Belum ada dompet</option>}
            {walletBiasa.map((w) => (
              <option key={w.id} value={w.id}>
                {w.nama}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Catatan" hint="Opsional.">
        <input
          className="input"
          value={catatan}
          placeholder="Contoh: buat modal usaha"
          onChange={(e) => setCatatan(e.target.value)}
        />
      </Field>

      <div
        className="rounded-xl p-3.5 text-[12.5px] text-2 leading-relaxed"
        style={{ background: "var(--surface-2)" }}
      >
        <p className="font-semibold mb-1 flex items-center gap-1.5">
          <WalletIcon size={14} /> Yang terjadi pada saldo
        </p>
        {mode === "piutang-baru" && (
          <p>
            Dompetmu berkurang {rp(jumlah)} dan pindah menjadi piutang. Bukan
            pengeluaran, jadi laporan bulananmu tidak ikut membengkak.
          </p>
        )}
        {mode === "hutang-baru" && (
          <p>
            Dompetmu bertambah {rp(jumlah)} dan muncul hutang {rp(jumlah)}. Bukan
            pemasukan, jadi laporanmu tetap jujur.
          </p>
        )}
        {mode === "terima" && (
          <p>
            Dompetmu bertambah {rp(jumlah)} dan piutang {wallet?.nama} berkurang
            dengan jumlah yang sama.
          </p>
        )}
        {mode === "bayar" && <p>Dompetmu berkurang {rp(jumlah)} untuk melunasi hutang.</p>}
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        <button className="btn btn-ghost" onClick={onBatal} disabled={sedang}>
          Batal
        </button>
        <button className="btn btn-primary" onClick={simpan} disabled={sedang}>
          {sedang ? "Menyimpan…" : "Simpan"}
        </button>
      </div>
    </div>
  );
}
