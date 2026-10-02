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
  /* piutang dan hutang tidak dibuat dari sini - diurus di halaman Debts */
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
  const [teksKonfirmasi, setTeksKonfirmasi] = useState("");
  const [pilih, setPilih] = useState<string[]>([]);
  const [hapusMassal, setHapusMassal] = useState(false);
  const [teksMassal, setTeksMassal] = useState("");

  const wallets = data?.wallets || [];
  /* Dompet utang/piutang diurus di halaman Debts, bukan di sini. */
  const sendiri = wallets.filter(
    (w) => w.jenis !== "piutang" && w.jenis !== "hutang"
  );
  const aktif = sendiri.filter((w) => w.aktif === 1);
  const nonaktif = sendiri.filter((w) => w.aktif !== 1);
  const totalSaldo = aktif.reduce((a, w) => a + w.saldo, 0);

  /* Dompet yang punya transaksi wajib diketik namanya dulu, supaya tidak
     ada data yang hilang karena salah pencet. */
  const perluKetik = (hapus?.jmlTransaksi || 0) > 0;
  const cocokHapus = !perluKetik || teksKonfirmasi.trim() === hapus?.nama;

  function bukaHapus(w: WalletSaldo) {
    setTeksKonfirmasi("");
    setHapus(w);
  }

  const terpilih = aktif.filter((w) => pilih.includes(w.id));
  const transaksiTerpilih = terpilih.reduce((a, w) => a + w.jmlTransaksi, 0);
  const adaTransaksiTerpilih = transaksiTerpilih > 0;

  function togglePilih(id: string) {
    setPilih((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  async function hapusTerpilih() {
    if (!pilih.length) return;
    setMenghapus(true);
    try {
      const hasil = await api<{ dihapus: number; transaksiTerhapus: number }>(
        "wallet.hapusBanyak",
        { ids: pilih, paksa: true }
      );
      toast.sukses(
        `${hasil.dihapus} wallet(s) deleted` +
          (hasil.transaksiTerhapus
            ? `, ${hasil.transaksiTerhapus} transaction(s) went with them.`
            : ".")
      );
      setPilih([]);
      setHapusMassal(false);
      picuBootstrap();
    } catch (e) {
      toast.gagal(e instanceof ApiError ? e.message : "Could not delete.");
    } finally {
      setMenghapus(false);
    }
  }

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
                  <input
                    type="checkbox"
                    className="w-4 h-4 shrink-0 cursor-pointer"
                    style={{ accentColor: "var(--accent)" }}
                    checked={pilih.includes(w.id)}
                    onChange={() => togglePilih(w.id)}
                    aria-label={`Select ${w.nama}`}
                  />
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
                    onClick={() => bukaHapus(w)}
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
                  onClick={() => bukaHapus(w)}
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
        onTutup={() => {
          setHapus(null);
          setTeksKonfirmasi("");
        }}
        judul="Delete wallet?"
        sub="This cannot be undone."
        lebar={420}
        footer={
          <>
            <button
              className="btn btn-ghost"
              onClick={() => {
                setHapus(null);
                setTeksKonfirmasi("");
              }}
            >
              Cancel
            </button>
            <button
              className="btn btn-danger"
              onClick={hapusPermanen}
              disabled={menghapus || !cocokHapus}
            >
              {menghapus ? "Deleting…" : "Delete"}
            </button>
          </>
        }
      >
        {hapus && (
          <div className="space-y-3 text-[13px] text-2 leading-relaxed">
            <p>
              <b>{hapus.nama}</b> will be removed from the spreadsheet.
            </p>

            <div
              className="rounded-xl p-3.5 space-y-2"
              style={{ background: "var(--surface-2)" }}
            >
              <div className="flex items-center justify-between">
                <span className="muted">Current balance</span>
                <span
                  className="num font-semibold"
                  style={{ color: hapus.saldo < 0 ? "var(--danger)" : undefined }}
                >
                  {rp(hapus.saldo)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="muted">Transactions</span>
                <span className="num font-semibold">{hapus.jmlTransaksi}</span>
              </div>
            </div>

            <p
              className="rounded-xl p-3 font-medium"
              style={{
                background: "color-mix(in srgb, var(--warning) 9%, #fff)",
                color: "var(--warning)",
              }}
            >
              Your total balance will drop by {rp(hapus.saldo)}.
            </p>

            {hapus.jmlTransaksi > 0 ? (
              <p className="muted">
                Its {hapus.jmlTransaksi} transaction
                {hapus.jmlTransaksi === 1 ? "" : "s"} will be deleted too, so
                reports for those months will change.
              </p>
            ) : (
              Math.abs(hapus.saldo) > 0.5 && (
                <p className="muted">
                  This wallet has no transactions. If that money still exists,
                  move it to another wallet first.
                </p>
              )
            )}

            {perluKetik && (
              <div>
                <label className="label">
                  Type <b>{hapus.nama}</b> to confirm
                </label>
                <input
                  className="input"
                  value={teksKonfirmasi}
                  onChange={(e) => setTeksKonfirmasi(e.target.value)}
                  placeholder={hapus.nama}
                  autoComplete="off"
                />
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* bilah hapus massal */}
      {pilih.length > 0 && (
        <div
          className="fixed bottom-5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2.5 px-4 py-2.5 rounded-2xl anim-up"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow)",
          }}
        >
          <span className="text-[12.5px] text-2">{pilih.length} selected</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setPilih([])}>
            Clear
          </button>
          <button
            className="btn btn-danger btn-sm"
            onClick={() => {
              setTeksMassal("");
              setHapusMassal(true);
            }}
          >
            <Trash2 size={13} /> Delete
          </button>
        </div>
      )}

      <Modal
        buka={hapusMassal}
        onTutup={() => setHapusMassal(false)}
        judul={`Delete ${pilih.length} wallet${pilih.length === 1 ? "" : "s"}?`}
        sub="This cannot be undone."
        lebar={460}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setHapusMassal(false)}>
              Cancel
            </button>
            <button
              className="btn btn-danger"
              onClick={hapusTerpilih}
              disabled={
                menghapus ||
                (adaTransaksiTerpilih && teksMassal.trim().toUpperCase() !== "HAPUS")
              }
            >
              {menghapus ? "Deleting…" : "Delete"}
            </button>
          </>
        }
      >
        <div className="space-y-3 text-[13px] text-2 leading-relaxed">
          <div
            className="rounded-xl p-3.5 space-y-2 max-h-[220px] overflow-y-auto"
            style={{ background: "var(--surface-2)" }}
          >
            {terpilih.map((w) => (
              <div key={w.id} className="flex items-center justify-between gap-3">
                <span className="truncate">{w.nama}</span>
                <span className="num font-semibold shrink-0">{rp(w.saldo)}</span>
              </div>
            ))}
          </div>

          {adaTransaksiTerpilih ? (
            <>
              <p
                className="rounded-xl p-3"
                style={{
                  background: "color-mix(in srgb, var(--danger) 7%, #fff)",
                  color: "var(--danger)",
                }}
              >
                {transaksiTerpilih} linked transaction
                {transaksiTerpilih === 1 ? "" : "s"} will be deleted too, so
                reports for those months will change.
              </p>
              <div>
                <label className="label">
                  Ketik <b>HAPUS</b> untuk memastikan
                </label>
                <input
                  className="input"
                  value={teksMassal}
                  onChange={(e) => setTeksMassal(e.target.value)}
                  placeholder="HAPUS"
                  autoComplete="off"
                />
              </div>
            </>
          ) : (
            <p className="muted">
              None of these wallets have transactions.
            </p>
          )}
        </div>
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
