"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { LEVEL_LABEL, LEVEL_WARNA, angkaPolos, parseAngka } from "@/lib/format";

/* ================================= KARTU ================================= */

export function Card({
  children,
  className = "",
  pad = true,
  besar = false,
}: {
  children: ReactNode;
  className?: string;
  pad?: boolean;
  besar?: boolean;
}) {
  return (
    <div
      className={`card ${besar ? "card-lg" : ""} ${pad ? "card-pad" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  judul,
  sub,
  aksi,
}: {
  judul: string;
  sub?: string;
  aksi?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
      <div className="min-w-0">
        <h1 className="title text-[22px] sm:text-[25px] leading-tight">{judul}</h1>
        {sub && <p className="text-[13.5px] muted mt-1">{sub}</p>}
      </div>
      {aksi && <div className="flex items-center gap-2 flex-wrap">{aksi}</div>}
    </div>
  );
}

/* ================================ MODAL ================================= */

export function Modal({
  buka,
  onTutup,
  judul,
  sub,
  children,
  footer,
  lebar = 560,
}: {
  buka: boolean;
  onTutup: () => void;
  judul: string;
  sub?: string;
  children: ReactNode;
  footer?: ReactNode;
  lebar?: number;
}) {
  useEffect(() => {
    if (!buka) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onTutup();
    };
    document.addEventListener("keydown", onKey);
    const sebelum = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = sebelum;
    };
  }, [buka, onTutup]);

  if (!buka) return null;

  return (
    <>
      <div className="overlay" onClick={onTutup} />
      <div className="modal" style={{ width: `min(${lebar}px, calc(100vw - 32px))` }}>
        <div className="modal-head">
          <div className="min-w-0">
            <h2 className="text-[16px] font-semibold title">{judul}</h2>
            {sub && <p className="text-[12.5px] muted mt-0.5">{sub}</p>}
          </div>
          <button
            onClick={onTutup}
            className="btn btn-ghost btn-icon btn-sm shrink-0"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">{children}</div>

        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </>
  );
}

/* ================================ FORM ================================== */

export function Field({
  label,
  hint,
  children,
  className = "",
}: {
  label?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      {label && <label className="label">{label}</label>}
      {children}
      {hint && <p className="text-[12px] muted mt-1.5">{hint}</p>}
    </div>
  );
}

export function RupiahInput({
  value,
  onChange,
  placeholder = "0",
  autoFocus = false,
  nama,
}: {
  value: number;
  onChange: (n: number) => void;
  placeholder?: string;
  autoFocus?: boolean;
  nama?: string;
}) {
  return (
    <div className="relative">
      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[13px] font-semibold muted pointer-events-none">
        Rp
      </span>
      <input
        className="input input-rupiah pl-11"
        inputMode="numeric"
        autoComplete="off"
        name={nama}
        autoFocus={autoFocus}
        value={value ? angkaPolos(value) : ""}
        placeholder={placeholder}
        onChange={(e) => onChange(parseAngka(e.target.value))}
      />
    </div>
  );
}

/* =============================== TAMPILAN =============================== */

export function LevelBadge({ level }: { level: string }) {
  return (
    <span className={`badge badge-${level}`}>
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: LEVEL_WARNA[level] || "var(--muted)" }}
      />
      {LEVEL_LABEL[level] || level}
    </span>
  );
}

export function Progress({
  persen,
  level,
  tinggi = 7,
}: {
  persen: number;
  level: string;
  tinggi?: number;
}) {
  const lebar = Math.min(100, Math.max(0, persen));
  return (
    <div className="bar" style={{ height: tinggi }}>
      <i
        style={{
          width: `${lebar}%`,
          background: LEVEL_WARNA[level] || "var(--accent)",
        }}
      />
    </div>
  );
}

export function Kosong({
  ikon,
  judul,
  isi,
  aksi,
}: {
  ikon: ReactNode;
  judul: string;
  isi?: string;
  aksi?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6">
      <div
        className="grid place-items-center w-14 h-14 rounded-2xl mb-4"
        style={{ background: "var(--surface-3)", color: "var(--muted)" }}
      >
        {ikon}
      </div>
      <p className="font-semibold text-[14.5px]">{judul}</p>
      {isi && <p className="text-[13px] muted mt-1.5 max-w-[380px] leading-relaxed">{isi}</p>}
      {aksi && <div className="mt-5">{aksi}</div>}
    </div>
  );
}

export function Skeleton({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return <div className={`skeleton ${className}`} style={style} />;
}

export function Galat({
  pesan,
  onCobaLagi,
}: {
  pesan: string;
  onCobaLagi?: () => void;
}) {
  return (
    <div
      className="rounded-2xl p-4 flex items-start gap-3"
      style={{
        background: "color-mix(in srgb, var(--danger) 8%, transparent)",
        border: "1px solid color-mix(in srgb, var(--danger) 22%, transparent)",
      }}
    >
      <div className="flex-1 text-[13.5px] leading-relaxed">
        <p className="font-semibold mb-0.5" style={{ color: "var(--danger)" }}>
          Could not load data
        </p>
        <p className="text-2">{pesan}</p>
      </div>
      {onCobaLagi && (
        <button onClick={onCobaLagi} className="btn btn-ghost btn-sm shrink-0">
          Try again
        </button>
      )}
    </div>
  );
}

export function PilihBulan({
  nilai,
  onUbah,
}: {
  nilai: string;
  onUbah: (bulan: string) => void;
}) {
  return (
    <input
      type="month"
      className="input"
      style={{ width: 165 }}
      value={nilai}
      onChange={(e) => e.target.value && onUbah(e.target.value)}
    />
  );
}
