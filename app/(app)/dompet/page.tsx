"use client";

import { useState } from "react";
import {
  Archive,
  ArchiveRestore,
  Banknote,
  CreditCard,
  HandCoins,
  Landmark,
  Pencil,
  PiggyBank,
  Plus,
  Smartphone,
  Wallet as WalletIcon,
} from "lucide-react";
import { ApiError, api, idBaru } from "@/lib/api";
import { picuBootstrap, useApi } from "@/lib/hooks";
import { useToast } from "@/components/toast";
import { Field, Galat, Kosong, Modal, PageHeader, RupiahInput, Skeleton } from "@/components/ui";
import { JENIS_DOMPET_LABEL, rp } from "@/lib/format";
import type { JenisDompet, Wallet } from "@/lib/types";

type WalletDenganSaldo = Wallet & { saldo: number; jmlTransaksi: number };

const JENIS: { v: JenisDompet; l: string; Ikon: React.ComponentType<{ size?: number }> }[] = [
  { v: "tunai", l: "Tunai", Ikon: Banknote },
  { v: "bank", l: "Rekening Bank", Ikon: Landmark },
  { v: "ewallet", l: "E-Wallet", Ikon: Smartphone },
  { v: "investasi", l: "Investasi", Ikon: PiggyBank },
  { v: "piutang", l: "Piutang (orang berhutang ke saya)", Ikon: HandCoins },
  { v: "hutang", l: "Hutang (saya berhutang)", Ikon: CreditCard },
  { v: "lainnya", l: "Lainnya", Ikon: WalletIcon },
];

function ikonJenis(jenis: string, size = 17) {
  const Ikon = JENIS.find((j) => j.v === jenis)?.Ikon || WalletIcon;
  return <Ikon size={size} />;
}

export default function HalamanDompet() {
  const toast = useToast();
  const { data, loading, error, reload } = useApi<{ wallets: WalletDenganSaldo[] }>(
    "wallet.list"
  );

  const [form, setForm] = useState<{ buka: boolean; awal: WalletDenganSaldo | null }>({
    buka: false,
    awal: null,
  });
  const [arsip, setArsip] = useState<WalletDenganSaldo | null>(null);

  const wallets = data?.wallets || [];
  const aktif = wallets.filter((w) => w.aktif === 1);
  const nonaktif = wallets.filter((w) => w.aktif !== 1);
  const totalSaldo = aktif.reduce((a, w) => a + w.saldo, 0);

  async function arsipkan(w: WalletDenganSaldo, paksa: boolean) {
    try {
      await api("wallet.archive", { id: w.id, aktif: w.aktif === 1 ? 0 : 1, paksa });
      toast.sukses(w.aktif === 1 ? "Dompet diarsipkan." : "Dompet diaktifkan lagi.");
      setArsip(null);
      picuBootstrap();
    } catch (e) {
      if (e instanceof ApiError && !paksa && e.message.includes("Saldo")) {
        setArsip(w);
        toast.gagal(e.message + " Klik arsipkan paksa kalau tetap ingin diarsipkan.");
        return;
      }
      toast.gagal(e instanceof ApiError ? e.message : "Gagal mengubah dompet.");
    }
  }

  return (
    <>
      <PageHeader
        judul="Dompet"
        sub={
          aktif.length
            ? `${aktif.length} dompet aktif · total ${rp(totalSaldo)}`
            : "Kelola tempat uangmu disimpan"
        }
        aksi={
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setForm({ buka: true, awal: null })}
          >
            <Plus size={16} strokeWidth={2.6} /> Tambah dompet
          </button>
        }
      />

      {error && (
        <div className="mb-4">
          <Galat pesan={error.message} onCobaLagi={reload} />
        </div>
      )}

      <div
        className="rounded-2xl p-4 mb-5 text-[13px] leading-relaxed"
        style={{
          background: "var(--accent-soft)",
          border: "1px solid color-mix(in srgb, var(--accent) 20%, transparent)",
        }}
      >
        <p className="font-semibold mb-0.5" style={{ color: "var(--accent)" }}>
          Soal saldo awal
        </p>
        <p className="text-2">
          Saldo awal adalah isi dompet ini <b>saat kamu mulai mencatat</b>. Isi
          sekali saja dengan kondisi sebenarnya, lalu jangan diubah lagi — semua
          transaksi setelahnya menghitung dari angka ini.
        </p>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : aktif.length === 0 ? (
        <div className="card card-lg">
          <Kosong
            ikon={<WalletIcon size={24} />}
            judul="Belum ada dompet aktif"
            isi="Tambahkan dompet pertamamu — misalnya Tunai, lalu isi saldo awalnya."
            aksi={
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setForm({ buka: true, awal: null })}
              >
                <Plus size={16} /> Tambah dompet
              </button>
            }
          />
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {aktif.map((w) => (
            <div key={w.id} className="card card-lg card-pad anim-up">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="grid place-items-center w-10 h-10 rounded-xl shrink-0"
                    style={{
                      background: "var(--accent-soft)",
                      color: "var(--accent)",
                    }}
                  >
                    {ikonJenis(w.jenis)}
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-[14.5px] truncate title">
                      {w.nama}
                    </p>
                    <p className="text-[11.5px] muted">
                      {JENIS_DOMPET_LABEL[w.jenis] || w.jenis}
                    </p>
                  </div>
                </div>
                <button
                  className="btn btn-ghost btn-icon btn-sm shrink-0"
                  title="Ubah dompet"
                  onClick={() => setForm({ buka: true, awal: w })}
                >
                  <Pencil size={14} />
                </button>
              </div>

              <p
                className="num text-[21px] font-semibold title leading-none"
                style={{ color: w.saldo < 0 ? "var(--danger)" : undefined }}
              >
                {rp(w.saldo)}
              </p>

              <div className="flex items-center justify-between mt-3.5">
                <span className="text-[11.5px] muted">
                  Saldo awal {rp(w.saldo_awal)} · {w.jmlTransaksi} transaksi
                </span>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => arsipkan(w, false)}
                  title="Arsipkan dompet"
                >
                  <Archive size={13} /> Arsip
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {nonaktif.length > 0 && (
        <>
          <h2 className="title text-[15px] mt-8 mb-3">
            Diarsipkan ({nonaktif.length})
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {nonaktif.map((w) => (
              <div
                key={w.id}
                className="card card-pad opacity-70 flex items-center gap-3"
              >
                <span
                  className="grid place-items-center w-9 h-9 rounded-xl shrink-0"
                  style={{ background: "var(--surface-3)", color: "var(--muted)" }}
                >
                  {ikonJenis(w.jenis, 15)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-medium truncate">{w.nama}</p>
                  <p className="text-[11.5px] muted">{rp(w.saldo)}</p>
                </div>
                <button
                  className="btn btn-ghost btn-icon btn-sm shrink-0"
                  title="Aktifkan lagi"
                  onClick={() => arsipkan(w, true)}
                >
                  <ArchiveRestore size={15} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <Modal
        buka={form.buka}
        onTutup={() => setForm({ buka: false, awal: null })}
        judul={form.awal ? "Ubah dompet" : "Tambah dompet"}
        lebar={520}
      >
        <FormDompet
          awal={form.awal}
          onSelesai={() => {
            setForm({ buka: false, awal: null });
            picuBootstrap();
          }}
          onBatal={() => setForm({ buka: false, awal: null })}
        />
      </Modal>

      <Modal
        buka={!!arsip && arsip.aktif === 1 && Math.abs(arsip.saldo) > 0.5}
        onTutup={() => setArsip(null)}
        judul="Saldo dompet belum kosong"
        lebar={430}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setArsip(null)}>
              Batal
            </button>
            <button
              className="btn btn-danger"
              onClick={() => arsip && arsipkan(arsip, true)}
            >
              Arsipkan paksa
            </button>
          </>
        }
      >
        {arsip && (
          <p className="text-[13.5px] text-2 leading-relaxed">
            Dompet <b>{arsip.nama}</b> masih bersaldo <b>{rp(arsip.saldo)}</b>.
            Sebaiknya transfer dulu isinya ke dompet lain supaya catatanmu tetap
            akurat.
          </p>
        )}
      </Modal>
    </>
  );
}

/* ============================== FORM DOMPET =============================== */

function FormDompet({
  awal,
  onSelesai,
  onBatal,
}: {
  awal: WalletDenganSaldo | null;
  onSelesai: () => void;
  onBatal: () => void;
}) {
  const toast = useToast();
  const [nama, setNama] = useState(awal?.nama || "");
  const [jenis, setJenis] = useState<JenisDompet>(awal?.jenis || "tunai");
  const [saldoAwal, setSaldoAwal] = useState<number>(awal?.saldo_awal || 0);
  const [catatan, setCatatan] = useState(awal?.catatan || "");
  const [sedang, setSedang] = useState(false);

  const adaTransaksi = (awal?.jmlTransaksi || 0) > 0;

  async function simpan() {
    if (!nama.trim()) {
      toast.gagal("Nama dompet wajib diisi.");
      return;
    }
    if (adaTransaksi && jenis === "piutang" && awal?.jenis !== "piutang") {
      toast.gagal("Jenis dompet tidak bisa diubah karena sudah ada transaksi.");
      return;
    }

    setSedang(true);
    try {
      await api("wallet.save", {
        wallet: {
          id: awal?.id || idBaru(),
          nama,
          jenis,
          saldo_awal: saldoAwal,
          catatan,
        },
      });
      toast.sukses(awal ? "Dompet diperbarui." : "Dompet ditambahkan.");
      onSelesai();
    } catch (e) {
      toast.gagal(e instanceof ApiError ? e.message : "Gagal menyimpan dompet.");
    } finally {
      setSedang(false);
    }
  }

  return (
    <div className="space-y-4">
      <Field label="Nama dompet">
        <input
          className="input"
          value={nama}
          autoFocus
          placeholder="Contoh: Tunai, BCA, OVO"
          onChange={(e) => setNama(e.target.value)}
        />
      </Field>

      <Field label="Jenis">
        <select
          className="select"
          value={jenis}
          onChange={(e) => setJenis(e.target.value as JenisDompet)}
        >
          {JENIS.map((j) => (
            <option key={j.v} value={j.v}>
              {j.l}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label="Saldo awal"
        hint={
          adaTransaksi
            ? "Dompet ini sudah punya transaksi. Mengubah saldo awal akan menggeser semua saldo dan laporan."
            : "Isi dengan jumlah uang yang ada di dompet ini sekarang."
        }
      >
        <RupiahInput value={saldoAwal} onChange={setSaldoAwal} />
      </Field>

      <Field label="Catatan" hint="Opsional.">
        <input
          className="input"
          value={catatan}
          placeholder="Contoh: rekening gaji"
          onChange={(e) => setCatatan(e.target.value)}
        />
      </Field>

      <div className="flex items-center justify-end gap-2 pt-2">
        <button className="btn btn-ghost" onClick={onBatal} disabled={sedang}>
          Batal
        </button>
        <button className="btn btn-primary" onClick={simpan} disabled={sedang}>
          {sedang ? "Menyimpan…" : awal ? "Simpan perubahan" : "Tambah dompet"}
        </button>
      </div>
    </div>
  );
}
