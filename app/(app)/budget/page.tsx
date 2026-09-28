"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Copy,
  Info,
  Save,
  Target,
  TriangleAlert,
} from "lucide-react";
import { ApiError, api } from "@/lib/api";
import { picuMuatUlang, useApi } from "@/lib/hooks";
import { useToast } from "@/components/toast";
import {
  Card,
  Field,
  Galat,
  Kosong,
  LevelBadge,
  PageHeader,
  PilihBulan,
  Progress,
  RupiahInput,
  Skeleton,
} from "@/components/ui";
import {
  bulanSekarang,
  geserBulan,
  labelBulanPanjang,
  persen as fmtPersen,
  rp,
} from "@/lib/format";
import type { BudgetStatus, Category } from "@/lib/types";

interface BudgetPage {
  bulan: string;
  status: BudgetStatus;
  statusBulanLain: BudgetStatus | null;
  kategoriTersedia: Category[];
  adaBudgetBulanLalu: boolean;
}

function levelDari(p: number): string {
  if (p >= 100) return "over";
  if (p >= 90) return "kritis";
  if (p >= 70) return "warning";
  return "aman";
}

export default function HalamanBudget() {
  const toast = useToast();
  const [bulan, setBulan] = useState(bulanSekarang());
  const { data, loading, error, reload } = useApi<BudgetPage>("budget.page", {
    bulan,
  });

  const [nilai, setNilai] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [kotor, setKotor] = useState(false);
  const [menyimpan, setMenyimpan] = useState(false);
  const [menyalin, setMenyalin] = useState(false);

  /* muat nilai dari server setiap bulan berubah */
  useEffect(() => {
    if (!data) return;
    const map: Record<string, number> = {};
    data.status.items.forEach((i) => {
      map[i.categoryId] = i.batas;
    });
    setNilai(map);
    setTotal(data.status.total?.batas || 0);
    setKotor(false);
  }, [data]);

  const terpakaiMap = useMemo(() => {
    const m: Record<string, number> = {};
    data?.status.items.forEach((i) => {
      m[i.categoryId] = i.terpakai;
    });
    return m;
  }, [data]);

  const totalTerpakai = data?.status.total?.terpakai ?? 0;

  async function simpan() {
    setMenyimpan(true);
    try {
      const items = Object.entries(nilai)
        .filter(([, v]) => v > 0)
        .map(([category_id, jumlah]) => ({ category_id, jumlah }));
      if (total > 0) items.push({ category_id: "TOTAL", jumlah: total });

      await api("budget.saveAll", { bulan, items });
      toast.sukses("Budget disimpan.");
      setKotor(false);
      picuMuatUlang();
      reload();
    } catch (e) {
      toast.gagal(e instanceof ApiError ? e.message : "Gagal menyimpan budget.");
    } finally {
      setMenyimpan(false);
    }
  }

  async function salinBulanLalu() {
    setMenyalin(true);
    try {
      await api("budget.copy", { dari: geserBulan(bulan, -1), ke: bulan });
      toast.sukses(
        `Budget ${labelBulanPanjang(geserBulan(bulan, -1))} disalin ke ${labelBulanPanjang(bulan)}.`
      );
      reload();
    } catch (e) {
      toast.gagal(e instanceof ApiError ? e.message : "Gagal menyalin budget.");
    } finally {
      setMenyalin(false);
    }
  }

  const kategori = data?.kategoriTersedia || [];
  const adaIsi = Object.values(nilai).some((v) => v > 0) || total > 0;

  return (
    <>
      <PageHeader
        judul="Budget"
        sub="Tetapkan batas pengeluaran, lalu dapat peringatan otomatis lewat Telegram."
        aksi={
          <>
            <PilihBulan nilai={bulan} onUbah={setBulan} />
            {data?.adaBudgetBulanLalu && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={salinBulanLalu}
                disabled={menyalin}
              >
                <Copy size={15} /> Salin bulan lalu
              </button>
            )}
            <button
              className="btn btn-primary btn-sm"
              onClick={simpan}
              disabled={menyimpan || !kotor}
            >
              <Save size={15} />
              {menyimpan ? "Menyimpan…" : "Simpan"}
            </button>
          </>
        }
      />

      {error && (
        <div className="mb-4">
          <Galat pesan={error.message} onCobaLagi={reload} />
        </div>
      )}

      {/* ------------------------- status bulan ini ------------------------- */}
      {data?.status.total && (
        <Card className="mb-4" besar>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[12.5px] muted mb-1">Total pengeluaran bulan ini</p>
              <p className="num text-[24px] font-semibold title leading-none">
                {rp(data.status.total.terpakai)}
                <span className="text-[15px] muted font-normal">
                  {" "}
                  / {rp(data.status.total.batas)}
                </span>
              </p>
            </div>
            <div className="flex items-center gap-3">
              <LevelBadge level={data.status.total.level} />
              <span className="num text-[15px] font-semibold">
                {fmtPersen(data.status.total.persen, 0)}
              </span>
            </div>
          </div>
          <div className="mt-4">
            <Progress
              persen={data.status.total.persen}
              level={data.status.total.level}
              tinggi={9}
            />
          </div>
          <p className="text-[12.5px] muted mt-2.5">
            {data.status.total.sisa < 0
              ? `Sudah lewat ${rp(Math.abs(data.status.total.sisa))} dari batas.`
              : `Masih bisa belanja ${rp(data.status.total.sisa)} lagi bulan ini.`}
          </p>
        </Card>
      )}

      {data && data.status.jumlahPerhatian ? (
        <div
          className="rounded-2xl p-4 mb-4 flex items-start gap-3 text-[13px]"
          style={{
            background: "color-mix(in srgb, var(--warning) 9%, transparent)",
            border: "1px solid color-mix(in srgb, var(--warning) 22%, transparent)",
          }}
        >
          <TriangleAlert size={17} style={{ color: "var(--warning)" }} className="mt-0.5 shrink-0" />
          <p className="text-2">
            <b>{data.status.jumlahPerhatian} pos</b> sudah melewati batas wajar.
            Notifikasi Telegram otomatis terkirim setiap kali sebuah pos naik
            tingkat peringatan.
          </p>
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-4">
          {/* --------------------------- total bulanan --------------------------- */}
          <Card besar className="lg:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <span
                className="grid place-items-center w-9 h-9 rounded-[10px]"
                style={{
                  background: "var(--accent-soft)",
                  color: "var(--accent)",
                }}
              >
                <Target size={17} />
              </span>
              <div>
                <h2 className="text-[15px] font-semibold title">Total Bulanan</h2>
                <p className="text-[12px] muted">Batas seluruh pengeluaran</p>
              </div>
            </div>

            <Field label="Batas pengeluaran sebulan">
              <RupiahInput
                value={total}
                onChange={(v) => {
                  setTotal(v);
                  setKotor(true);
                }}
              />
            </Field>

            <div className="text-[12.5px] muted mt-3 leading-relaxed">
              Kosongkan kalau tidak ingin memakai batas total. Batas per kategori
              tetap berlaku.
            </div>

            <div className="divider my-5" />

            <div className="flex items-start gap-2.5 text-[12.5px] text-2 leading-relaxed">
              <Info size={15} className="mt-0.5 shrink-0 muted" />
              <div>
                <p className="mb-2 font-medium">Tingkat peringatan</p>
                <div className="flex flex-wrap gap-1.5">
                  <LevelBadge level="aman" />
                  <LevelBadge level="warning" />
                  <LevelBadge level="kritis" />
                  <LevelBadge level="over" />
                </div>
                <p className="mt-2.5 muted">
                  Aman di bawah 70%, warning mulai 70%, kritis mulai 90%, over
                  mulai 100%.
                </p>
              </div>
            </div>
          </Card>

          {/* ------------------------- per kategori ------------------------- */}
          <Card besar className="lg:col-span-2" pad={false}>
            <div className="p-5 pb-3">
              <h2 className="text-[15px] font-semibold title">
                Batas per Kategori
              </h2>
              <p className="text-[12.5px] muted mt-0.5">
                {data
                  ? data.status.items.length
                    ? `${data.status.items.length} kategori sudah punya batas`
                    : "Belum ada batas kategori di bulan ini"
                  : "Memuat…"}
              </p>
            </div>

            {kategori.length === 0 ? (
              <Kosong
                ikon={<Target size={24} />}
                judul="Belum ada kategori pengeluaran"
                isi="Tambahkan kategori dulu di menu Pengaturan."
              />
            ) : (
              <div className="px-5 pb-5 space-y-4">
                {kategori.map((c) => {
                  const batas = nilai[c.id] || 0;
                  const terpakai = terpakaiMap[c.id] || 0;
                  const pct = batas > 0 ? (terpakai / batas) * 100 : 0;
                  const level = levelDari(pct);

                  return (
                    <div
                      key={c.id}
                      className="rounded-xl p-3.5"
                      style={{ background: "var(--surface-2)" }}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ background: c.warna }}
                        />
                        <span className="text-[13.5px] font-medium flex-1 truncate">
                          {c.nama}
                        </span>
                        {batas > 0 && level !== "aman" && (
                          <LevelBadge level={level} />
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <RupiahInput
                            value={batas}
                            onChange={(v) => {
                              setNilai((n) => ({ ...n, [c.id]: v }));
                              setKotor(true);
                            }}
                          />
                        </div>
                        <div className="w-[120px] text-right shrink-0">
                          <p className="num text-[13px] font-semibold">
                            {rp(terpakai)}
                          </p>
                          <p className="text-[11px] muted">terpakai</p>
                        </div>
                      </div>

                      {batas > 0 && (
                        <div className="mt-3">
                          <Progress persen={pct} level={level} tinggi={6} />
                          <div className="flex justify-between mt-1.5">
                            <span className="text-[11px] muted">
                              {fmtPersen(pct, 0)} dari {rp(batas)}
                            </span>
                            <span
                              className="text-[11px]"
                              style={{
                                color:
                                  batas - terpakai < 0
                                    ? "var(--danger)"
                                    : "var(--muted)",
                              }}
                            >
                              {batas - terpakai < 0
                                ? `lebih ${rp(Math.abs(batas - terpakai))}`
                                : `sisa ${rp(batas - terpakai)}`}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* bilah simpan melayang saat ada perubahan */}
      {kotor && (
        <div
          className="fixed bottom-5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-4 py-3 rounded-2xl anim-up"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          <span className="text-[13px] text-2">Ada perubahan belum disimpan</span>
          <button
            className="btn btn-primary btn-sm"
            onClick={simpan}
            disabled={menyimpan}
          >
            {menyimpan ? "Menyimpan…" : "Simpan"}
          </button>
        </div>
      )}
    </>
  );
}
