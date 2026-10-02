"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Save, Target } from "lucide-react";
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
  const [kotor, setKotor] = useState(false);
  const [menyimpan, setMenyimpan] = useState(false);
  const [menyalin, setMenyalin] = useState(false);

  useEffect(() => {
    if (!data) return;
    const map: Record<string, number> = {};
    data.status.items.forEach((i) => {
      map[i.categoryId] = i.batas;
    });
    setNilai(map);
    setKotor(false);
  }, [data]);

  const terpakaiMap = useMemo(() => {
    const m: Record<string, number> = {};
    data?.status.items.forEach((i) => {
      m[i.categoryId] = i.terpakai;
    });
    return m;
  }, [data]);

  /* Total dihitung dari jumlah semua batas kategori, bukan diisi manual.
     Dihitung dari angka yang sedang diketik supaya ikut berubah seketika. */
  const jumlahBatas = useMemo(
    () => Object.values(nilai).reduce((a, v) => a + (v > 0 ? v : 0), 0),
    [nilai]
  );

  async function simpan() {
    setMenyimpan(true);
    try {
      const items = Object.entries(nilai)
        .filter(([, v]) => v > 0)
        .map(([category_id, jumlah]) => ({ category_id, jumlah }));

      await api("budget.saveAll", { bulan, items });
      toast.sukses("Budget saved.");
      setKotor(false);
      picuMuatUlang();
      reload();
    } catch (e) {
      toast.gagal(e instanceof ApiError ? e.message : "Could not save budget.");
    } finally {
      setMenyimpan(false);
    }
  }

  async function salinBulanLalu() {
    setMenyalin(true);
    try {
      await api("budget.copy", { dari: geserBulan(bulan, -1), ke: bulan });
      toast.sukses("Copied from last month.");
      reload();
    } catch (e) {
      toast.gagal(e instanceof ApiError ? e.message : "Could not copy.");
    } finally {
      setMenyalin(false);
    }
  }

  const kategori = data?.kategoriTersedia || [];
  const totalStatus = data?.status.total;

  return (
    <>
      <PageHeader
        judul="Budgets"
        sub={labelBulanPanjang(bulan)}
        aksi={
          <>
            <PilihBulan nilai={bulan} onUbah={setBulan} />
            {data?.adaBudgetBulanLalu && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={salinBulanLalu}
                disabled={menyalin}
              >
                <Copy size={14} /> Copy previous
              </button>
            )}
            <button
              className="btn btn-primary btn-sm"
              onClick={simpan}
              disabled={menyimpan || !kotor}
            >
              <Save size={14} />
              {menyimpan ? "Saving…" : "Save"}
            </button>
          </>
        }
      />

      {error && (
        <div className="mb-4">
          <Galat pesan={error.message} onCobaLagi={reload} />
        </div>
      )}

      {totalStatus && (
        <Card className="mb-4" besar>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[12px] muted mb-1">Spent this month</p>
              <p className="num text-[22px] font-semibold title leading-none">
                {rp(totalStatus.terpakai)}
                <span className="text-[14px] muted font-normal">
                  {" "}
                  / {rp(totalStatus.batas)}
                </span>
              </p>
            </div>
            <div className="flex items-center gap-3">
              <LevelBadge level={totalStatus.level} />
              <span className="num text-[14px] font-semibold">
                {fmtPersen(totalStatus.persen, 0)}
              </span>
            </div>
          </div>
          <div className="mt-3.5">
            <Progress persen={totalStatus.persen} level={totalStatus.level} tinggi={8} />
          </div>
        </Card>
      )}

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-4">
          <Card besar className="lg:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <span
                className="grid place-items-center w-8 h-8 rounded-[9px]"
                style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
              >
                <Target size={16} />
              </span>
              <h2 className="text-[14.5px] font-semibold title">Monthly total</h2>
            </div>

            <p className="text-[12px] muted mb-1">Sum of all category caps</p>
            <p className="num text-[24px] font-semibold title leading-none">
              {rp(jumlahBatas)}
            </p>
            <p className="text-[11.5px] muted mt-2">
              Filled in automatically. Set a cap on any category and this follows
              along, so there is no second number to keep in sync.
            </p>

            <div className="divider my-5" />

            <div className="flex flex-wrap gap-1.5">
              <LevelBadge level="aman" />
              <LevelBadge level="warning" />
              <LevelBadge level="kritis" />
              <LevelBadge level="over" />
            </div>
            <p className="text-[11.5px] muted mt-2.5">
              Safe under 70%, warning 70%, critical 90%, over 100%.
            </p>
          </Card>

          <Card besar className="lg:col-span-2" pad={false}>
            <div className="p-5 pb-2">
              <h2 className="text-[14.5px] font-semibold title">Per category</h2>
            </div>

            {kategori.length === 0 ? (
              <Kosong ikon={<Target size={22} />} judul="No expense categories" />
            ) : (
              <div className="px-5 pb-5 space-y-3">
                {kategori.map((c) => {
                  const batas = nilai[c.id] || 0;
                  const terpakai = terpakaiMap[c.id] || 0;
                  const pct = batas > 0 ? (terpakai / batas) * 100 : 0;
                  const level = levelDari(pct);
                  const sisa = batas - terpakai;

                  return (
                    <div
                      key={c.id}
                      className="rounded-xl p-3"
                      style={{ background: "var(--surface-2)" }}
                    >
                      <div className="flex items-center gap-2.5 mb-2.5">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ background: c.warna }}
                        />
                        <span className="text-[13px] font-medium flex-1 truncate">
                          {c.nama}
                        </span>
                        {batas > 0 && level !== "aman" && <LevelBadge level={level} />}
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
                        <div className="w-[108px] text-right shrink-0">
                          <p className="num text-[12.5px] font-semibold">{rp(terpakai)}</p>
                          <p className="text-[10.5px] muted">spent</p>
                        </div>
                      </div>

                      {batas > 0 && (
                        <div className="mt-2.5">
                          <Progress persen={pct} level={level} tinggi={5} />
                          <div className="flex justify-between mt-1">
                            <span className="text-[10.5px] muted">
                              {fmtPersen(pct, 0)} used
                            </span>
                            <span
                              className="text-[10.5px]"
                              style={{ color: sisa < 0 ? "var(--danger)" : "var(--muted)" }}
                            >
                              {sisa < 0
                                ? `${rp(Math.abs(sisa))} over`
                                : `${rp(sisa)} left`}
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

      {kotor && (
        <div
          className="fixed bottom-5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-4 py-2.5 rounded-2xl anim-up"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow)",
          }}
        >
          <span className="text-[12.5px] text-2">Unsaved changes</span>
          <button className="btn btn-primary btn-sm" onClick={simpan} disabled={menyimpan}>
            {menyimpan ? "Saving…" : "Save"}
          </button>
        </div>
      )}
    </>
  );
}
