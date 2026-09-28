"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  HandCoins,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Plus,
  Settings,
  Sun,
  Target,
  Wallet as WalletIcon,
  X,
} from "lucide-react";
import { Avatar, Merek, useAuth } from "@/components/auth";
import TxForm from "@/components/TxForm";
import { Modal } from "@/components/ui";
import { ambilTema, simpanTema } from "@/lib/api";
import { EVENT_BOOTSTRAP } from "@/lib/hooks";

const MENU = [
  { href: "/", label: "Dashboard", Ikon: LayoutDashboard },
  { href: "/transaksi", label: "Transaksi", Ikon: ArrowLeftRight },
  { href: "/dompet", label: "Dompet", Ikon: WalletIcon },
  { href: "/budget", label: "Budget", Ikon: Target },
  { href: "/hutang", label: "Hutang & Piutang", Ikon: HandCoins },
  { href: "/laporan", label: "Laporan", Ikon: BarChart3 },
  { href: "/pengaturan", label: "Pengaturan", Ikon: Settings },
];

const KUNCI_CIUT = "finansial.sidebar";

export default function AppShell({ children }: { children: ReactNode }) {
  const { user, bootstrap, keluar, muatUlang } = useAuth();
  const path = usePathname();

  const [drawer, setDrawer] = useState(false);
  const [ciut, setCiut] = useState(false);
  const [tema, setTema] = useState<"light" | "dark">("light");
  const [menuUser, setMenuUser] = useState(false);
  const [cepat, setCepat] = useState(false);

  /* pulihkan preferensi */
  useEffect(() => {
    try {
      setCiut(localStorage.getItem(KUNCI_CIUT) === "1");
    } catch {
      /* abaikan */
    }
    setTema(ambilTema());
  }, []);

  /* segarkan data dasar saat dompet/kategori berubah */
  useEffect(() => {
    const h = () => {
      muatUlang().catch(() => {});
    };
    window.addEventListener(EVENT_BOOTSTRAP, h);
    return () => window.removeEventListener(EVENT_BOOTSTRAP, h);
  }, [muatUlang]);

  /* tutup drawer setiap pindah halaman */
  useEffect(() => {
    setDrawer(false);
    setMenuUser(false);
  }, [path]);

  function toggleCiut() {
    setCiut((c) => {
      const baru = !c;
      try {
        localStorage.setItem(KUNCI_CIUT, baru ? "1" : "0");
      } catch {
        /* abaikan */
      }
      return baru;
    });
  }

  function toggleTema() {
    const baru = tema === "dark" ? "light" : "dark";
    setTema(baru);
    simpanTema(baru);
  }

  const isAktif = (href: string) =>
    href === "/" ? path === "/" : path.startsWith(href);

  const navigasi = (
    <>
      <div className="flex items-center gap-2.5 px-4 h-[68px] shrink-0">
        <Merek size={34} />
        <div className="min-w-0">
          <p className="font-semibold text-[15px] leading-tight title">Finansial</p>
          <p className="text-[11.5px] muted leading-tight">Catatan keuangan</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2.5 py-2 space-y-0.5">
        {MENU.map(({ href, label, Ikon }) => {
          const aktif = isAktif(href);
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 h-10 px-3 rounded-[10px] text-[13.5px] font-medium transition"
              style={{
                background: aktif ? "var(--accent-soft)" : "transparent",
                color: aktif ? "var(--accent)" : "var(--text-2)",
              }}
            >
              <Ikon size={17.5} strokeWidth={aktif ? 2.5 : 2} className="shrink-0" />
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-2.5 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2.5 p-2 rounded-xl">
          <Avatar nama={user?.nama || user?.email || "?"} size={34} />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold truncate">
              {user?.nama || "Tanpa nama"}
            </p>
            <p className="text-[11.5px] muted truncate">{user?.email}</p>
          </div>
          <button
            onClick={keluar}
            className="btn btn-ghost btn-icon btn-sm shrink-0"
            title="Keluar"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen">
      {/* ---------- sidebar desktop ---------- */}
      <aside
        className="hidden lg:flex flex-col fixed inset-y-0 left-0 w-[248px] z-30 transition-transform duration-300"
        style={{
          background: "var(--surface)",
          borderRight: "1px solid var(--border)",
          transform: ciut ? "translateX(-100%)" : "none",
        }}
      >
        {navigasi}
      </aside>

      {/* ---------- drawer mobile ---------- */}
      {drawer && <div className="overlay lg:hidden" onClick={() => setDrawer(false)} />}
      <aside
        className="lg:hidden fixed inset-y-0 left-0 w-[272px] z-50 flex flex-col transition-transform duration-300"
        style={{
          background: "var(--surface)",
          borderRight: "1px solid var(--border)",
          transform: drawer ? "none" : "translateX(-100%)",
        }}
      >
        <button
          onClick={() => setDrawer(false)}
          className="absolute top-4 right-3 btn btn-ghost btn-icon btn-sm z-10"
          aria-label="Tutup menu"
        >
          <X size={17} />
        </button>
        {navigasi}
      </aside>

      {/* ---------- area konten ---------- */}
      <div
        className="transition-[padding] duration-300"
        style={{ paddingLeft: 0 }}
      >
        <div className={ciut ? "lg:pl-0" : "lg:pl-[248px]"}>
          <header
            className="sticky top-0 z-20 h-[64px] flex items-center gap-3 px-4 sm:px-6"
            style={{
              background: "color-mix(in srgb, var(--bg) 82%, transparent)",
              backdropFilter: "blur(14px)",
              borderBottom: "1px solid var(--border)",
            }}
          >
            {/* hamburger desktop */}
            <button
              onClick={toggleCiut}
              className="hidden lg:grid btn btn-ghost btn-icon btn-sm place-items-center"
              title={ciut ? "Tampilkan menu" : "Sembunyikan menu"}
            >
              {ciut ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>

            {/* hamburger mobile */}
            <button
              onClick={() => setDrawer(true)}
              className="lg:hidden grid btn btn-ghost btn-icon btn-sm place-items-center"
              aria-label="Buka menu"
            >
              <Menu size={18} />
            </button>

            <div className="flex-1" />

            <button
              onClick={() => setCepat(true)}
              className="btn btn-primary btn-sm"
              title="Catat transaksi cepat"
            >
              <Plus size={16} strokeWidth={2.6} />
              <span className="hidden sm:inline">Catat</span>
            </button>

            <button
              onClick={toggleTema}
              className="btn btn-ghost btn-icon btn-sm"
              title={tema === "dark" ? "Mode terang" : "Mode gelap"}
            >
              {tema === "dark" ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            {/* menu pengguna (mobile) */}
            <div className="lg:hidden relative">
              <button
                onClick={() => setMenuUser((v) => !v)}
                className="shrink-0"
                aria-label="Menu pengguna"
              >
                <Avatar nama={user?.nama || user?.email || "?"} size={32} />
              </button>
              {menuUser && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setMenuUser(false)} />
                  <div
                    className="absolute right-0 top-11 z-40 w-[236px] card p-2 anim-scale"
                    style={{ boxShadow: "var(--shadow-lg)" }}
                  >
                    <div className="px-2.5 py-2">
                      <p className="text-[13px] font-semibold truncate">
                        {user?.nama || "Tanpa nama"}
                      </p>
                      <p className="text-[11.5px] muted truncate">{user?.email}</p>
                    </div>
                    <div className="divider my-1" />
                    <button
                      onClick={keluar}
                      className="w-full flex items-center gap-2.5 h-9 px-2.5 rounded-lg text-[13px] text-2 hover:bg-[var(--surface-3)] transition"
                    >
                      <LogOut size={16} /> Keluar
                    </button>
                  </div>
                </>
              )}
            </div>
          </header>

          <main className="p-4 sm:p-6 max-w-[1440px] mx-auto">{children}</main>
        </div>
      </div>

      {/* ---------- catat cepat ---------- */}
      <Modal
        buka={cepat}
        onTutup={() => setCepat(false)}
        judul="Catat transaksi"
        sub="Pemasukan, pengeluaran, atau pindah antar dompet."
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
    </div>
  );
}
