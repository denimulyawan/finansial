"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  BarChart3,

  HandCoins,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Target,
  Wallet as WalletIcon,
  X,
} from "lucide-react";
import { Avatar, Merek, useAuth } from "@/components/auth";
import { EVENT_BOOTSTRAP } from "@/lib/hooks";

const MENU = [
  { href: "/", label: "Dashboard", Ikon: LayoutDashboard },
  { href: "/transaksi", label: "Transactions", Ikon: ArrowLeftRight },
  { href: "/dompet", label: "Wallets", Ikon: WalletIcon },
  { href: "/budget", label: "Budgets", Ikon: Target },
  { href: "/hutang", label: "Debts", Ikon: HandCoins },
  { href: "/laporan", label: "Reports", Ikon: BarChart3 },
  { href: "/pengaturan", label: "Settings", Ikon: Settings },
];

const KUNCI_CIUT = "finansial.sidebar";

export default function AppShell({ children }: { children: ReactNode }) {
  const { user, keluar, muatUlang } = useAuth();
  const path = usePathname();

  const [drawer, setDrawer] = useState(false);
  const [ciut, setCiut] = useState(false);
  const [menuUser, setMenuUser] = useState(false);

  useEffect(() => {
    try {
      setCiut(localStorage.getItem(KUNCI_CIUT) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const h = () => {
      muatUlang().catch(() => {});
    };
    window.addEventListener(EVENT_BOOTSTRAP, h);
    return () => window.removeEventListener(EVENT_BOOTSTRAP, h);
  }, [muatUlang]);

  useEffect(() => {
    setDrawer(false);
    setMenuUser(false);
  }, [path]);

  /* Satu tombol untuk dua keadaan:
     jendela lebar  -> sembunyikan / tampilkan sidebar
     jendela sempit -> buka menu geser dari kiri */
  function toggleMenu() {
    if (!window.matchMedia("(min-width: 1024px)").matches) {
      setDrawer(true);
      return;
    }
    setCiut((c) => {
      const baru = !c;
      try {
        localStorage.setItem(KUNCI_CIUT, baru ? "1" : "0");
      } catch {
        /* ignore */
      }
      return baru;
    });
  }

  const isAktif = (href: string) =>
    href === "/" ? path === "/" : path.startsWith(href);

  const navigasi = (
    <>
      <div className="flex items-center gap-2.5 px-4 h-[62px] shrink-0">
        <Merek size={32} />
        <p className="font-semibold text-[15px] title">Finansial</p>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-1.5 space-y-0.5">
        {MENU.map(({ href, label, Ikon }) => {
          const aktif = isAktif(href);
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2.5 h-9 px-2.5 rounded-[9px] text-[13.5px] font-medium transition"
              style={{
                background: aktif ? "var(--accent-soft)" : "transparent",
                color: aktif ? "var(--accent)" : "var(--text-2)",
              }}
            >
              <Ikon size={17} strokeWidth={aktif ? 2.5 : 2} className="shrink-0" />
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-2 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2.5 p-2 rounded-xl">
          <Avatar nama={user?.nama || user?.email || "?"} size={32} />
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-semibold truncate">
              {user?.nama || "No name"}
            </p>
            <p className="text-[11px] muted truncate">{user?.email}</p>
          </div>
          <button
            onClick={keluar}
            className="btn btn-ghost btn-icon btn-sm shrink-0"
            title="Sign out"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen">
      <aside
        className="hidden lg:flex flex-col fixed inset-y-0 left-0 w-[228px] z-30 transition-transform duration-300"
        style={{
          background: "var(--surface)",
          borderRight: "1px solid var(--border)",
          transform: ciut ? "translateX(-100%)" : "none",
        }}
      >
        {navigasi}
      </aside>

      {drawer && <div className="overlay lg:hidden" onClick={() => setDrawer(false)} />}
      <aside
        className="lg:hidden fixed inset-y-0 left-0 w-[264px] z-50 flex flex-col transition-transform duration-300"
        style={{
          background: "var(--surface)",
          borderRight: "1px solid var(--border)",
          transform: drawer ? "none" : "translateX(-100%)",
        }}
      >
        <button
          onClick={() => setDrawer(false)}
          className="absolute top-3.5 right-3 btn btn-ghost btn-icon btn-sm z-10"
          aria-label="Close menu"
        >
          <X size={16} />
        </button>
        {navigasi}
      </aside>

      <div className={ciut ? "lg:pl-0" : "lg:pl-[228px]"}>
        <header
          className="sticky top-0 z-20 h-[58px] flex items-center gap-2 px-4 sm:px-6"
          style={{
            background: "rgba(255,255,255,.86)",
            backdropFilter: "blur(12px)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <button
            onClick={toggleMenu}
            className="grid btn btn-ghost btn-icon btn-sm place-items-center"
            aria-label="Menu"
            title="Menu"
          >
            <Menu size={17} />
          </button>

          <div className="flex-1" />

          <div className="lg:hidden relative">
            <button onClick={() => setMenuUser((v) => !v)} aria-label="Account">
              <Avatar nama={user?.nama || user?.email || "?"} size={31} />
            </button>
            {menuUser && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setMenuUser(false)} />
                <div
                  className="absolute right-0 top-10 z-40 w-[228px] card p-1.5 anim-scale"
                  style={{ boxShadow: "var(--shadow)" }}
                >
                  <div className="px-2.5 py-2">
                    <p className="text-[12.5px] font-semibold truncate">
                      {user?.nama || "No name"}
                    </p>
                    <p className="text-[11px] muted truncate">{user?.email}</p>
                  </div>
                  <div className="divider my-1" />
                  <button
                    onClick={keluar}
                    className="w-full flex items-center gap-2.5 h-8 px-2.5 rounded-lg text-[12.5px] text-2 hover:bg-[var(--surface-2)] transition"
                  >
                    <LogOut size={15} /> Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        <main className="p-4 sm:p-6 max-w-[1400px] mx-auto">{children}</main>
      </div>
    </div>
  );
}
