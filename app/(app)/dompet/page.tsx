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
  Trash2,
  Wallet as WalletIcon,
} from "lucide-react";
import { ApiError, api, idBaru } from "@/lib/api";
import { picuBootstrap, useApi } from "@/lib/hooks";
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
import { JENIS_DOMPET_LABEL, rp } from "@/lib/format";
import type { JenisDompet, Wallet } from "@/lib/types";

type WalletSaldo = Wallet & { saldo: number; jmlTransaksi: number };

const JENIS: {
  v: JenisDompet;
  l: string;
  Ikon: React.ComponentType<{ size?: number }>;
}[] = [
  { v: "tunai", l: "Cash", Ikon: Banknote },
  { v: "bank", l: "Bank account", Ikon: Landmark },
  { v: "ewallet", l: "E-Wallet", Ikon: Smartphone },
  { v: "investasi", l: "Investment", Ikon: PiggyBank },
  { v: "piutang", l: "Receivable (owed to me)", Ikon: HandCoins },
  { v: "hutang", l: "Payable (I owe)", Ikon: CreditCard },
  { v: "lainnya", l: "Other", Ikon: WalletIcon },
];

function ikonJenis(jenis: string, size = 16) {
  const Ikon = JENIS.find((j) => j.v === jenis)?.Ikon || WalletIcon;
  return <Ikon size={size} />;
}

export default function HalamanDompet() {
  const toast = useToast();
  const { data, loading, error, reload } = useApi<{ wallets: WalletSaldo[] }>(
    "wallet.list"
  );

  const [form, setForm] = useState<{ buka: boolean; awal: WalletSaldo | null }>({
    buka: false,
    awal: null,
  });
  const [arsip, setArsip] = useState<WalletSaldo | null>(null);
  const [hapus, setHapus] = useState<WalletSaldo | null>(null);
  const [menghapus, setMenghapus] = useState(false);

  const wallets = data?.wallets || [];
  const aktif = wallets.filter((w) => w.aktif === 1);
  const nonaktif = wallets.filter((w) => w.aktif !== 1);
  const totalSaldo = aktif.reduce((a, w) => a + w.saldo, 0);

  async function arsipkan(w: WalletSaldo, paksa: boolean) {
    try {
      await api("wallet.archive", { id: w.id, aktif: w.aktif === 1 ? 0 : 1, paksa });
      toast.sukses(w.aktif === 1 ? "Wallet archived." : "Wallet restored.");
      setArsip(null);
      picuBootstrap();
    } catch (e) {
      if (e instanceof ApiError && !paksa && e.message.includes("still holds")) {
        setArsip(w);
        return;
      }
      toast.gagal(e instanceof ApiError ? e.message : "Could not update wallet.");
    }
  }

  async function hapusPermanen() {
    if (!hapus) return;
    setMenghapus(true);
    try {
      await api("wallet.delete", {
        id: hapus.id,
        paksa: hapus.jmlTransaksi > 0,
      });
      toast.sukses("Wallet deleted.");
      setHapus(null);
      picuBootstrap();
    } catch (e) {
      toast.gagal(e instanceof ApiError ? e.message : "Could not delete wallet.");
    } finally {
      setMenghapus(false);
    }
  }

  return (
    <>
      <PageHeader
        judul="Wallets"
        sub={aktif.length ? `${aktif.length} active · ${rp(totalSaldo)}` : undefined}
        aksi={
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setForm({ buka: true, awal: null })}
          >
            <Plus size={15} strokeWidth={2.6} /> Add wallet
          </button>
        }
      />

      {error && (
        <div className="mb-4">
          <Galat pesan={error.message} onCobaLagi={reload} />
        </div>
      )}

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : aktif.length === 0 ? (
        <div className="card card-lg">
          <Kosong
            ikon={<WalletIcon size={22} />}
            judul="No wallets yet"
            isi="Add your first wallet and set its starting balance."
            aksi={
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setForm({ buka: true, awal: null })}
              >
                <Plus size={15} /> Add wallet
              </button>
            }
          />
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {aktif.map((w) => (
            <div key={w.id} className="card card-lg card-pad anim-up">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="grid place-items-center w-9 h-9 rounded-[10px] shrink-0"
                    style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                  >
                    {ikonJenis(w.jenis)}
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-[14px] truncate title">{w.nama}</p>
                    <p className="text-[11px] muted">
                      {JENIS_DOMPET_LABEL[w.jenis] || w.jenis}
                    </p>
                  </div>
                </div>
                <button
                  className="btn btn-ghost btn-icon btn-sm shrink-0"
                  title="Edit"
                  onClick={() => setForm({ buka: true, awal: w })}
                >
                  <Pencil size={13} />
                </button>
              </div>

              <p
                className="num text-[20px] font-semibold title leading-none"
                style={{ color: w.saldo < 0 ? "var(--danger)" : undefined }}
              >
                {rp(w.saldo)}
              </p>

              <div className="flex items-center justify-between gap-2 mt-3">
                <span className="text-[11px] muted truncate">
                  Start {rp(w.saldo_awal)} · {w.jmlTransaksi}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    className="btn btn-ghost btn-icon btn-sm"
                    onClick={() => setHapus(w)}
                    title="Delete permanently"
                    style={{ color: "var(--danger)" }}
                  >
                    <Trash2 size={13} />
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => arsipkan(w, false)}
                    title="Archive"
                  >
                    <Archive size={12} /> Archive
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {nonaktif.length > 0 && (
        <>
          <h2 className="title text-[14px] mt-7 mb-3">Archived ({nonaktif.length})</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {nonaktif.map((w) => (
              <div key={w.id} className="card card-pad opacity-65 flex items-center gap-3">
                <span
                  className="grid place-items-center w-8 h-8 rounded-[10px] shrink-0"
                  style={{ background: "var(--surface-3)", color: "var(--muted)" }}
                >
                  {ikonJenis(w.jenis, 14)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium truncate">{w.nama}</p>
                  <p className="text-[11px] muted">{rp(w.saldo)}</p>
                </div>
                <button
                  className="btn btn-ghost btn-icon btn-sm shrink-0"
                  title="Restore"
                  onClick={() => arsipkan(w, true)}
                >
                  <ArchiveRestore size={14} />
                </button>
                <button
                  className="btn btn-ghost btn-icon btn-sm shrink-0"
                  title="Delete permanently"
                  style={{ color: "var(--danger)" }}
                  onClick={() => setHapus(w)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <Modal
        buka={form.buka}
        onTutup={() => setForm({ buka: false, awal: null })}
        judul={form.awal ? "Edit wallet" : "Add wallet"}
        lebar={480}
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
        judul="Wallet still has a balance"
        lebar={410}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setArsip(null)}>
              Cancel
            </button>
            <button className="btn btn-danger" onClick={() => arsip && arsipkan(arsip, true)}>
              Archive anyway
            </button>
          </>
        }
      >
        {arsip && (
          <p className="text-[13px] text-2 leading-relaxed">
            <b>{arsip.nama}</b> still holds <b>{rp(arsip.saldo)}</b>. Transfer it
            out first to keep your records accurate.
          </p>
        )}
      </Modal>

      <Modal
        buka={!!hapus}
        onTutup={() => setHapus(null)}
        judul="Delete wallet?"
        sub="This cannot be undone."
        lebar={420}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setHapus(null)}>
              Cancel
            </button>
            <button
              className="btn btn-danger"
              onClick={hapusPermanen}
              disabled={menghapus}
            >
              {menghapus ? "Deleting…" : "Delete"}
            </button>
          </>
        }
      >
        {hapus && (
          <div className="space-y-2.5 text-[13px] text-2 leading-relaxed">
            <p>
              <b>{hapus.nama}</b> will be removed from the spreadsheet.
            </p>
            {hapus.jmlTransaksi > 0 && (
              <p
                className="rounded-xl p-3"
                style={{
                  background: "color-mix(in srgb, var(--danger) 7%, #fff)",
                  color: "var(--danger)",
                }}
              >
                {hapus.jmlTransaksi} transaction
                {hapus.jmlTransaksi === 1 ? "" : "s"} linked to this wallet
                will be deleted too, and the balances will change.
              </p>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}

/* ============================== WALLET FORM =============================== */

function FormDompet({
  awal,
  onSelesai,
  onBatal,
}: {
  awal: WalletSaldo | null;
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
    if (!nama.trim()) return toast.gagal("Enter a wallet name.");

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
      toast.sukses(awal ? "Wallet updated." : "Wallet added.");
      onSelesai();
    } catch (e) {
      toast.gagal(e instanceof ApiError ? e.message : "Could not save wallet.");
    } finally {
      setSedang(false);
    }
  }

  return (
    <div className="space-y-3.5">
      <Field label="Name">
        <input
          className="input"
          value={nama}
          autoFocus
          placeholder="Cash, BCA, OVO…"
          onChange={(e) => setNama(e.target.value)}
        />
      </Field>

      <Field label="Type">
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
        label="Starting balance"
        hint={
          adaTransaksi
            ? "Changing this shifts every balance and report."
            : "The amount in this wallet right now."
        }
      >
        <RupiahInput value={saldoAwal} onChange={setSaldoAwal} />
      </Field>

      <Field label="Note">
        <input
          className="input"
          value={catatan}
          placeholder="Optional"
          onChange={(e) => setCatatan(e.target.value)}
        />
      </Field>

      <div className="flex items-center justify-end gap-2 pt-1">
        <button className="btn btn-ghost" onClick={onBatal} disabled={sedang}>
          Cancel
        </button>
        <button className="btn btn-primary" onClick={simpan} disabled={sedang}>
          {sedang ? "Saving…" : awal ? "Save changes" : "Add wallet"}
        </button>
      </div>
    </div>
  );
}
