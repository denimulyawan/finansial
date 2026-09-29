"use client";

import { useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  HandCoins,
  Plus,
} from "lucide-react";
import { ApiError, api, idBaru } from "@/lib/api";
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
      toast.sukses(`${w.nama} archived.`);
      setLunas(null);
      picuBootstrap();
    } catch (e) {
      toast.gagal(e instanceof ApiError ? e.message : "Could not archive.");
    }
  }

  return (
    <>
      <PageHeader
        judul="Debts"
        sub="Money you lent and money you owe"
        aksi={
          <>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setForm({ mode: "hutang-baru" })}
            >
              <ArrowDownLeft size={14} /> I borrow
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setForm({ mode: "piutang-baru" })}
            >
              <Plus size={15} strokeWidth={2.6} /> I lend
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
        <Summary
          judul="Receivable"
          ket="Owed to me"
          nilai={rp(totalPiutang)}
          catatan={`${piutang.length} open`}
          warna="var(--success)"
          Ikon={ArrowUpRight}
        />
        <Summary
          judul="Payable"
          ket="I owe"
          nilai={rp(Math.abs(totalHutang))}
          catatan={`${hutang.length} open`}
          warna="var(--danger)"
          Ikon={ArrowDownLeft}
        />
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
            judul="Receivable"
            items={piutang}
            jenis="piutang"
            aksiLabel="Receive"
            onAksi={(w) => setForm({ mode: "terima", wallet: w })}
            onTambah={() => setForm({ mode: "piutang-baru" })}
            onLunas={(w) => setLunas(w)}
          />
          <DaftarUtang
            judul="Payable"
            items={hutang}
            jenis="hutang"
            aksiLabel="Pay"
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
        lebar={480}
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
        judul="Settled?"
        lebar={400}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setLunas(null)}>
              Not yet
            </button>
            <button className="btn btn-primary" onClick={() => lunas && arsipkan(lunas)}>
              Archive
            </button>
          </>
        }
      >
        {lunas && (
          <p className="text-[13px] text-2 leading-relaxed">
            <b>{lunas.nama}</b> is settled. Archiving keeps this list clean —
            the history stays in Transactions.
          </p>
        )}
      </Modal>
    </>
  );
}

function judulForm(mode?: Mode): string {
  switch (mode) {
    case "piutang-baru":
      return "New receivable";
    case "hutang-baru":
      return "New payable";
    case "terima":
      return "Receive payment";
    case "bayar":
      return "Pay debt";
    default:
      return "";
  }
}

function Summary({
  judul,
  ket,
  nilai,
  catatan,
  warna,
  Ikon,
}: {
  judul: string;
  ket: string;
  nilai: string;
  catatan: string;
  warna: string;
  Ikon: React.ComponentType<{ size?: number }>;
}) {
  return (
    <div className="card card-lg card-pad">
      <div className="flex items-center gap-2.5 mb-3">
        <span
          className="grid place-items-center w-8 h-8 rounded-[9px]"
          style={{
            background: `color-mix(in srgb, ${warna} 11%, transparent)`,
            color: warna,
          }}
        >
          <Ikon size={16} />
        </span>
        <div>
          <p className="text-[13px] font-semibold">{judul}</p>
          <p className="text-[11px] muted">{ket}</p>
        </div>
      </div>
      <p className="num text-[21px] font-semibold title leading-none" style={{ color: warna }}>
        {nilai}
      </p>
      <p className="text-[11px] muted mt-2">{catatan}</p>
    </div>
  );
}

function DaftarUtang({
  judul,
  items,
  jenis,
  aksiLabel,
  onAksi,
  onTambah,
  onLunas,
}: {
  judul: string;
  items: WalletSaldo[];
  jenis: "piutang" | "hutang";
  aksiLabel: string;
  onAksi: (w: WalletSaldo) => void;
  onTambah: () => void;
  onLunas: (w: WalletSaldo) => void;
}) {
  const warna = jenis === "piutang" ? "var(--success)" : "var(--danger)";

  return (
    <div className="card card-lg">
      <div className="flex items-center justify-between p-5 pb-2.5">
        <h2 className="text-[14.5px] font-semibold title">{judul}</h2>
        <button className="btn btn-ghost btn-icon btn-sm" onClick={onTambah} title="Add">
          <Plus size={15} />
        </button>
      </div>

      <div className="px-5 pb-5">
        {items.length === 0 ? (
          <Kosong
            ikon={<HandCoins size={22} />}
            judul="Nothing here"
            aksi={
              <button className="btn btn-ghost btn-sm" onClick={onTambah}>
                <Plus size={14} /> Add
              </button>
            }
          />
        ) : (
          <div className="space-y-1.5">
            {items.map((w) => {
              const nominal = jenis === "piutang" ? w.saldo : Math.abs(w.saldo);
              const beres = Math.abs(w.saldo) < 0.5;

              return (
                <div
                  key={w.id}
                  className="rounded-xl p-3"
                  style={{ background: "var(--surface-2)" }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="grid place-items-center w-8 h-8 rounded-[9px] shrink-0 font-semibold text-[11.5px]"
                      style={{
                        background: `color-mix(in srgb, ${warna} 11%, transparent)`,
                        color: warna,
                      }}
                    >
                      {w.nama.slice(0, 2).toUpperCase()}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium truncate">{w.nama}</p>
                      <p className="text-[10.5px] muted truncate">
                        {w.jmlTransaksi} entries
                        {w.catatan ? ` · ${w.catatan}` : ""}
                      </p>
                    </div>

                    <p
                      className="num font-semibold text-[13.5px] shrink-0"
                      style={{ color: beres ? "var(--muted)" : warna }}
                    >
                      {rp(nominal)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 mt-2.5">
                    {beres ? (
                      <button className="btn btn-ghost btn-sm flex-1" onClick={() => onLunas(w)}>
                        <CheckCircle2 size={13} /> Settled
                      </button>
                    ) : (
                      <button className="btn btn-ghost btn-sm flex-1" onClick={() => onAksi(w)}>
                        {jenis === "piutang" ? (
                          <ArrowDownLeft size={13} />
                        ) : (
                          <ArrowUpRight size={13} />
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

/* ================================== FORM ================================== */

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
    if (butuhNama && !nama.trim()) return toast.gagal("Enter a name.");
    if (!dompetId) return toast.gagal("Add a wallet first.");
    if (!(jumlah > 0)) return toast.gagal("Enter an amount.");

    setSedang(true);
    try {
      let walletId = wallet?.id || "";

      if (butuhNama) {
        const jenis = mode === "piutang-baru" ? "piutang" : "hutang";
        const hasil = await api<{ wallet: { id: string } }>("wallet.save", {
          wallet: { id: idBaru(), nama: nama.trim(), jenis, saldo_awal: 0, catatan },
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
          id: idBaru(),
          tipe: "Transfer",
          tanggal,
          jumlah,
          wallet_id: dari,
          wallet_tujuan_id: ke,
          biaya_admin: 0,
          catatan:
            catatan ||
            (mode === "piutang-baru"
              ? "Loan given"
              : mode === "hutang-baru"
                ? "Loan received"
                : mode === "terima"
                  ? "Receivable payment"
                  : "Payable payment"),
        },
      });

      toast.sukses("Saved.");
      onSelesai();
    } catch (e) {
      toast.gagal(e instanceof ApiError ? e.message : "Could not save.");
    } finally {
      setSedang(false);
    }
  }

  return (
    <div className="space-y-3.5">
      {butuhNama ? (
        <Field label="Person">
          <input
            className="input"
            value={nama}
            autoFocus
            placeholder="Name"
            onChange={(e) => setNama(e.target.value)}
          />
        </Field>
      ) : (
        wallet && (
          <div className="rounded-xl p-3 flex items-center justify-between" style={{ background: "var(--surface-2)" }}>
            <span className="text-[13px] text-2">{wallet.nama}</span>
            <span className="num font-semibold text-[13.5px]">{rp(Math.abs(wallet.saldo))}</span>
          </div>
        )
      )}

      <Field label="Amount">
        <RupiahInput value={jumlah} onChange={setJumlah} autoFocus={!butuhNama} />
      </Field>

      <div className="grid sm:grid-cols-2 gap-3.5">
        <Field label="Date">
          <input
            type="date"
            className="input"
            value={tanggal}
            onChange={(e) => setTanggal(e.target.value)}
          />
        </Field>

        <Field label="Wallet">
          <select className="select" value={dompetId} onChange={(e) => setDompetId(e.target.value)}>
            {walletBiasa.length === 0 && <option value="">No wallet</option>}
            {walletBiasa.map((w) => (
              <option key={w.id} value={w.id}>
                {w.nama}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Note">
        <input
          className="input"
          value={catatan}
          placeholder="Optional"
          onChange={(e) => setCatatan(e.target.value)}
        />
      </Field>

      {!butuhNama && wallet && (
        <p className="text-[11.5px] muted">
          {labelTanggal(tanggal)} · {rp(jumlah)}
        </p>
      )}

      <div className="flex items-center justify-end gap-2 pt-1">
        <button className="btn btn-ghost" onClick={onBatal} disabled={sedang}>
          Cancel
        </button>
        <button className="btn btn-primary" onClick={simpan} disabled={sedang}>
          {sedang ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
