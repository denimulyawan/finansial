"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";

type JenisToast = "sukses" | "gagal" | "info";

interface Toast {
  id: number;
  jenis: JenisToast;
  pesan: string;
}

interface ToastCtx {
  sukses: (pesan: string) => void;
  gagal: (pesan: string) => void;
  info: (pesan: string) => void;
}

const Ctx = createContext<ToastCtx | null>(null);

let urutan = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [daftar, setDaftar] = useState<Toast[]>([]);

  const tambah = useCallback((jenis: JenisToast, pesan: string) => {
    const id = ++urutan;
    setDaftar((d) => [...d, { id, jenis, pesan }]);
    setTimeout(() => {
      setDaftar((d) => d.filter((t) => t.id !== id));
    }, jenis === "gagal" ? 6000 : 3600);
  }, []);

  const nilai: ToastCtx = {
    sukses: (p) => tambah("sukses", p),
    gagal: (p) => tambah("gagal", p),
    info: (p) => tambah("info", p),
  };

  return (
    <Ctx.Provider value={nilai}>
      {children}
      <div className="fixed z-[100] bottom-4 left-1/2 -translate-x-1/2 sm:left-auto sm:right-5 sm:translate-x-0 flex flex-col gap-2 w-[calc(100vw-32px)] sm:w-[380px] pointer-events-none">
        {daftar.map((t) => (
          <ToastItem
            key={t.id}
            toast={t}
            onTutup={() => setDaftar((d) => d.filter((x) => x.id !== t.id))}
          />
        ))}
      </div>
    </Ctx.Provider>
  );
}

function ToastItem({ toast, onTutup }: { toast: Toast; onTutup: () => void }) {
  const warna =
    toast.jenis === "sukses"
      ? "var(--success)"
      : toast.jenis === "gagal"
        ? "var(--danger)"
        : "var(--info)";

  const Ikon =
    toast.jenis === "sukses"
      ? CheckCircle2
      : toast.jenis === "gagal"
        ? TriangleAlert
        : Info;

  return (
    <div
      className="card anim-scale pointer-events-auto flex items-start gap-3 p-3.5 pr-2.5"
      style={{ boxShadow: "var(--shadow-lg)" }}
    >
      <span
        className="shrink-0 grid place-items-center w-8 h-8 rounded-full"
        style={{ background: `color-mix(in srgb, ${warna} 15%, transparent)`, color: warna }}
      >
        <Ikon size={17} strokeWidth={2.4} />
      </span>
      <p className="flex-1 text-[13.5px] leading-snug pt-1.5 text-2">{toast.pesan}</p>
      <button
        onClick={onTutup}
        className="shrink-0 grid place-items-center w-7 h-7 rounded-lg muted hover:text-[var(--text)] transition"
        aria-label="Tutup"
      >
        <X size={15} />
      </button>
    </div>
  );
}

export function useToast(): ToastCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast harus dipakai di dalam ToastProvider");
  return ctx;
}
