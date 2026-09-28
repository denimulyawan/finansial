"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  PiggyBank,
  Plus,
  Receipt,
  Target,
  TrendingDown,
  TrendingUp,
  Wallet as WalletIcon,
} from "lucide-react";
import { useApi } from "@/lib/hooks";
import { useAuth } from "@/components/auth";
import { DonutKategori, TrenChart } from "@/components/charts";
import {
  Card,
  Galat,
  Kosong,
  LevelBadge,
  PageHeader,
  Progress,
  PilihBulan,
  Skeleton,
} from "@/components/ui";
import TxForm from "@/components/TxForm";
import { Modal } from "@/components/ui";
import {
  JENIS_DOMPET_LABEL,
  bulanSekarang,
  labelBulanPanjang,
  labelTanggalRelatif,
  persen,
  rp,
} from "@/lib/format";
import type { DashboardData, Tx } from "@/lib/types";

export default function HalamanDashboard() {
  const { bootstrap } = useAuth();
  const [bulan, setBulan] = useState(bulanSekarang());
  const [cepat, setCepat] = useState(false);

  const { data, loading, error, reload } = useApi<DashboardData>("dashboard", {
    bulan,
  });

  return (
    <>
      <PageHeader
        judul="Dashboard"
        sub={
          data
            ? `Ringkasan ${labelBulanPanjang(data.bulan)}`
            : "Ringkasan keuanganmu"
        }
        aksi={<PilihBulan nilai={bulan} onUbah={setBulan} />}
      />

      {error && (
        <div className="mb-5">
          <Galat pesan={error.message} onCobaLagi={reload} />
        </div>
      )}

      {/* ------------------------ 4 kartu angka ------------------------ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
        <KartuSisaBudget data={data} loading={loading} />
        <KartuAngka
          label="Pengeluaran"
          nilai={data?.ringkasan.keluar}
          loading={loading}
          warna="var(--danger)"
          Ikon={ArrowUpRight}
          sub={
            data && data.ringkasan.biayaAdmin > 0
              ? `termasuk ${rp(data.ringkasan.biayaAdmin)} biaya admin`
              : undefined
          }
        />
        <KartuAngka
          label="Pemasukan"
          nilai={data?.ringkasan.masuk}
          loading={loading}
          warna="var(--success)"
          Ikon={ArrowDownLeft}
        />
        <KartuAngka
          label="Total Saldo"
          nilai={data?.totalSaldo}
          loading={loading}
          warna="var(--accent)"
          Ikon={WalletIcon}
          sub={
            data ? `${data.saldoDompet.length} dompet aktif` : undefined
          }
        />
      </div>

      {/* --------------------------- grafik tren --------------------------- */}
      <Card className="mb-4" besar>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-[15px] font-semibold title">Tren 6 Bulan</h2>
            <p className="text-[12.5px] muted mt-0.5">
              Pemasukan dan pengeluaran tiap bulan
            </p>
          </div>
          <div className="flex items-center gap-4 text-[12.5px]">
            <Legenda warna="var(--success)" label="Pemasukan" />
            <Legenda warna="var(--danger)" label="Pengeluaran" />
          </div>
        </div>
        {loading || !data ? (
          <Skeleton className="w-full" />
        ) : (
          <TrenChart data={data.tren} />
        )}
      </Card>

      {/* ------------------- donut kategori + progress budget ------------------- */}
      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <Card besar>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-[15px] font-semibold title">
                Pengeluaran per Kategori
              </h2>
              <p className="text-[12.5px] muted mt-0.5">
                {labelBulanPanjang(bulan)}
              </p>
            </div>
            <Link href="/laporan" className="btn btn-ghost btn-sm">
              Laporan
            </Link>
          </div>

          {loading || !data ? (
            <Skeleton className="w-full" />
          ) : (
            <>
              <DonutKategori
                data={data.perKategori}
                total={data.perKategori.reduce((a, b) => a + b.jumlah, 0)}
              />
              <div className="mt-4 space-y-2">
                {data.perKategori.slice(0, 5).map((k) => (
                  <div key={k.id} className="flex items-center gap-3 text-[13px]">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: k.warna }}
                    />
                    <span className="flex-1 truncate text-2">{k.nama}</span>
                    <span className="num font-semibold">{rp(k.jumlah)}</span>
                  </div>
                ))}
                {data.perKategori.length === 0 && (
                  <p className="text-[13px] muted text-center py-2">
                    Belum ada pengeluaran bulan ini
                  </p>
                )}
              </div>
            </>
          )}
        </Card>

        <Card besar>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-[15px] font-semibold title">Status Budget</h2>
              <p className="text-[12.5px] muted mt-0.5">
                Aman &lt;70% · Warning 70% · Kritis 90% · Over 100%
              </p>
            </div>
            <Link href="/budget" className="btn btn-ghost btn-sm">
              Atur
            </Link>
          </div>

          {loading || !data ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !data.budgets.items.length && !data.budgets.total ? (
            <Kosong
              ikon={<Target size={24} />}
              judul="Budget belum diatur"
              isi="Tetapkan batas pengeluaran per kategori dan total bulanan supaya kamu dapat peringatan sebelum kebobolan."
              aksi={
                <Link href="/budget" className="btn btn-primary btn-sm">
                  Atur budget sekarang
                </Link>
              }
            />
          ) : (
            <div className="space-y-4 max-h-[330px] overflow-y-auto pr-1">
              {data.budgets.total && (
                <BarisBudget
                  nama="Total Bulanan"
                  warna="var(--accent)"
                  batas={data.budgets.total.batas}
                  terpakai={data.budgets.total.terpakai}
                  persen={data.budgets.total.persen}
                  level={data.budgets.total.level}
                  tebal
                />
              )}
              {data.budgets.items.map((b) => (
                <BarisBudget
                  key={b.categoryId}
                  nama={b.nama}
                  warna={b.warna}
                  batas={b.batas}
                  terpakai={b.terpakai}
                  persen={b.persen}
                  level={b.level}
                />
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* ------------------- saldo dompet + transaksi terakhir ------------------- */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card besar pad={false}>
          <div className="flex items-center justify-between p-5 pb-3">
            <h2 className="text-[15px] font-semibold title">Saldo Dompet</h2>
            <Link href="/dompet" className="btn btn-ghost btn-sm">
              Kelola
            </Link>
          </div>
          <div className="px-5 pb-5">
            {loading || !data ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : data.saldoDompet.length === 0 ? (
              <Kosong
                ikon={<WalletIcon size={24} />}
                judul="Belum ada dompet"
                isi="Tambahkan dompet pertamamu: tunai, rekening bank, atau e-wallet."
                aksi={
                  <Link href="/dompet" className="btn btn-primary btn-sm">
                    Tambah dompet
                  </Link>
                }
              />
            ) : (
              <div className="space-y-2">
                {data.saldoDompet.map((w) => (
                  <div
                    key={w.id}
                    className="flex items-center gap-3 p-3 rounded-xl"
                    style={{ background: "var(--surface-2)" }}
                  >
                    <span
                      className="grid place-items-center w-9 h-9 rounded-[10px] shrink-0"
                      style={{
                        background: "var(--accent-soft)",
                        color: "var(--accent)",
                      }}
                    >
                      {w.jenis === "piutang" || w.jenis === "hutang" ? (
                        <ArrowLeftRight size={16} />
                      ) : (
                        <WalletIcon size={16} />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-medium truncate">{w.nama}</p>
                      <p className="text-[11.5px] muted">
                        {JENIS_DOMPET_LABEL[w.jenis] || w.jenis}
                      </p>
                    </div>
                    <p
                      className="num font-semibold text-[14px]"
                      style={{ color: w.saldo < 0 ? "var(--danger)" : undefined }}
                    >
                      {rp(w.saldo)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card besar pad={false}>
          <div className="flex items-center justify-between p-5 pb-3">
            <h2 className="text-[15px] font-semibold title">Transaksi Terakhir</h2>
            <Link href="/transaksi" className="btn btn-ghost btn-sm">
              Lihat semua
            </Link>
          </div>
          <div className="px-5 pb-5">
            {loading || !data ? (
              <div className="space-y-2">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : data.transaksiTerakhir.length === 0 ? (
              <Kosong
                ikon={<Receipt size={24} />}
                judul="Belum ada transaksi"
                isi="Mulai catat pengeluaran pertamamu. Cukup beberapa detik."
                aksi={
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => setCepat(true)}
                  >
                    <Plus size={16} /> Catat sekarang
                  </button>
                }
              />
            ) : (
              <div className="space-y-1">
                {data.transaksiTerakhir.map((t) => (
                  <BarisTx key={t.id} tx={t} />
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* tombol catat mengambang (HP) */}
      <button
        onClick={() => setCepat(true)}
        className="lg:hidden fixed bottom-5 right-5 z-30 flex items-center gap-2 h-13 px-5 rounded-full text-white font-semibold text-[14px]"
        style={{
          height: 52,
          background: "var(--accent)",
          boxShadow: "0 14px 32px -10px color-mix(in srgb, var(--accent) 85%, transparent)",
        }}
      >
        <Plus size={19} strokeWidth={2.6} /> Catat
      </button>

      <Modal
        buka={cepat}
        onTutup={() => setCepat(false)}
        judul="Catat transaksi"
        sub="Pemasukan, pengeluaran, atau pindah antar dompet."
        lebar={620}
      >
        {bootstrap && (
          <TxForm
            wallets={bootstrap.wallets}
            categories={bootstrap.categories}
            onSelesai={() => setCepat(false)}
            onBatal={() => setCepat(false)}
          />
        )}
      </Modal>
    </>
  );
}

/* ================================ KOMPONEN ================================ */

function Legenda({ warna, label }: { warna: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 muted">
      <span className="w-2.5 h-2.5 rounded-full" style={{ background: warna }} />
      {label}
    </span>
  );
}

function KartuAngka({
  label,
  nilai,
  loading,
  warna,
  Ikon,
  sub,
}: {
  label: string;
  nilai: number | undefined;
  loading: boolean;
  warna: string;
  Ikon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  sub?: string;
}) {
  return (
    <div className="card card-pad anim-up">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[12.5px] font-medium muted">{label}</span>
        <span
          className="grid place-items-center w-8 h-8 rounded-[10px] shrink-0"
          style={{
            background: `color-mix(in srgb, ${warna} 13%, transparent)`,
            color: warna,
          }}
        >
          <Ikon size={16} strokeWidth={2.4} />
        </span>
      </div>
      {loading ? (
        <Skeleton className="h-6 w-24" />
      ) : (
        <p className="num text-[19px] sm:text-[21px] font-semibold title leading-none">
          {rp(nilai ?? 0)}
        </p>
      )}
      {sub && !loading && <p className="text-[11.5px] muted mt-2">{sub}</p>}
    </div>
  );
}

function KartuSisaBudget({
  data,
  loading,
}: {
  data: DashboardData | null;
  loading: boolean;
}) {
  const total = data?.budgets.total;

  return (
    <div className="card card-pad anim-up">
      <div className="flex items-center justify-between mb-3 gap-2">
        <span className="text-[12.5px] font-medium muted">Sisa Budget</span>
        <span
          className="grid place-items-center w-8 h-8 rounded-[10px] shrink-0"
          style={{
            background: "color-mix(in srgb, var(--accent) 13%, transparent)",
            color: "var(--accent)",
          }}
        >
          <PiggyBank size={16} strokeWidth={2.4} />
        </span>
      </div>

      {loading ? (
        <Skeleton className="h-6 w-24" />
      ) : total ? (
        <>
          <p
            className="num text-[19px] sm:text-[21px] font-semibold title leading-none"
            style={{ color: total.sisa < 0 ? "var(--danger)" : undefined }}
          >
            {rp(total.sisa)}
          </p>
          <div className="flex items-center gap-2 mt-2.5">
            <LevelBadge level={total.level} />
            <span className="text-[11.5px] muted">{persen(total.persen, 0)}</span>
          </div>
        </>
      ) : (
        <>
          <p className="text-[19px] font-semibold title leading-none muted">
            Belum diatur
          </p>
          <Link
            href="/budget"
            className="text-[11.5px] mt-2 inline-block"
            style={{ color: "var(--accent)" }}
          >
            Atur budget →
          </Link>
        </>
      )}
    </div>
  );
}

function BarisBudget({
  nama,
  warna,
  batas,
  terpakai,
  persen: pct,
  level,
  tebal = false,
}: {
  nama: string;
  warna: string;
  batas: number;
  terpakai: number;
  persen: number;
  level: string;
  tebal?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <span
          className={`truncate ${tebal ? "text-[13.5px] font-semibold" : "text-[13px] text-2"}`}
        >
          {nama}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <span className="num text-[12.5px] font-medium">
            {rp(terpakai)}
            <span className="muted"> / {rp(batas)}</span>
          </span>
          {level !== "aman" && <LevelBadge level={level} />}
        </div>
      </div>
      <Progress persen={pct} level={level} tinggi={tebal ? 8 : 6} />
      <div className="flex justify-between mt-1">
        <span className="text-[11px] muted">{persen(pct, 0)} terpakai</span>
        <span
          className="text-[11px]"
          style={{
            color:
              batas - terpakai < 0 ? "var(--danger)" : "var(--muted)",
          }}
        >
          {batas - terpakai < 0
            ? `lebih ${rp(Math.abs(batas - terpakai))}`
            : `sisa ${rp(batas - terpakai)}`}
        </span>
      </div>
    </div>
  );
}

function BarisTx({ tx }: { tx: Tx }) {
  const masuk = tx.tipe === "Pemasukan";
  const transfer = tx.tipe === "Transfer";

  return (
    <div className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-[var(--surface-2)] transition">
      <span
        className="grid place-items-center w-9 h-9 rounded-[10px] shrink-0"
        style={{
          background: transfer
            ? "color-mix(in srgb, var(--info) 13%, transparent)"
            : masuk
              ? "color-mix(in srgb, var(--success) 13%, transparent)"
              : "color-mix(in srgb, var(--danger) 13%, transparent)",
          color: transfer
            ? "var(--info)"
            : masuk
              ? "var(--success)"
              : "var(--danger)",
        }}
      >
        {transfer ? (
          <ArrowLeftRight size={16} />
        ) : masuk ? (
          <TrendingUp size={16} />
        ) : (
          <TrendingDown size={16} />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-medium truncate">
          {transfer
            ? `${tx.wallet || "—"} → ${tx.walletTujuan || "—"}`
            : tx.kategori || "—"}
        </p>
        <p className="text-[11.5px] muted truncate">
          {labelTanggalRelatif(tx.tanggal)}
          {tx.catatan ? ` · ${tx.catatan}` : ""}
          {!transfer && tx.wallet ? ` · ${tx.wallet}` : ""}
        </p>
      </div>

      <p
        className="num font-semibold text-[13.5px] shrink-0 text-right"
        style={{
          color: transfer
            ? "var(--text-2)"
            : masuk
              ? "var(--success)"
              : "var(--danger)",
        }}
      >
        {masuk ? "+" : transfer ? "" : "−"}
        {rp(tx.jumlah)}
        {tx.biaya_admin > 0 && (
          <span className="block text-[10.5px] muted font-normal">
            +{rp(tx.biaya_admin)} admin
          </span>
        )}
      </p>
    </div>
  );
}
