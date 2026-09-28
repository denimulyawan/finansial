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
import {
  Card,
  Galat,
  Kosong,
  PageHeader,
  PilihBulan,
  Skeleton,
} from "@/components/ui";
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
        ["Tanggal", "Tipe", "Kategori", "Dompet", "Dompet Tujuan", "Nominal", "Biaya Admin", "Catatan"],
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
      baris.push(["RINGKASAN"]);
      baris.push(["Total pemasukan", data.ringkasan.masuk]);
      baris.push(["Total pengeluaran", data.ringkasan.keluar]);
      baris.push(["Biaya admin", data.ringkasan.biayaAdmin]);
      baris.push(["Selisih", data.ringkasan.selisih]);

      baris.push([]);
      baris.push(["PER KATEGORI"]);
      data.perKategori.forEach((k) => baris.push([k.nama, k.jumlah]));

      baris.push([]);
      baris.push(["PER DOMPET"]);
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

      const blob = new Blob(["\uFEFF" + csv], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `finansial-${data.from}_${data.to}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.sukses(`Berhasil mengunduh ${hasil.items.length} transaksi.`);
    } catch {
      toast.gagal("Gagal membuat file CSV.");
    } finally {
      setMengunduh(false);
    }
  }

  const totalKeluarKategori =
    data?.perKategori
      .filter((k) => k.id !== "gaji")
      .reduce((a, k) => a + Math.abs(k.jumlah), 0) || 0;

  return (
    <>
      <PageHeader
        judul="Laporan"
        sub={data ? `Periode ${labelTanggal(data.from)} – ${labelTanggal(data.to)}` : "Analisis keuanganmu"}
        aksi={
          <>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setRentangKhusus((v) => !v)}
            >
              {rentangKhusus ? "Pakai bulan" : "Rentang khusus"}
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={unduhCsv}
              disabled={mengunduh || !data}
            >
              <Download size={15} />
              {mengunduh ? "Menyiapkan…" : "Export CSV"}
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
              style={{ width: 170 }}
              value={dari}
              onChange={(e) => setDari(e.target.value)}
            />
            <span className="muted text-sm">sampai</span>
            <input
              type="date"
              className="input"
              style={{ width: 170 }}
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

      {/* --------------------------- ringkasan --------------------------- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
        <Kotak
          label="Pemasukan"
          nilai={data?.ringkasan.masuk}
          loading={loading}
          warna="var(--success)"
          Ikon={ArrowDownLeft}
        />
        <Kotak
          label="Pengeluaran"
          nilai={data?.ringkasan.keluar}
          loading={loading}
          warna="var(--danger)"
          Ikon={ArrowUpRight}
        />
        <Kotak
          label="Selisih"
          nilai={data?.ringkasan.selisih}
          loading={loading}
          warna={data && data.ringkasan.selisih < 0 ? "var(--danger)" : "var(--accent)"}
          Ikon={data && data.ringkasan.selisih < 0 ? TrendingDown : TrendingUp}
        />
        <Kotak
          label="Rata-rata / hari"
          nilai={data?.ringkasan.rataHarian}
          loading={loading}
          warna="var(--info)"
          Ikon={Minus}
        />
      </div>

      {/* -------------------------- pembanding -------------------------- */}
      {data && (
        <Card className="mb-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[13px] font-semibold">
                Dibanding {labelBulanPanjang(data.pembanding.bulan)}
              </p>
              <p className="text-[12.5px] muted mt-0.5">
                {data.ringkasan.jumlahTransaksi} transaksi pada periode ini
              </p>
            </div>
            <div className="flex flex-wrap gap-6">
              <Pembanding
                label="Pemasukan"
                selisih={data.pembanding.selisihMasuk}
                sekarang={data.ringkasan.masuk}
                sebelumnya={data.pembanding.masuk}
                baikNaik
              />
              <Pembanding
                label="Pengeluaran"
                selisih={data.pembanding.selisihKeluar}
                sekarang={data.ringkasan.keluar}
                sebelumnya={data.pembanding.keluar}
                baikNaik={false}
              />
            </div>
          </div>
        </Card>
      )}

      {/* ---------------------------- tren 12 bulan ---------------------------- */}
      <Card className="mb-4" besar>
        <div className="mb-4">
          <h2 className="text-[15px] font-semibold title">Tren 12 Bulan</h2>
          <p className="text-[12.5px] muted mt-0.5">
            Lihat polanya, bukan cuma angka bulan ini
          </p>
        </div>
        {loading || !data ? (
          <Skeleton className="w-full" />
        ) : (
          <TrenGaris data={data.tren} />
        )}
      </Card>

      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        {/* ------------------------ per kategori ------------------------ */}
        <Card besar pad={false}>
          <div className="p-5 pb-2">
            <h2 className="text-[15px] font-semibold title">Per Kategori</h2>
            <p className="text-[12.5px] muted mt-0.5">
              Ke mana uangmu pergi periode ini
            </p>
          </div>

          {loading || !data ? (
            <div className="p-5 space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : data.perKategori.length === 0 ? (
            <Kosong
              ikon={<BarChart3 size={24} />}
              judul="Belum ada data"
              isi="Belum ada transaksi pada periode ini."
            />
          ) : (
            <div className="px-5 pb-5 space-y-3.5">
              {data.perKategori.map((k) => {
                const maks = Math.max(...data.perKategori.map((x) => Math.abs(x.jumlah))) || 1;
                return (
                  <div key={k.id}>
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ background: k.warna }}
                      />
                      <span className="text-[13px] flex-1 truncate">{k.nama}</span>
                      <span className="num text-[12.5px] muted">
                        {totalKeluarKategori
                          ? persen((Math.abs(k.jumlah) / totalKeluarKategori) * 100, 0)
                          : "0%"}
                      </span>
                      <span className="num text-[13px] font-semibold w-[92px] text-right">
                        {rp(k.jumlah)}
                      </span>
                    </div>
                    <div className="bar" style={{ height: 5 }}>
                      <i
                        style={{
                          width: `${(Math.abs(k.jumlah) / maks) * 100}%`,
                          background: k.warna,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* ------------------------- per dompet ------------------------- */}
        <Card besar pad={false}>
          <div className="p-5 pb-2">
            <h2 className="text-[15px] font-semibold title">Per Dompet</h2>
            <p className="text-[12.5px] muted mt-0.5">
              Uang masuk dan keluar tiap dompet
            </p>
          </div>

          {loading || !data ? (
            <div className="p-5 space-y-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : data.perDompet.length === 0 ? (
            <Kosong
              ikon={<BarChart3 size={24} />}
              judul="Belum ada data"
              isi="Belum ada pergerakan pada periode ini."
            />
          ) : (
            <div className="p-5 pt-3 space-y-2">
              {data.perDompet.map((w) => (
                <div
                  key={w.id}
                  className="flex items-center gap-3 p-3 rounded-xl"
                  style={{ background: "var(--surface-2)" }}
                >
                  <span className="text-[13.5px] flex-1 truncate">{w.nama}</span>
                  <span
                    className="num font-semibold text-[13.5px]"
                    style={{
                      color: w.jumlah < 0 ? "var(--danger)" : "var(--success)",
                    }}
                  >
                    {w.jumlah > 0 ? "+" : w.jumlah < 0 ? "−" : ""}
                    {rp(Math.abs(w.jumlah))}
                  </span>
                </div>
              ))}
              <p className="text-[12px] muted pt-2 leading-relaxed">
                Angka ini adalah perubahan bersih selama periode, bukan saldo
                akhir. Transfer antar dompet membuat satu dompet berkurang dan
                yang lain bertambah.
              </p>
            </div>
          )}
        </Card>
      </div>

      {/* --------------------------- harian --------------------------- */}
      {data && data.harian.length > 0 && (
        <Card besar>
          <div className="mb-4">
            <h2 className="text-[15px] font-semibold title">Aktivitas Harian</h2>
            <p className="text-[12.5px] muted mt-0.5">
              Hari-hari yang paling banyak keluar uang
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th style={{ textAlign: "right" }}>Masuk</th>
                  <th style={{ textAlign: "right" }}>Keluar</th>
                  <th style={{ textAlign: "right" }}>Selisih</th>
                </tr>
              </thead>
              <tbody>
                {data.harian
                  .slice()
                  .sort((a, b) => b.keluar - a.keluar)
                  .slice(0, 15)
                  .map((h) => (
                    <tr key={h.tanggal}>
                      <td className="text-[13px]">{labelTanggal(h.tanggal, { denganHari: true })}</td>
                      <td className="text-right num text-[13px]" style={{ color: "var(--success)" }}>
                        {h.masuk ? rp(h.masuk) : "—"}
                      </td>
                      <td className="text-right num text-[13px]" style={{ color: "var(--danger)" }}>
                        {h.keluar ? rp(h.keluar) : "—"}
                      </td>
                      <td
                        className="text-right num text-[13px] font-medium"
                        style={{ color: h.masuk - h.keluar < 0 ? "var(--danger)" : "var(--success)" }}
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

function Kotak({
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
        <p
          className="num text-[19px] sm:text-[21px] font-semibold title leading-none"
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

  const berubahPersen =
    sebelumnya > 0 ? Math.abs((selisih / sebelumnya) * 100) : null;

  return (
    <div>
      <p className="text-[12px] muted mb-1">{label}</p>
      <p className="text-[13.5px] font-semibold num">{rp(sekarang)}</p>
      <p
        className="text-[11.5px] mt-0.5 flex items-center gap-1"
        style={{
          color:
            bagus === null
              ? "var(--muted)"
              : bagus
                ? "var(--success)"
                : "var(--danger)",
        }}
      >
        {sama ? (
          "sama dengan bulan lalu"
        ) : (
          <>
            {naik ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {berubahPersen !== null ? `${berubahPersen.toFixed(0)}%` : rpSingkat(Math.abs(selisih))}{" "}
            {naik ? "lebih tinggi" : "lebih rendah"}
          </>
        )}
      </p>
    </div>
  );
}
