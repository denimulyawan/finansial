"use client";

import { useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  Download,
  Minus,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { api } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { useToast } from "@/components/toast";
import { TrenGaris } from "@/components/charts";
import { Card, Galat, Kosong, PageHeader, PilihBulan, Skeleton } from "@/components/ui";
import {
  bulanSekarang,
  labelBulanPanjang,
  labelTanggal,
  persen,
  rp,
  rpSingkat,
} from "@/lib/format";
import type { ReportData, Tx } from "@/lib/types";

export default function HalamanLaporan() {
  const toast = useToast();
  const [bulan, setBulan] = useState(bulanSekarang());
  const [rentangKhusus, setRentangKhusus] = useState(false);
  const [dari, setDari] = useState("");
  const [sampai, setSampai] = useState("");
  const [mengunduh, setMengunduh] = useState(false);

  const payload: Record<string, unknown> = { bulan };
  if (rentangKhusus && dari && sampai) {
    payload.from = dari;
    payload.to = sampai;
  }

  const { data, loading, error, reload } = useApi<ReportData>("report", payload);

  async function unduhCsv() {
    if (!data) return;
    setMengunduh(true);
    try {
      const hasil = await api<{ items: Tx[] }>("tx.list", {
        from: data.from,
        to: data.to,
        limit: 5000,
      });

      const baris: (string | number)[][] = [
        ["Date", "Type", "Category", "Wallet", "To wallet", "Amount", "Admin fee", "Note"],
      ];

      hasil.items
        .slice()
        .sort((a, b) => (a.tanggal < b.tanggal ? -1 : 1))
        .forEach((t) => {
          baris.push([
            t.tanggal,
            t.tipe,
            t.kategori || "",
            t.wallet || "",
            t.walletTujuan || "",
            t.jumlah,
            t.biaya_admin || 0,
            t.catatan || "",
          ]);
        });

      baris.push([]);
      baris.push(["SUMMARY"]);
      baris.push(["Income", data.ringkasan.masuk]);
      baris.push(["Expenses", data.ringkasan.keluar]);
      baris.push(["Admin fees", data.ringkasan.biayaAdmin]);
      baris.push(["Net", data.ringkasan.selisih]);

      baris.push([]);
      baris.push(["BY CATEGORY"]);
      data.perKategori.forEach((k) => baris.push([k.nama, k.jumlah]));

      baris.push([]);
      baris.push(["BY WALLET"]);
      data.perDompet.forEach((w) => baris.push([w.nama, w.jumlah]));

      const csv = baris
        .map((r) =>
          r
            .map((sel) => {
              const s = String(sel ?? "");
              return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
            })
            .join(";")
        )
        .join("\r\n");

      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `finansial-${data.from}_${data.to}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.sukses(`Exported ${hasil.items.length} transactions.`);
    } catch {
      toast.gagal("Could not build the CSV.");
    } finally {
      setMengunduh(false);
    }
  }

  const kategoriKeluar = (data?.perKategori || []).filter((k) => k.tipe !== "Pemasukan");
  const kategoriMasuk = (data?.perKategori || []).filter((k) => k.tipe === "Pemasukan");
  const totalKeluarKategori = kategoriKeluar.reduce((a, k) => a + k.jumlah, 0);
  const maksKeluar = Math.max(0, ...kategoriKeluar.map((k) => k.jumlah)) || 1;

  /* lihat penjelasan di Dashboard: jangan tampilkan angka nol saat gagal */
  if (error && !data) {
    return (
      <>
        <PageHeader judul="Reports" />
        <Galat pesan={error.message} onCobaLagi={reload} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        judul="Reports"
        sub={data ? `${labelTanggal(data.from)} – ${labelTanggal(data.to)}` : undefined}
        aksi={
          <>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setRentangKhusus((v) => !v)}
            >
              {rentangKhusus ? "By month" : "Custom range"}
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={unduhCsv}
              disabled={mengunduh || !data}
            >
              <Download size={14} />
              {mengunduh ? "Preparing…" : "Export CSV"}
            </button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3 mb-5">
        {rentangKhusus ? (
          <>
            <input
              type="date"
              className="input"
              style={{ width: 165 }}
              value={dari}
              onChange={(e) => setDari(e.target.value)}
            />
            <span className="muted text-[13px]">to</span>
            <input
              type="date"
              className="input"
              style={{ width: 165 }}
              value={sampai}
              onChange={(e) => setSampai(e.target.value)}
            />
          </>
        ) : (
          <PilihBulan nilai={bulan} onUbah={setBulan} />
        )}
      </div>

      {error && (
        <div className="mb-4">
          <Galat pesan={error.message} onCobaLagi={reload} />
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
        <Tile label="Income" nilai={data?.ringkasan.masuk} loading={loading} warna="var(--success)" Ikon={ArrowDownLeft} />
        <Tile label="Expenses" nilai={data?.ringkasan.keluar} loading={loading} warna="var(--danger)" Ikon={ArrowUpRight} />
        <Tile
          label="Net"
          nilai={data?.ringkasan.selisih}
          loading={loading}
          warna={data && data.ringkasan.selisih < 0 ? "var(--danger)" : "var(--accent)"}
          Ikon={data && data.ringkasan.selisih < 0 ? TrendingDown : TrendingUp}
        />
        <Tile label="Per day" nilai={data?.ringkasan.rataHarian} loading={loading} warna="var(--info)" Ikon={Minus} />
      </div>

      {data && (
        <Card className="mb-4">
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div>
              <p className="text-[13px] font-semibold">
                vs {labelBulanPanjang(data.pembanding.bulan)}
              </p>
              <p className="text-[12px] muted mt-0.5">
                {data.ringkasan.jumlahTransaksi} transactions
              </p>
            </div>
            <div className="flex flex-wrap gap-7">
              <Pembanding
                label="Income"
                selisih={data.pembanding.selisihMasuk}
                sekarang={data.ringkasan.masuk}
                sebelumnya={data.pembanding.masuk}
                baikNaik
              />
              <Pembanding
                label="Expenses"
                selisih={data.pembanding.selisihKeluar}
                sekarang={data.ringkasan.keluar}
                sebelumnya={data.pembanding.keluar}
                baikNaik={false}
              />
            </div>
          </div>
        </Card>
      )}

      <Card className="mb-4" besar>
        <h2 className="text-[14.5px] font-semibold title mb-4">Last 12 months</h2>
        {loading || !data ? (
          <Skeleton className="w-full" style={{ height: 220 }} />
        ) : (
          <TrenGaris data={data.tren} />
        )}
      </Card>

      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <Card besar pad={false}>
          <div className="p-5 pb-2">
            <h2 className="text-[14.5px] font-semibold title">By category</h2>
          </div>

          {loading || !data ? (
            <div className="p-5 space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : kategoriKeluar.length === 0 && kategoriMasuk.length === 0 ? (
            <Kosong ikon={<BarChart3 size={22} />} judul="No data" />
          ) : (
            <div className="px-5 pb-5">
              <p className="text-[11px] font-semibold uppercase tracking-wide muted mb-3">
                Expenses · {rp(totalKeluarKategori)}
              </p>

              <div className="space-y-3">
                {kategoriKeluar.map((k) => (
                  <div key={k.id}>
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ background: k.warna }}
                      />
                      <span className="text-[12.5px] flex-1 truncate">{k.nama}</span>
                      <span className="num text-[11.5px] muted">
                        {totalKeluarKategori
                          ? persen((k.jumlah / totalKeluarKategori) * 100, 0)
                          : "0%"}
                      </span>
                      <span className="num text-[12.5px] font-semibold w-[88px] text-right">
                        {rp(k.jumlah)}
                      </span>
                    </div>
                    <div className="bar" style={{ height: 4 }}>
                      <i
                        style={{
                          width: `${(k.jumlah / maksKeluar) * 100}%`,
                          background: k.warna,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {kategoriMasuk.length > 0 && (
                <>
                  <div className="divider my-5" />
                  <p className="text-[11px] font-semibold uppercase tracking-wide muted mb-3">
                    Income
                  </p>
                  <div className="space-y-1.5">
                    {kategoriMasuk.map((k) => (
                      <div
                        key={k.id}
                        className="flex items-center gap-2.5 p-2.5 rounded-xl"
                        style={{ background: "var(--surface-2)" }}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ background: k.warna }}
                        />
                        <span className="text-[12.5px] flex-1 truncate">{k.nama}</span>
                        <span
                          className="num text-[12.5px] font-semibold"
                          style={{ color: "var(--success)" }}
                        >
                          {rp(k.jumlah)}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </Card>

        <Card besar pad={false}>
          <div className="p-5 pb-2">
            <h2 className="text-[14.5px] font-semibold title">By wallet</h2>
          </div>

          {loading || !data ? (
            <div className="p-5 space-y-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-11 w-full" />
              ))}
            </div>
          ) : data.perDompet.length === 0 ? (
            <Kosong ikon={<BarChart3 size={22} />} judul="No data" />
          ) : (
            <div className="p-5 pt-3 space-y-1.5">
              {data.perDompet.map((w) => (
                <div
                  key={w.id}
                  className="flex items-center gap-3 p-2.5 rounded-xl"
                  style={{ background: "var(--surface-2)" }}
                >
                  <span className="text-[13px] flex-1 truncate">{w.nama}</span>
                  <span
                    className="num font-semibold text-[13px]"
                    style={{ color: w.jumlah < 0 ? "var(--danger)" : "var(--success)" }}
                  >
                    {w.jumlah > 0 ? "+" : w.jumlah < 0 ? "−" : ""}
                    {rp(Math.abs(w.jumlah))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {data && data.harian.length > 0 && (
        <Card besar pad={false}>
          <div className="p-5 pb-2">
            <h2 className="text-[14.5px] font-semibold title">Top spending days</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Date</th>
                  <th style={{ textAlign: "right" }}>In</th>
                  <th style={{ textAlign: "right" }}>Out</th>
                  <th style={{ textAlign: "right" }}>Net</th>
                </tr>
              </thead>
              <tbody>
                {data.harian
                  .slice()
                  .sort((a, b) => b.keluar - a.keluar)
                  .slice(0, 12)
                  .map((h) => (
                    <tr key={h.tanggal}>
                      <td className="text-[12.5px]">
                        {labelTanggal(h.tanggal, { denganHari: true })}
                      </td>
                      <td
                        className="text-right num text-[12.5px]"
                        style={{ color: "var(--success)" }}
                      >
                        {h.masuk ? rp(h.masuk) : "—"}
                      </td>
                      <td
                        className="text-right num text-[12.5px]"
                        style={{ color: "var(--danger)" }}
                      >
                        {h.keluar ? rp(h.keluar) : "—"}
                      </td>
                      <td
                        className="text-right num text-[12.5px] font-medium"
                        style={{
                          color: h.masuk - h.keluar < 0 ? "var(--danger)" : "var(--success)",
                        }}
                      >
                        {rp(h.masuk - h.keluar)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}

function Tile({
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
        <p
          className="num text-[18px] sm:text-[20px] font-semibold title leading-none"
          style={{ color: warna }}
        >
          {rp(nilai ?? 0)}
        </p>
      )}
    </div>
  );
}

function Pembanding({
  label,
  selisih,
  sekarang,
  sebelumnya,
  baikNaik,
}: {
  label: string;
  selisih: number;
  sekarang: number;
  sebelumnya: number;
  baikNaik: boolean;
}) {
  const naik = selisih > 0;
  const sama = Math.abs(selisih) < 0.5;
  const bagus = sama ? null : naik === baikNaik;
  const berubahPersen = sebelumnya > 0 ? Math.abs((selisih / sebelumnya) * 100) : null;

  return (
    <div>
      <p className="text-[11.5px] muted mb-1">{label}</p>
      <p className="text-[13px] font-semibold num">{rp(sekarang)}</p>
      <p
        className="text-[11px] mt-0.5 flex items-center gap-1"
        style={{
          color:
            bagus === null ? "var(--muted)" : bagus ? "var(--success)" : "var(--danger)",
        }}
      >
        {sama ? (
          "no change"
        ) : (
          <>
            {naik ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {berubahPersen !== null
              ? `${berubahPersen.toFixed(0)}%`
              : rpSingkat(Math.abs(selisih))}{" "}
            {naik ? "higher" : "lower"}
          </>
        )}
      </p>
    </div>
  );
}
