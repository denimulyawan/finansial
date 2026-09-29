"use client";

import { useState } from "react";
import {
  Bell,
  CheckCircle2,
  Database,
  ExternalLink,
  Pencil,
  Plus,
  Send,
  ShieldCheck,
  Tags,
  Trash2,
  TriangleAlert,
  UserPlus,
  Users,
} from "lucide-react";
import { ApiError, api, idBaru } from "@/lib/api";
import { picuBootstrap, useApi } from "@/lib/hooks";
import { Avatar, useAuth } from "@/components/auth";
import { useToast } from "@/components/toast";
import { Card, Field, Galat, Kosong, Modal, PageHeader, Skeleton } from "@/components/ui";
import { labelTanggal } from "@/lib/format";
import type { Category, User } from "@/lib/types";

type Tab = "profil" | "pengguna" | "kategori" | "notifikasi" | "data";

const TAB: { v: Tab; l: string; Ikon: React.ComponentType<{ size?: number }> }[] = [
  { v: "profil", l: "Profile", Ikon: ShieldCheck },
  { v: "pengguna", l: "Users", Ikon: Users },
  { v: "kategori", l: "Categories", Ikon: Tags },
  { v: "notifikasi", l: "Alerts", Ikon: Bell },
  { v: "data", l: "Data", Ikon: Database },
];

const WARNA_PILIHAN = [
  "#f97316", "#f59e0b", "#eab308", "#84cc16", "#10b981",
  "#14b8a6", "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6",
  "#a855f7", "#ec4899", "#f43f5e", "#ef4444", "#64748b",
];

export default function HalamanPengaturan() {
  const [tab, setTab] = useState<Tab>("profil");

  return (
    <>
      <PageHeader judul="Settings" />

      <div className="flex gap-1.5 mb-5 overflow-x-auto hide-scroll pb-1">
        {TAB.map(({ v, l, Ikon }) => {
          const aktif = tab === v;
          return (
            <button
              key={v}
              onClick={() => setTab(v)}
              className="flex items-center gap-1.5 h-8 px-3 rounded-[9px] text-[12.5px] font-medium whitespace-nowrap transition shrink-0"
              style={{
                background: aktif ? "var(--accent-soft)" : "var(--surface)",
                color: aktif ? "var(--accent)" : "var(--text-2)",
                border: `1px solid ${aktif ? "transparent" : "var(--border)"}`,
              }}
            >
              <Ikon size={14} />
              {l}
            </button>
          );
        })}
      </div>

      {tab === "profil" && <BagianProfil />}
      {tab === "pengguna" && <BagianPengguna />}
      {tab === "kategori" && <BagianKategori />}
      {tab === "notifikasi" && <BagianNotifikasi />}
      {tab === "data" && <BagianData />}
    </>
  );
}

/* ================================= PROFILE ================================ */

function BagianProfil() {
  const toast = useToast();
  const { user, muatUlang } = useAuth();
  const [nama, setNama] = useState(user?.nama || "");
  const [sedang, setSedang] = useState(false);

  async function simpan() {
    if (!user) return;
    setSedang(true);
    try {
      await api("users.save", {
        user: { email: user.email, nama, peran: user.peran, status: user.status },
      });
      toast.sukses("Profile updated.");
      await muatUlang();
    } catch (e) {
      toast.gagal(e instanceof ApiError ? e.message : "Could not save.");
    } finally {
      setSedang(false);
    }
  }

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Card besar>
        <div className="flex items-center gap-3.5 mb-5">
          <Avatar nama={user?.nama || user?.email || "?"} size={52} />
          <div className="min-w-0">
            <p className="font-semibold text-[15px] title truncate">
              {user?.nama || "No name"}
            </p>
            <p className="text-[12.5px] muted truncate">{user?.email}</p>
          </div>
        </div>

        <Field label="Display name">
          <input
            className="input"
            value={nama}
            placeholder="Your name"
            onChange={(e) => setNama(e.target.value)}
          />
        </Field>

        <div className="flex justify-end mt-3.5">
          <button className="btn btn-primary btn-sm" onClick={simpan} disabled={sedang}>
            {sedang ? "Saving…" : "Save"}
          </button>
        </div>
      </Card>

      <Card besar>
        <h2 className="text-[14.5px] font-semibold title mb-4">Security</h2>
        <div className="space-y-3">
          <BarisInfo
            ikon={<CheckCircle2 size={15} />}
            judul="Google sign-in"
            isi="No password is stored anywhere."
            warna="var(--success)"
          />
          <BarisInfo
            ikon={<ShieldCheck size={15} />}
            judul="Registered emails only"
            isi="Other Google accounts are rejected."
            warna="var(--accent)"
          />
          <BarisInfo
            ikon={<Database size={15} />}
            judul="Your own data"
            isi="Everything lives in your Google Sheet."
            warna="var(--info)"
          />
        </div>
        {user?.last_login && (
          <p className="text-[11.5px] muted mt-5">
            Last sign-in: {user.last_login.replace("T", " ")}
          </p>
        )}
      </Card>
    </div>
  );
}

function BarisInfo({
  ikon,
  judul,
  isi,
  warna,
}: {
  ikon: React.ReactNode;
  judul: string;
  isi: string;
  warna: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="shrink-0 mt-0.5" style={{ color: warna }}>
        {ikon}
      </span>
      <div>
        <p className="text-[13px] font-medium">{judul}</p>
        <p className="muted text-[12px] mt-0.5">{isi}</p>
      </div>
    </div>
  );
}

/* ================================== USERS ================================= */

function BagianPengguna() {
  const toast = useToast();
  const { user: saya, muatUlang } = useAuth();
  const { data, loading, error, reload } = useApi<{ users: User[] }>("users.list");
  const [form, setForm] = useState<{ buka: boolean; awal: User | null }>({
    buka: false,
    awal: null,
  });
  const [hapus, setHapus] = useState<User | null>(null);

  const users = data?.users || [];

  async function konfirmasiHapus() {
    if (!hapus) return;
    try {
      await api("users.delete", { email: hapus.email });
      toast.sukses("User removed.");
      setHapus(null);
      reload();
    } catch (e) {
      toast.gagal(e instanceof ApiError ? e.message : "Could not remove.");
    }
  }

  return (
    <>
      <Card besar pad={false}>
        <div className="flex items-center justify-between p-5 pb-3">
          <h2 className="text-[14.5px] font-semibold title">Users</h2>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setForm({ buka: true, awal: null })}
          >
            <UserPlus size={14} /> Add
          </button>
        </div>

        {error && (
          <div className="p-5 pt-0">
            <Galat pesan={error.message} onCobaLagi={reload} />
          </div>
        )}

        {loading ? (
          <div className="p-5 space-y-3">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-13 w-full" style={{ height: 52 }} />
            ))}
          </div>
        ) : (
          <div className="px-5 pb-5 space-y-1.5">
            {users.map((u) => {
              const diri = u.email === saya?.email;
              return (
                <div
                  key={u.email}
                  className="flex items-center gap-3 p-2.5 rounded-xl"
                  style={{ background: "var(--surface-2)" }}
                >
                  <Avatar nama={u.nama || u.email} size={34} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium truncate flex items-center gap-1.5">
                      {u.nama || "No name"}
                      {diri && <span className="badge badge-netral">You</span>}
                      {String(u.status).toLowerCase() !== "aktif" && (
                        <span className="badge badge-over">Inactive</span>
                      )}
                    </p>
                    <p className="text-[11px] muted truncate">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      className="btn btn-ghost btn-icon btn-sm"
                      title="Edit"
                      onClick={() => setForm({ buka: true, awal: u })}
                    >
                      <Pencil size={13} />
                    </button>
                    {!diri && (
                      <button
                        className="btn btn-ghost btn-icon btn-sm"
                        title="Remove"
                        style={{ color: "var(--danger)" }}
                        onClick={() => setHapus(u)}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Modal
        buka={form.buka}
        onTutup={() => setForm({ buka: false, awal: null })}
        judul={form.awal ? "Edit user" : "Add user"}
        lebar={440}
      >
        <FormPengguna
          awal={form.awal}
          onSelesai={() => {
            setForm({ buka: false, awal: null });
            reload();
            muatUlang().catch(() => {});
          }}
          onBatal={() => setForm({ buka: false, awal: null })}
        />
      </Modal>

      <Modal
        buka={!!hapus}
        onTutup={() => setHapus(null)}
        judul="Remove user?"
        lebar={400}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setHapus(null)}>
              Cancel
            </button>
            <button className="btn btn-danger" onClick={konfirmasiHapus}>
              Remove
            </button>
          </>
        }
      >
        {hapus && (
          <p className="text-[13px] text-2 leading-relaxed">
            <b>{hapus.email}</b> will no longer be able to sign in. Their past
            transactions stay.
          </p>
        )}
      </Modal>
    </>
  );
}

function FormPengguna({
  awal,
  onSelesai,
  onBatal,
}: {
  awal: User | null;
  onSelesai: () => void;
  onBatal: () => void;
}) {
  const toast = useToast();
  const [email, setEmail] = useState(awal?.email || "");
  const [nama, setNama] = useState(awal?.nama || "");
  const [status, setStatus] = useState(String(awal?.status || "aktif").toLowerCase());
  const [sedang, setSedang] = useState(false);

  async function simpan() {
    if (!email.includes("@")) return toast.gagal("Enter a valid email.");
    setSedang(true);
    try {
      await api("users.save", { user: { email, nama, peran: "admin", status } });
      toast.sukses("User saved.");
      onSelesai();
    } catch (e) {
      toast.gagal(e instanceof ApiError ? e.message : "Could not save.");
    } finally {
      setSedang(false);
    }
  }

  return (
    <div className="space-y-3.5">
      <Field label="Google email">
        <input
          className="input"
          type="email"
          value={email}
          autoFocus={!awal}
          disabled={!!awal}
          placeholder="name@gmail.com"
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>

      <Field label="Name">
        <input
          className="input"
          value={nama}
          placeholder="Optional"
          onChange={(e) => setNama(e.target.value)}
        />
      </Field>

      <Field label="Status">
        <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="aktif">Active</option>
          <option value="nonaktif">Inactive</option>
        </select>
      </Field>

      <div className="flex items-center justify-end gap-2 pt-1">
        <button className="btn btn-ghost" onClick={onBatal} disabled={sedang}>
          Cancel
        </button>
        <button className="btn btn-primary" onClick={simpan} disabled={sedang}>
          {sedang ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

/* ================================ CATEGORIES ============================== */

function BagianKategori() {
  const toast = useToast();
  const { bootstrap } = useAuth();
  const [form, setForm] = useState<{
    buka: boolean;
    awal: Category | null;
    tipe: "Pemasukan" | "Pengeluaran";
  }>({ buka: false, awal: null, tipe: "Pengeluaran" });
  const [hapus, setHapus] = useState<Category | null>(null);

  const kategori = bootstrap?.categories || [];
  const masuk = kategori.filter((c) => c.tipe === "Pemasukan");
  const keluar = kategori.filter((c) => c.tipe === "Pengeluaran");

  async function konfirmasiHapus() {
    if (!hapus) return;
    try {
      await api("category.delete", { id: hapus.id });
      toast.sukses("Category removed.");
      setHapus(null);
      picuBootstrap();
    } catch (e) {
      toast.gagal(e instanceof ApiError ? e.message : "Could not remove.");
    }
  }

  return (
    <>
      <div className="grid lg:grid-cols-2 gap-4">
        <DaftarKategori
          judul="Income"
          items={masuk.filter((c) => c.sistem !== 1)}
          onTambah={() => setForm({ buka: true, awal: null, tipe: "Pemasukan" })}
          onUbah={(c) => setForm({ buka: true, awal: c, tipe: c.tipe })}
          onHapus={(c) => setHapus(c)}
        />
        <DaftarKategori
          judul="Expense"
          items={keluar}
          onTambah={() => setForm({ buka: true, awal: null, tipe: "Pengeluaran" })}
          onUbah={(c) => setForm({ buka: true, awal: c, tipe: c.tipe })}
          onHapus={(c) => setHapus(c)}
        />
      </div>

      <Modal
        buka={form.buka}
        onTutup={() => setForm({ buka: false, awal: null, tipe: "Pengeluaran" })}
        judul={form.awal ? "Edit category" : "Add category"}
        lebar={440}
      >
        <FormKategori
          awal={form.awal}
          tipeAwal={form.tipe}
          onSelesai={() => {
            setForm({ buka: false, awal: null, tipe: "Pengeluaran" });
            picuBootstrap();
          }}
          onBatal={() => setForm({ buka: false, awal: null, tipe: "Pengeluaran" })}
        />
      </Modal>

      <Modal
        buka={!!hapus}
        onTutup={() => setHapus(null)}
        judul="Remove category?"
        lebar={400}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setHapus(null)}>
              Cancel
            </button>
            <button className="btn btn-danger" onClick={konfirmasiHapus}>
              Remove
            </button>
          </>
        }
      >
        {hapus && (
          <p className="text-[13px] text-2 leading-relaxed">
            <b>{hapus.nama}</b> will be removed. If it is already used, it is
            only hidden so old transactions stay intact.
          </p>
        )}
      </Modal>
    </>
  );
}

function DaftarKategori({
  judul,
  items,
  onTambah,
  onUbah,
  onHapus,
}: {
  judul: string;
  items: Category[];
  onTambah: () => void;
  onUbah: (c: Category) => void;
  onHapus: (c: Category) => void;
}) {
  return (
    <Card besar pad={false}>
      <div className="flex items-center justify-between p-5 pb-3">
        <h2 className="text-[14.5px] font-semibold title">{judul}</h2>
        <button className="btn btn-ghost btn-icon btn-sm" onClick={onTambah} title="Add">
          <Plus size={15} />
        </button>
      </div>

      <div className="px-5 pb-5 space-y-1.5">
        {items.length === 0 ? (
          <Kosong ikon={<Tags size={20} />} judul="No categories" />
        ) : (
          items.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-3 p-2.5 rounded-xl"
              style={{ background: "var(--surface-2)" }}
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: c.warna }}
              />
              <span className="text-[13px] flex-1 truncate">{c.nama}</span>
              {c.sistem === 1 && <span className="badge badge-netral">System</span>}
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  className="btn btn-ghost btn-icon btn-sm"
                  onClick={() => onUbah(c)}
                  title="Edit"
                >
                  <Pencil size={12} />
                </button>
                {c.sistem !== 1 && (
                  <button
                    className="btn btn-ghost btn-icon btn-sm"
                    style={{ color: "var(--danger)" }}
                    onClick={() => onHapus(c)}
                    title="Remove"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

function FormKategori({
  awal,
  tipeAwal,
  onSelesai,
  onBatal,
}: {
  awal: Category | null;
  tipeAwal: "Pemasukan" | "Pengeluaran";
  onSelesai: () => void;
  onBatal: () => void;
}) {
  const toast = useToast();
  const [nama, setNama] = useState(awal?.nama || "");
  const [tipe, setTipe] = useState<"Pemasukan" | "Pengeluaran">(awal?.tipe || tipeAwal);
  const [warna, setWarna] = useState(awal?.warna || "#6366f1");
  const [sedang, setSedang] = useState(false);

  async function simpan() {
    if (!nama.trim()) return toast.gagal("Enter a category name.");
    setSedang(true);
    try {
      await api("category.save", {
        category: { id: awal?.id || idBaru(), nama, tipe, warna },
      });
      toast.sukses("Category saved.");
      onSelesai();
    } catch (e) {
      toast.gagal(e instanceof ApiError ? e.message : "Could not save.");
    } finally {
      setSedang(false);
    }
  }

  return (
    <div className="space-y-3.5">
      <Field label="Name">
        <input
          className="input"
          value={nama}
          autoFocus
          placeholder="e.g. Insurance"
          onChange={(e) => setNama(e.target.value)}
        />
      </Field>

      {!awal && (
        <Field label="Type">
          <select
            className="select"
            value={tipe}
            onChange={(e) => setTipe(e.target.value as "Pemasukan" | "Pengeluaran")}
          >
            <option value="Pengeluaran">Expense</option>
            <option value="Pemasukan">Income</option>
          </select>
        </Field>
      )}

      <Field label="Color">
        <div className="flex flex-wrap gap-1.5">
          {WARNA_PILIHAN.map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setWarna(w)}
              className="w-7 h-7 rounded-[9px] transition"
              style={{
                background: w,
                outline: warna === w ? `2px solid ${w}` : "none",
                outlineOffset: 2,
                transform: warna === w ? "scale(1.08)" : "none",
              }}
              aria-label={`Color ${w}`}
            />
          ))}
        </div>
      </Field>

      <div className="flex items-center justify-end gap-2 pt-1">
        <button className="btn btn-ghost" onClick={onBatal} disabled={sedang}>
          Cancel
        </button>
        <button className="btn btn-primary" onClick={simpan} disabled={sedang}>
          {sedang ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

/* ================================== ALERTS ================================ */

function BagianNotifikasi() {
  const toast = useToast();
  const { data, loading, reload } = useApi<{
    configured: boolean;
    bot: string | null;
    chatId: string | null;
  }>("telegram.status");
  const [menguji, setMenguji] = useState(false);

  async function uji() {
    setMenguji(true);
    try {
      const hasil = await api<{ sent: boolean }>("telegram.test");
      if (hasil.sent) toast.sukses("Test message sent.");
      else toast.gagal("Could not send. Check the token and chat ID.");
    } catch (e) {
      toast.gagal(e instanceof ApiError ? e.message : "Could not send.");
    } finally {
      setMenguji(false);
    }
  }

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Card besar>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[14.5px] font-semibold title">Telegram alerts</h2>
          {loading ? (
            <Skeleton className="h-5 w-20" />
          ) : data?.configured ? (
            <span className="badge badge-aman">
              <CheckCircle2 size={11} /> Connected
            </span>
          ) : (
            <span className="badge badge-warning">
              <TriangleAlert size={11} /> Not set
            </span>
          )}
        </div>

        <div className="space-y-2 mb-4">
          <Tingkat level="warning" isi="From 70% of the cap" />
          <Tingkat level="kritis" isi="From 90% of the cap" />
          <Tingkat level="over" isi="Past 100% of the cap" />
        </div>

        <div className="flex items-center gap-2">
          <button
            className="btn btn-primary btn-sm"
            onClick={uji}
            disabled={menguji || !data?.configured}
          >
            <Send size={13} />
            {menguji ? "Sending…" : "Send test"}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={reload}>
            Refresh
          </button>
        </div>

        {data?.bot && (
          <p className="text-[11.5px] muted mt-3 font-mono">Bot {data.bot}</p>
        )}
      </Card>

      <Card besar>
        <h2 className="text-[14.5px] font-semibold title mb-4">Setup</h2>
        <ol className="space-y-3 text-[13px] text-2">
          <Langkah n={1}>
            Create a bot with <Kode>@BotFather</Kode> and copy its token.
          </Langkah>
          <Langkah n={2}>
            Add the bot to your channel and make it an <b>admin</b>.
          </Langkah>
          <Langkah n={3}>
            Copy the channel chat ID (usually starts with <Kode>-100</Kode>).
          </Langkah>
          <Langkah n={4}>
            In Apps Script, open <b>Project Settings → Script properties</b> and
            add <Kode>TELEGRAM_BOT_TOKEN</Kode> and <Kode>TELEGRAM_CHAT_ID</Kode>.
          </Langkah>
        </ol>
      </Card>
    </div>
  );
}

function Tingkat({ level, isi }: { level: string; isi: string }) {
  const warna =
    level === "warning"
      ? "var(--warning)"
      : level === "kritis"
        ? "var(--kritis)"
        : "var(--danger)";
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: warna }} />
      <span className="text-[12.5px] font-medium capitalize w-[58px]">{level}</span>
      <span className="text-[12px] muted">{isi}</span>
    </div>
  );
}

function Langkah({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span
        className="grid place-items-center w-5 h-5 rounded-md text-[11px] font-semibold shrink-0"
        style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
      >
        {n}
      </span>
      <span className="leading-relaxed">{children}</span>
    </li>
  );
}

function Kode({ children }: { children: React.ReactNode }) {
  return (
    <code
      className="px-1 py-0.5 rounded-md text-[11px] font-mono"
      style={{ background: "var(--surface-3)" }}
    >
      {children}
    </code>
  );
}

/* =================================== DATA ================================= */

function BagianData() {
  const { user, bootstrap } = useAuth();

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Card besar>
        <h2 className="text-[14.5px] font-semibold title mb-4">Database</h2>
        <div className="space-y-1 text-[13px]">
          <Baris label="Users" nilai="Users" />
          <Baris label="Wallets" nilai="Dompet" />
          <Baris label="Categories" nilai="Kategori" />
          <Baris label="Transactions" nilai="Transaksi" />
          <Baris label="Budgets" nilai="Budget" />
          <Baris label="Alerts sent" nilai="Notifikasi" />
        </div>
        <p className="text-[11.5px] muted mt-4 leading-relaxed">
          Do not insert or delete rows by hand in the spreadsheet. It makes the
          app read the wrong rows.
        </p>
      </Card>

      <Card besar>
        <h2 className="text-[14.5px] font-semibold title mb-4">Backup</h2>
        <p className="text-[13px] text-2 mb-4">
          Download every transaction as CSV from Reports.
        </p>
        <a href="/laporan" className="btn btn-ghost btn-sm mb-5">
          <ExternalLink size={13} /> Open Reports
        </a>

        <div className="divider mb-4" />

        <div
          className="flex items-center gap-3 p-2.5 rounded-xl"
          style={{ background: "var(--surface-2)" }}
        >
          <Avatar nama={user?.nama || user?.email || "?"} size={34} />
          <div className="min-w-0">
            <p className="text-[13px] font-medium truncate">
              {user?.nama || "No name"}
            </p>
            <p className="text-[11px] muted truncate">{user?.email}</p>
          </div>
        </div>

        {bootstrap && (
          <p className="text-[11.5px] muted mt-4">
            Server date: {labelTanggal(bootstrap.today)}
          </p>
        )}
      </Card>
    </div>
  );
}

function Baris({ label, nilai }: { label: string; nilai: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="muted">{label}</span>
      <span className="font-mono text-[12px]">{nilai}</span>
    </div>
  );
}
