"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ShieldAlert, TriangleAlert } from "lucide-react";
import {
  ApiError,
  EVENT_KELUAR,
  EVENT_META,
  GOOGLE_CLIENT_ID,
  adaKonfigurasi,
  ambilToken,
  ambilUser,
  api,
  hapusSesi,
  muatGoogleIdentity,
  simpanToken,
  simpanUser,
} from "@/lib/api";
import type { Bootstrap, User } from "@/lib/types";
import { inisial } from "@/lib/format";
import { EVENT_BOOTSTRAP } from "@/lib/hooks";

interface AuthCtx {
  siap: boolean;
  user: User | null;
  bootstrap: Bootstrap | null;
  pesanMasuk: string | null;
  masuk: (credential: string) => Promise<void>;
  keluar: () => void;
  muatUlang: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [siap, setSiap] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [pesanMasuk, setPesanMasuk] = useState<string | null>(null);

  const muatUlang = useCallback(async () => {
    const data = await api<Bootstrap>("bootstrap");
    setBootstrap(data);
    setUser(data.user);
    simpanUser(data.user);
    setPesanMasuk(null);
  }, []);

  useEffect(() => {
    /* TIDAK memanggil server saat aplikasi dibuka.
       Pengguna dipulihkan dari penyimpanan lokal, dan data dasar (dompet,
       kategori) menyusul bersama permintaan pertama halaman. Jadi membuka
       aplikasi hanya perlu SATU perjalanan, bukan dua. */
    if (ambilToken()) {
      const tersimpan = ambilUser<User>();
      if (tersimpan) setUser(tersimpan);
    }
    setSiap(true);
  }, []);

  const masuk = useCallback(
    async (credential: string) => {
      simpanToken(credential);
      try {
        await muatUlang();
      } catch (e) {
        hapusSesi();
        throw e as ApiError;
      }
    },
    [muatUlang]
  );

  useEffect(() => {
    const h = () => {
      muatUlang().catch(() => {});
    };
    window.addEventListener(EVENT_BOOTSTRAP, h);
    return () => window.removeEventListener(EVENT_BOOTSTRAP, h);
  }, [muatUlang]);

  const keluar = useCallback(() => {
    hapusSesi();
    setUser(null);
    setBootstrap(null);
    const g = (window as unknown as { google?: { accounts?: { id?: { disableAutoSelect?: () => void } } } }).google;
    try {
      g?.accounts?.id?.disableAutoSelect?.();
    } catch {
      /* ignore */
    }
  }, []);

  /* Data dasar (pengguna, dompet, kategori) yang ikut pada setiap balasan
     server. Karena itu aplikasi tidak perlu memintanya terpisah. */
  useEffect(() => {
    const h = (ev: Event) => {
      const m = (ev as CustomEvent).detail as Bootstrap | undefined;
      if (!m) return;
      setBootstrap(m);
      if (m.user) setUser(m.user);
    };
    window.addEventListener(EVENT_META, h);
    return () => window.removeEventListener(EVENT_META, h);
  }, []);

  /* Sesi kedaluwarsa di tengah pemakaian: keluar dengan tenang. */
  useEffect(() => {
    const h = () => {
      /* jelaskan kenapa tiba-tiba kembali ke halaman masuk */
      setPesanMasuk("Sesi berakhir. Silakan masuk lagi.");
      keluar();
    };
    window.addEventListener(EVENT_KELUAR, h);
    return () => window.removeEventListener(EVENT_KELUAR, h);
  }, [keluar]);

  return (
    <Ctx.Provider value={{ siap, user, bootstrap, pesanMasuk, masuk, keluar, muatUlang }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

/* ================================== GATE ================================== */

export function Gerbang({ children }: { children: ReactNode }) {
  const { siap, user } = useAuth();

  if (!siap) return <MemuatAwal />;
  if (!user) return <HalamanMasuk />;
  return <>{children}</>;
}

function MemuatAwal() {
  return (
    <div className="min-h-screen grid place-items-center px-4">
      <div className="flex flex-col items-center gap-3.5 anim-in">
        <div className="spinner" style={{ width: 24, height: 24, color: "var(--accent)" }} />
        <p className="text-[13px] muted">Loading…</p>
      </div>
    </div>
  );
}

export function HalamanMasuk() {
  const { masuk, pesanMasuk } = useAuth();
  const tombolRef = useRef<HTMLDivElement>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [sedang, setSedang] = useState(false);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID.includes("XXXX")) return;
    let batal = false;

    muatGoogleIdentity()
      .then(() => {
        if (batal || !tombolRef.current) return;
        const g = (window as unknown as {
          google?: {
            accounts?: {
              id?: {
                initialize: (o: Record<string, unknown>) => void;
                renderButton: (el: HTMLElement, o: Record<string, unknown>) => void;
              };
            };
          };
        }).google;

        if (!g?.accounts?.id) throw new Error("Google sign-in is unavailable.");

        g.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: async (resp: { credential?: string }) => {
            if (!resp?.credential) return;
            setSedang(true);
            setGalat(null);
            try {
              await masuk(resp.credential);
            } catch (e) {
              setGalat((e as ApiError).message);
            } finally {
              setSedang(false);
            }
          },
          auto_select: true,
          cancel_on_tap_outside: false,
        });

        tombolRef.current.innerHTML = "";
        g.accounts.id.renderButton(tombolRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          shape: "pill",
          text: "signin_with",
          logo_alignment: "left",
          locale: "en",
          width: 300,
        });
      })
      .catch((e: Error) => {
        if (!batal) setGalat(e.message);
      });

    return () => {
      batal = true;
    };
  }, [masuk]);

  const kurangKonfigurasi = !adaKonfigurasi();
  const pesan = galat || pesanMasuk;

  return (
    <div className="min-h-screen grid place-items-center px-4 py-10">
      <div className="w-full max-w-[380px] anim-up">
        <div className="flex flex-col items-center mb-6">
          <Merek size={48} />
          <h1 className="title text-[23px] mt-3.5">Finansial</h1>
        </div>

        <div className="card card-lg card-pad">
          {kurangKonfigurasi ? (
            <Peringatan ikon={<ShieldAlert size={17} />} judul="Backend not connected">
              Set <Kode>NEXT_PUBLIC_GAS_URL</Kode> and{" "}
              <Kode>NEXT_PUBLIC_GOOGLE_CLIENT_ID</Kode> in <Kode>.env.local</Kode>,
              then restart.
            </Peringatan>
          ) : (
            <>
              <h2 className="text-[14.5px] font-semibold mb-1">Sign in</h2>
              <p className="text-[12.5px] muted mb-5">
                Use a Google account registered by the admin.
              </p>

              {pesan && (
                <div className="mb-4">
                  <Peringatan ikon={<TriangleAlert size={17} />} judul={pesan} />
                </div>
              )}

              <div className="flex justify-center min-h-[44px]">
                {sedang ? (
                  <div className="flex items-center gap-2.5 py-3 text-[13px] muted">
                    <span className="spinner" style={{ color: "var(--accent)" }} />
                    Checking account…
                  </div>
                ) : (
                  <div ref={tombolRef} />
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Peringatan({
  ikon,
  judul,
  children,
}: {
  ikon: ReactNode;
  judul: string;
  children?: ReactNode;
}) {
  return (
    <div
      className="flex items-start gap-2.5 rounded-xl p-3"
      style={{
        background: "color-mix(in srgb, var(--warning) 8%, transparent)",
        border: "1px solid color-mix(in srgb, var(--warning) 22%, transparent)",
      }}
    >
      <span className="shrink-0 mt-0.5" style={{ color: "var(--warning)" }}>
        {ikon}
      </span>
      <div className="text-[12.5px] leading-relaxed min-w-0">
        <p className="font-semibold">{judul}</p>
        {children && <p className="text-2 mt-0.5">{children}</p>}
      </div>
    </div>
  );
}

function Kode({ children }: { children: ReactNode }) {
  return (
    <code
      className="px-1 py-0.5 rounded-md text-[11px] font-mono"
      style={{ background: "var(--surface-3)" }}
    >
      {children}
    </code>
  );
}

/* ================================== BRAND ================================= */

export function Merek({ size = 34 }: { size?: number }) {
  return (
    <div
      className="grid place-items-center rounded-[12px] font-bold text-white shrink-0"
      style={{
        width: size,
        height: size,
        background: "var(--accent)",
        fontSize: size * 0.46,
        letterSpacing: "-0.04em",
      }}
    >
      F
    </div>
  );
}

export function Avatar({ nama, size = 34 }: { nama: string; size?: number }) {
  return (
    <div
      className="grid place-items-center rounded-full font-semibold shrink-0"
      style={{
        width: size,
        height: size,
        background: "var(--surface-3)",
        color: "var(--text-2)",
        fontSize: size * 0.38,
      }}
    >
      {inisial(nama)}
    </div>
  );
}
