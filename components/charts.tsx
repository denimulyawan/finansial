"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { rp, rpSingkat } from "@/lib/format";
import type { KategoriJumlah, TrenPoint } from "@/lib/types";

/* warna seri sengaja memakai hex, bukan CSS variable:
   atribut SVG tidak selalu menerima var() dengan andal */
export const WARNA = {
  masuk: "#10b981",
  keluar: "#f43f5e",
  garis: "rgba(148,163,184,0.22)",
  teksSumbu: "#94a3b8",
};

const gayaTick = { fontSize: 11, fill: WARNA.teksSumbu };

interface TipPayload {
  name?: string;
  value?: number;
  color?: string;
  payload?: Record<string, unknown>;
}

function Tip({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: TipPayload[];
  label?: string;
  formatter?: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="card p-2.5 min-w-[150px]"
      style={{ boxShadow: "var(--shadow-lg)", border: "1px solid var(--border)" }}
    >
      {label && (
        <p className="text-[12px] font-semibold mb-1.5">{label}</p>
      )}
      <div className="space-y-1">
        {payload.map((p, i) => (
          <div key={i} className="flex items-center gap-2 text-[12.5px]">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: p.color }}
            />
            <span className="muted">{p.name}</span>
            <span className="num font-semibold ml-auto pl-3">
              {formatter ? formatter(Number(p.value) || 0) : rp(Number(p.value) || 0)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================ GRAFIK BATANG TREN ========================== */

export function TrenChart({
  data,
  tinggi = 240,
}: {
  data: TrenPoint[];
  tinggi?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={tinggi}>
      <BarChart data={data} margin={{ top: 8, right: 6, left: -14, bottom: 0 }} barGap={4}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={WARNA.garis} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={gayaTick} dy={4} />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={gayaTick}
          tickFormatter={(v: number) => rpSingkat(v)}
          width={54}
        />
        <Tooltip
          content={<Tip />}
          cursor={{ fill: "rgba(148,163,184,0.10)" }}
        />
        <Bar
          dataKey="masuk"
          name="Pemasukan"
          fill={WARNA.masuk}
          radius={[5, 5, 0, 0]}
          maxBarSize={26}
        />
        <Bar
          dataKey="keluar"
          name="Pengeluaran"
          fill={WARNA.keluar}
          radius={[5, 5, 0, 0]}
          maxBarSize={26}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ============================== GRAFIK GARIS ============================= */

export function TrenGaris({
  data,
  tinggi = 220,
}: {
  data: TrenPoint[];
  tinggi?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={tinggi}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={WARNA.garis} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={gayaTick} dy={4} />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={gayaTick}
          tickFormatter={(v: number) => rpSingkat(v)}
          width={54}
        />
        <Tooltip content={<Tip />} cursor={{ stroke: WARNA.garis, strokeWidth: 1 }} />
        <Line
          type="monotone"
          dataKey="masuk"
          name="Pemasukan"
          stroke={WARNA.masuk}
          strokeWidth={2.4}
          dot={{ r: 3, strokeWidth: 0, fill: WARNA.masuk }}
          activeDot={{ r: 5 }}
        />
        <Line
          type="monotone"
          dataKey="keluar"
          name="Pengeluaran"
          stroke={WARNA.keluar}
          strokeWidth={2.4}
          dot={{ r: 3, strokeWidth: 0, fill: WARNA.keluar }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/* ============================ DONUT PER KATEGORI ========================== */

export function DonutKategori({
  data,
  total,
  tinggi = 200,
}: {
  data: KategoriJumlah[];
  total: number;
  tinggi?: number;
}) {
  const bersih = data.filter((d) => d.jumlah > 0);

  if (!bersih.length) {
    return (
      <div
        className="grid place-items-center text-[13px] muted"
        style={{ height: tinggi }}
      >
        Belum ada pengeluaran bulan ini
      </div>
    );
  }

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={tinggi}>
        <PieChart>
          <Pie
            data={bersih}
            dataKey="jumlah"
            nameKey="nama"
            innerRadius="62%"
            outerRadius="92%"
            paddingAngle={2}
            stroke="none"
          >
            {bersih.map((d) => (
              <Cell key={d.id} fill={d.warna} />
            ))}
          </Pie>
          <Tooltip content={<Tip />} />
        </PieChart>
      </ResponsiveContainer>

      <div className="absolute inset-0 grid place-items-center pointer-events-none">
        <div className="text-center">
          <p className="text-[11px] muted">Total</p>
          <p className="num text-[15px] font-semibold title">{rpSingkat(total)}</p>
        </div>
      </div>
    </div>
  );
}
