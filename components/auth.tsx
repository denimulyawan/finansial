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
import { LogIn, ShieldAlert, WifiOff } from "lucide-react";
import {
  ApiError,
  GOOGLE_CLIENT_ID,
  adaKonfigurasi,
  ambilToken,
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

  /* ---- cek sesi tersimpan saat halaman dibuka ---- */
  useEffect(() => {
    let hidup = true;
    (async () => {
      const token = ambilToken();
      if (!token) {
        if (hidup) setSiap(true);
        return;
      }
      try {
        await muatUlang();
      } catch (e) {
        hapusSesi();
        if (hidup) {
          const err = e as ApiError;
          setPesanMasuk(
            err.code === "UNAUTHORIZED"
              ? "Sesi sebelumnya sudah berakhir. Silakan masuk lagi."
              : err.message
          );
        }
      } finally {
        if (hidup) setSiap(true);
      }
    })();
    return () => {
      hidup = false;
    };
  }, [muatUlang]);

  const masuk = useCallback(
    async (credential: string) => {
      simpanToken(credential);
      try {
        await muatUlang();
      } catch (e) {
        hapusSesi();
        const err = e as ApiError;
        throw err;
      }
    },
    [muatUlang]
  );

  /* segarkan data dasar saat dompet/kategori berubah */
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
      /* abaikan */
    }
  }, []);

  return (
    <Ctx.Provider value={{ siap, user, bootstrap, pesanMasuk, masuk, keluar, muatUlang }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth harus dipakai di dalam AuthProvider");
  return ctx;
}

/* ============================== GERBANG MASUK ============================= */

export function Gerbang({ children }: { children: ReactNode }) {
  const { siap, user } = useAuth();

  if (!siap) return <MemuatAwal />;
  if (!user) return <HalamanMasuk />;
  return <>{children}</>;
}

function MemuatAwal() {
  return (
    <div className="min-h-screen grid place-items-center px-4">
      <div className="flex flex-col items-center gap-4 anim-in">
        <div className="spinner" style={{ width: 26, height: 26, color: "var(--accent)" }} />
        <p className="text-sm muted">Menyiapkan aplikasi…</p>
      </div>
    </div>
  );
}

export function HalamanMasuk() {
  const { masuk, pesanMasuk } = useAuth();
  const tombolRef = useRef<HTMLDivElement>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [sedang, setSedang] = useState(false);

  const temaSekarang = useCallback((): "outline" | "filled_black" => {
    if (typeof document === "undefined") return "outline";
    return document.documentElement.classList.contains("dark") ? "filled_black" : "outline";
  }, []);

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
                prompt: () => void;
              };
            };
          };
        }).google;

        if (!g?.accounts?.id) throw new Error("Layanan masuk Google tidak tersedia.");

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
          theme: temaSekarang(),
          size: "large",
          shape: "pill",
          text: "signin_with",
          logo_alignment: "left",
          locale: "id",
          width: 300,
        });
      })
      .catch((e: Error) => {
        if (!batal) setGalat(e.message);
      });

    return () => {
      batal = true;
    };
  }, [masuk, temaSekarang]);

  const konfigurasiKurang = !adaKonfigurasi();

  return (
    <div className="min-h-screen grid place-items-center px-4 py-10">
      <div className="w-full max-w-[420px] anim-up">
        <div className="flex flex-col items-center mb-7">
          <Merek size={52} />
          <h1 className="title text-[26px] mt-4">Finansial</h1>
          <p className="text-sm muted mt-1 text-center">
            Catatan keuangan rumah tangga
          </p>
        </div>

        <div className="card card-lg card-pad">
          {konfigurasiKurang ? (
            <Peringatan
              ikon={<ShieldAlert size={18} />}
              judul="Backend belum disambungkan"
              isi={
                <>
                  Isi <Kode>NEXT_PUBLIC_GAS_URL</Kode> dan{" "}
                  <Kode>NEXT_PUBLIC_GOOGLE_CLIENT_ID</Kode> di file{" "}
                  <Kode>.env.local</Kode>, lalu jalankan ulang aplikasi. Lihat
                  README untuk langkah lengkapnya.
                </>
              }
            />
          ) : (
            <>
              <h2 className="text-[15px] font-semibold mb-1">Masuk</h2>
              <p className="text-[13px] muted mb-5">
                Gunakan akun Google yang sudah didaftarkan admin. Tidak perlu
                membuat kata sandi.
              </p>

              {(galat || pesanMasuk) && (
                <div className="mb-4">
                  <Peringatan
                    ikon={<WifiOff size={18} />}
                    judul="Tidak bisa masuk"
                    isi={galat || pesanMasuk || ""}
                  />
                </div>
              )}

              <div className="flex justify-center min-h-[46px]">
                {sedang ? (
                  <div className="flex items-center gap-3 py-3 text-sm muted">
                    <span className="spinner" style={{ color: "var(--accent)" }} />
                    Memeriksa akun…
                  </div>
                ) : (
                  <div ref={tombolRef} />
                )}
              </div>

              <div className="divider my-5" />

              <div className="flex items-start gap-2.5 text-[12.5px] muted leading-relaxed">
                <LogIn size={15} className="mt-0.5 shrink-0" />
                <p>
                  Email yang belum terdaftar tidak akan bisa masuk. Minta admin
                  menambahkannya lewat menu <b>Pengaturan → Pengguna</b>.
                </p>
              </div>
            </>
          )}
        </div>

        <p className="text-[12px] muted text-center mt-6">
          Data tersimpan di Google Sheets milikmu sendiri.
        </p>
      </div>
    </div>
  );
}

function Peringatan({
  ikon,
  judul,
  isi,
}: {
  ikon: ReactNode;
  judul: string;
  isi: ReactNode;
}) {
  return (
    <div
      className="flex items-start gap-3 rounded-xl p-3.5"
      style={{
        background: "color-mix(in srgb, var(--warning) 9%, transparent)",
        border: "1px solid color-mix(in srgb, var(--warning) 24%, transparent)",
      }}
    >
      <span className="shrink-0 mt-0.5" style={{ color: "var(--warning)" }}>
        {ikon}
      </span>
      <div className="text-[13px] leading-relaxed">
        <p className="font-semibold mb-0.5">{judul}</p>
        <p className="text-2">{isi}</p>
      </div>
    </div>
  );
}

function Kode({ children }: { children: ReactNode }) {
  return (
    <code
      className="px-1.5 py-0.5 rounded-md text-[11.5px] font-mono"
      style={{ background: "var(--surface-3)" }}
    >
      {children}
    </code>
  );
}

/* ================================= MEREK ================================= */

export function Merek({ size = 36 }: { size?: number }) {
  return (
    <div
      className="grid place-items-center rounded-[13px] font-bold text-white shrink-0"
      style={{
        width: size,
        height: size,
        background: "linear-gradient(140deg, var(--accent-2), var(--accent))",
        boxShadow: "0 10px 24px -12px color-mix(in srgb, var(--accent) 85%, transparent)",
        fontSize: size * 0.46,
        letterSpacing: "-0.04em",
      }}
    >
      F
    </div>
  );
}

export function Avatar({
  nama,
  size = 34,
}: {
  nama: string;
  size?: number;
}) {
  return (
    <div
      className="grid place-items-center rounded-full font-semibold shrink-0"
      style={{
        width: size,
        height: size,
        background: "var(--accent-soft)",
        color: "var(--accent)",
        fontSize: size * 0.38,
      }}
    >
      {inisial(nama)}
    </div>
  );
}
