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
  Modal,
  PageHeader,
  PilihBulan,
  Progress,
  Skeleton,
} from "@/components/ui";
import TxForm from "@/components/TxForm";
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

  const totalKategori =
    data?.perKategori.reduce((a, b) => a + b.jumlah, 0) || 0;

  /*
   * Gagal memuat dan belum ada data sama sekali: tampilkan pesannya saja.
   * "Rp 0" terbaca sebagai "saldo saya nol", dan pengguna bisa mengira
   * datanya hilang lalu mencatat ulang transaksi yang sebenarnya masih ada.
   */
  if (error && !data) {
    return (
      <>
        <PageHeader
          judul="Dashboard"
          aksi={<PilihBulan nilai={bulan} onUbah={setBulan} />}
        />
        <Galat pesan={error.message} onCobaLagi={reload} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        judul="Dashboard"
        sub={data ? labelBulanPanjang(data.bulan) : undefined}
        aksi={<PilihBulan nilai={bulan} onUbah={setBulan} />}
      />

      {error && (
        <div className="mb-4">
          <Galat pesan={error.message} onCobaLagi={reload} />
        </div>
      )}

      {/* stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
        <BudgetTile data={data} loading={loading} />
        <StatTile
          label="Expenses"
          nilai={data?.ringkasan.keluar}
          loading={loading}
          warna="var(--danger)"
          Ikon={ArrowUpRight}
        />
        <StatTile
          label="Income"
          nilai={data?.ringkasan.masuk}
          loading={loading}
          warna="var(--success)"
          Ikon={ArrowDownLeft}
        />
        <StatTile
          label="Total balance"
          nilai={data?.totalSaldo}
          loading={loading}
          warna="var(--accent)"
          Ikon={WalletIcon}
        />
      </div>

      {/* trend */}
      <Card className="mb-4" besar>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-[14.5px] font-semibold title">Last 6 months</h2>
          <div className="flex items-center gap-4 text-[12px]">
            <Legend warna="var(--success)" label="Income" />
            <Legend warna="var(--danger)" label="Expense" />
          </div>
        </div>
        {loading || !data ? (
          <Skeleton className="w-full" style={{ height: 240 }} />
        ) : (
          <TrenChart data={data.tren} />
        )}
      </Card>

      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        {/* by category */}
        <Card besar>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[14.5px] font-semibold title">By category</h2>
            <Link href="/laporan" className="btn btn-ghost btn-sm">
              Reports
            </Link>
          </div>

          {loading || !data ? (
            <Skeleton className="w-full" style={{ height: 200 }} />
          ) : data.perKategori.length === 0 ? (
            <Kosong ikon={<Receipt size={22} />} judul="No expenses yet" />
          ) : (
            <>
              <DonutKategori data={data.perKategori} total={totalKategori} />
              <div className="mt-4 space-y-2">
                {data.perKategori.slice(0, 5).map((k) => (
                  <div key={k.id} className="flex items-center gap-2.5 text-[13px]">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: k.warna }}
                    />
                    <span className="flex-1 truncate text-2">{k.nama}</span>
                    <span className="num font-semibold">{rp(k.jumlah)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>

        {/* budget status */}
        <Card besar>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[14.5px] font-semibold title">Budget status</h2>
            <Link href="/budget" className="btn btn-ghost btn-sm">
              Manage
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
              ikon={<PiggyBank size={22} />}
              judul="No budget set"
              aksi={
                <Link href="/budget" className="btn btn-primary btn-sm">
                  Set budget
                </Link>
              }
            />
          ) : (
            <div className="space-y-4 max-h-[330px] overflow-y-auto pr-1">
              {data.budgets.total && (
                <BudgetRow
                  nama="Monthly total"
                  batas={data.budgets.total.batas}
                  terpakai={data.budgets.total.terpakai}
                  persen={data.budgets.total.persen}
                  level={data.budgets.total.level}
                  tebal
                />
              )}
              {data.budgets.items.map((b) => (
                <BudgetRow
                  key={b.categoryId}
                  nama={b.nama}
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

      <div className="grid lg:grid-cols-2 gap-4">
        {/* wallets */}
        <Card besar pad={false}>
          <div className="flex items-center justify-between p-5 pb-2">
            <h2 className="text-[14.5px] font-semibold title">Wallets</h2>
            <Link href="/dompet" className="btn btn-ghost btn-sm">
              Manage
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
                ikon={<WalletIcon size={22} />}
                judul="No wallets yet"
                aksi={
                  <Link href="/dompet" className="btn btn-primary btn-sm">
                    Add wallet
                  </Link>
                }
              />
            ) : (
              <div className="space-y-1.5">
                {data.saldoDompet.map((w) => (
                  <div
                    key={w.id}
                    className="flex items-center gap-3 p-2.5 rounded-xl"
                    style={{ background: "var(--surface-2)" }}
                  >
                    <span
                      className="grid place-items-center w-8 h-8 rounded-[9px] shrink-0"
                      style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                    >
                      {w.jenis === "piutang" || w.jenis === "hutang" ? (
                        <ArrowLeftRight size={15} />
                      ) : (
                        <WalletIcon size={15} />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium truncate">{w.nama}</p>
                      <p className="text-[11px] muted">
                        {JENIS_DOMPET_LABEL[w.jenis] || w.jenis}
                      </p>
                    </div>
                    <p
                      className="num font-semibold text-[13.5px]"
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

        {/* recent */}
        <Card besar pad={false}>
          <div className="flex items-center justify-between p-5 pb-2">
            <h2 className="text-[14.5px] font-semibold title">Recent</h2>
            <Link href="/transaksi" className="btn btn-ghost btn-sm">
              View all
            </Link>
          </div>
          <div className="px-5 pb-5">
            {loading || !data ? (
              <div className="space-y-2">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-11 w-full" />
                ))}
              </div>
            ) : data.transaksiTerakhir.length === 0 ? (
              <Kosong
                ikon={<Receipt size={22} />}
                judul="No transactions"
                aksi={
                  <button className="btn btn-primary btn-sm" onClick={() => setCepat(true)}>
                    <Plus size={15} /> Add one
                  </button>
                }
              />
            ) : (
              <div className="space-y-0.5">
                {data.transaksiTerakhir.map((t) => (
                  <TxRow key={t.id} tx={t} />
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      <button
        onClick={() => setCepat(true)}
        className="lg:hidden fixed bottom-5 right-5 z-30 flex items-center gap-2 px-5 rounded-full text-white font-semibold text-[13.5px]"
        style={{
          height: 48,
          background: "var(--accent)",
          boxShadow: "0 12px 28px -10px color-mix(in srgb, var(--accent) 80%, transparent)",
        }}
      >
        <Plus size={18} strokeWidth={2.6} /> New
      </button>

      <Modal
        buka={cepat}
        onTutup={() => setCepat(false)}
        judul="New transaction"
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

/* ================================ COMPONENTS ============================== */

function Legend({ warna, label }: { warna: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 muted">
      <span className="w-2.5 h-2.5 rounded-full" style={{ background: warna }} />
      {label}
    </span>
  );
}

function StatTile({
  label,
  nilai,
  loading,
  warna,
  Ikon,
}: {
  label: string;
  nilai: number | undefined;
  loading: boolean;
  warna: string;
  Ikon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
}) {
  return (
    <div className="tile anim-up" style={{ background: `color-mix(in srgb, ${warna} 8%, #fff)`, borderColor: `color-mix(in srgb, ${warna} 18%, #fff)` }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[12px] font-medium muted truncate">{label}</span>
        <span
          className="grid place-items-center w-7 h-7 rounded-[9px] shrink-0"
          style={{
            background: `color-mix(in srgb, ${warna} 11%, transparent)`,
            color: warna,
          }}
        >
          <Ikon size={15} strokeWidth={2.4} />
        </span>
      </div>
      {loading ? (
        <Skeleton className="h-6 w-24" />
      ) : (
        <p className="num text-[18px] sm:text-[20px] font-semibold title leading-none">
          {rp(nilai ?? 0)}
        </p>
      )}
    </div>
  );
}

function BudgetTile({
  data,
  loading,
}: {
  data: DashboardData | null;
  loading: boolean;
}) {
  const total = data?.budgets.total;

  return (
    <div className="tile anim-up" style={{ background: "color-mix(in srgb, var(--accent) 8%, #fff)", borderColor: "color-mix(in srgb, var(--accent) 18%, #fff)" }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[12px] font-medium muted truncate">
          Budget left
        </span>
        <span
          className="grid place-items-center w-7 h-7 rounded-[9px] shrink-0"
          style={{
            background: "color-mix(in srgb, var(--accent) 11%, transparent)",
            color: "var(--accent)",
          }}
        >
          <PiggyBank size={15} strokeWidth={2.4} />
        </span>
      </div>

      {loading ? (
        <Skeleton className="h-6 w-24" />
      ) : total ? (
        <>
          <p
            className="num text-[18px] sm:text-[20px] font-semibold title leading-none"
            style={{ color: total.sisa < 0 ? "var(--danger)" : undefined }}
          >
            {rp(total.sisa)}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <LevelBadge level={total.level} />
            <span className="text-[11px] muted">{persen(total.persen, 0)}</span>
          </div>
        </>
      ) : (
        <Link
          href="/budget"
          className="text-[15px] font-semibold title muted"
        >
          Not set
        </Link>
      )}
    </div>
  );
}

function BudgetRow({
  nama,
  batas,
  terpakai,
  persen: pct,
  level,
  tebal = false,
}: {
  nama: string;
  batas: number;
  terpakai: number;
  persen: number;
  level: string;
  tebal?: boolean;
}) {
  const sisa = batas - terpakai;
  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <span
          className={`truncate ${tebal ? "text-[13px] font-semibold" : "text-[12.5px] text-2"}`}
        >
          {nama}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <span className="num text-[12px] font-medium">
            {rp(terpakai)}
            <span className="muted"> / {rp(batas)}</span>
          </span>
          {level !== "aman" && <LevelBadge level={level} />}
        </div>
      </div>
      <Progress persen={pct} level={level} tinggi={tebal ? 7 : 5} />
      <div className="flex justify-between mt-1">
        <span className="text-[10.5px] muted">{persen(pct, 0)} used</span>
        <span
          className="text-[10.5px]"
          style={{ color: sisa < 0 ? "var(--danger)" : "var(--muted)" }}
        >
          {sisa < 0 ? `${rp(Math.abs(sisa))} over` : `${rp(sisa)} left`}
        </span>
      </div>
    </div>
  );
}

function TxRow({ tx }: { tx: Tx }) {
  const masuk = tx.tipe === "Pemasukan";
  const transfer = tx.tipe === "Transfer";

  return (
    <div className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-[var(--surface-2)] transition">
      <span
        className="grid place-items-center w-8 h-8 rounded-[9px] shrink-0"
        style={{
          background: transfer
            ? "color-mix(in srgb, var(--info) 11%, transparent)"
            : masuk
              ? "color-mix(in srgb, var(--success) 11%, transparent)"
              : "color-mix(in srgb, var(--danger) 11%, transparent)",
          color: transfer
            ? "var(--info)"
            : masuk
              ? "var(--success)"
              : "var(--danger)",
        }}
      >
        {transfer ? (
          <ArrowLeftRight size={15} />
        ) : masuk ? (
          <TrendingUp size={15} />
        ) : (
          <TrendingDown size={15} />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium truncate">
          {transfer
            ? `${tx.wallet || "—"} → ${tx.walletTujuan || "—"}`
            : tx.kategori || "—"}
        </p>
        <p className="text-[11px] muted truncate">
          {labelTanggalRelatif(tx.tanggal)}
          {tx.catatan ? ` · ${tx.catatan}` : ""}
        </p>
      </div>

      <p
        className="num font-semibold text-[13px] shrink-0 text-right"
        style={{
          color: transfer ? "var(--text-2)" : masuk ? "var(--success)" : "var(--danger)",
        }}
      >
        {masuk ? "+" : transfer ? "" : "−"}
        {rp(tx.jumlah)}
        {tx.biaya_admin > 0 && (
          <span className="block text-[10px] muted font-normal">
            +{rp(tx.biaya_admin)} fee
          </span>
        )}
      </p>
    </div>
  );
}
