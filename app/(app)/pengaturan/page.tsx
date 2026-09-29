"use client";

import { useState } from "react";
import {
  Bell,
  CheckCircle2,
  Database,
  ExternalLink,
  Moon,
  Palette,
  Pencil,
  Plus,
  Send,
  ShieldCheck,
  Sun,
  Tags,
  Trash2,
  TriangleAlert,
  UserPlus,
  Users,
} from "lucide-react";
import { ApiError, ambilTema, api, idBaru, simpanTema } from "@/lib/api";
import { picuBootstrap, useApi } from "@/lib/hooks";
import { Avatar, useAuth } from "@/components/auth";
import { useToast } from "@/components/toast";
import {
  Card,
  Field,
  Galat,
  Kosong,
  Modal,
  PageHeader,
  Skeleton,
} from "@/components/ui";
import { labelTanggal } from "@/lib/format";
import type { Category, User } from "@/lib/types";

type Tab = "profil" | "pengguna" | "kategori" | "notifikasi" | "tampilan" | "data";

const TAB: { v: Tab; l: string; Ikon: React.ComponentType<{ size?: number }> }[] = [
  { v: "profil", l: "Profil", Ikon: ShieldCheck },
  { v: "pengguna", l: "Pengguna", Ikon: Users },
  { v: "kategori", l: "Kategori", Ikon: Tags },
  { v: "notifikasi", l: "Notifikasi", Ikon: Bell },
  { v: "tampilan", l: "Tampilan", Ikon: Palette },
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
      <PageHeader judul="Pengaturan" sub="Kelola akun, kategori, dan notifikasi" />

      <div className="flex gap-1.5 mb-5 overflow-x-auto hide-scroll pb-1">
        {TAB.map(({ v, l, Ikon }) => {
          const aktif = tab === v;
          return (
            <button
              key={v}
              onClick={() => setTab(v)}
              className="flex items-center gap-2 h-9 px-3.5 rounded-[10px] text-[13px] font-medium whitespace-nowrap transition shrink-0"
              style={{
                background: aktif ? "var(--accent-soft)" : "var(--surface)",
                color: aktif ? "var(--accent)" : "var(--text-2)",
                border: `1px solid ${aktif ? "transparent" : "var(--border)"}`,
              }}
            >
              <Ikon size={15} />
              {l}
            </button>
          );
        })}
      </div>

      {tab === "profil" && <BagianProfil />}
      {tab === "pengguna" && <BagianPengguna />}
      {tab === "kategori" && <BagianKategori />}
      {tab === "notifikasi" && <BagianNotifikasi />}
      {tab === "tampilan" && <BagianTampilan />}
      {tab === "data" && <BagianData />}
    </>
  );
}

/* ================================= PROFIL ================================= */

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
      toast.sukses("Profil diperbarui.");
      await muatUlang();
    } catch (e) {
      toast.gagal(e instanceof ApiError ? e.message : "Gagal menyimpan.");
    } finally {
      setSedang(false);
    }
  }

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Card besar>
        <div className="flex items-center gap-4 mb-5">
          <Avatar nama={user?.nama || user?.email || "?"} size={56} />
          <div className="min-w-0">
            <p className="font-semibold text-[16px] title truncate">
              {user?.nama || "Tanpa nama"}
            </p>
            <p className="text-[13px] muted truncate">{user?.email}</p>
          </div>
        </div>

        <Field label="Nama tampilan" hint="Dipakai di sapaan dan inisial avatar.">
          <input
            className="input"
            value={nama}
            placeholder="Nama kamu"
            onChange={(e) => setNama(e.target.value)}
          />
        </Field>

        <div className="flex justify-end mt-4">
          <button className="btn btn-primary btn-sm" onClick={simpan} disabled={sedang}>
            {sedang ? "Menyimpan…" : "Simpan"}
          </button>
        </div>
      </Card>

      <Card besar>
        <h2 className="text-[15px] font-semibold title mb-4">Keamanan akun</h2>
        <div className="space-y-3 text-[13.5px]">
          <BarisInfo
            ikon={<CheckCircle2 size={16} />}
            judul="Masuk dengan Google"
            isi="Tidak ada kata sandi yang disimpan di mana pun. Google yang memverifikasi identitasmu setiap kali masuk."
            warna="var(--success)"
          />
          <BarisInfo
            ikon={<ShieldCheck size={16} />}
            judul="Hanya email terdaftar"
            isi="Orang yang punya akun Google lain tetap tidak bisa masuk kalau emailnya belum kamu daftarkan di tab Pengguna."
            warna="var(--accent)"
          />
          <BarisInfo
            ikon={<Database size={16} />}
            judul="Data milikmu sendiri"
            isi="Semua catatan tersimpan di Google Sheets milikmu. Tidak ada pihak lain yang menyimpannya."
            warna="var(--info)"
          />
        </div>

        {user?.last_login && (
          <p className="text-[12px] muted mt-5">
            Terakhir masuk: {user.last_login.replace("T", " ")}
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
    <div className="flex items-start gap-3">
      <span className="shrink-0 mt-0.5" style={{ color: warna }}>
        {ikon}
      </span>
      <div>
        <p className="font-medium">{judul}</p>
        <p className="muted text-[12.5px] mt-0.5 leading-relaxed">{isi}</p>
      </div>
    </div>
  );
}

/* ================================ PENGGUNA ================================ */

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
      toast.sukses("Pengguna dihapus.");
      setHapus(null);
      reload();
    } catch (e) {
      toast.gagal(e instanceof ApiError ? e.message : "Gagal menghapus.");
    }
  }

  return (
    <>
      <Card besar pad={false}>
        <div className="flex items-center justify-between p-5 pb-3">
          <div>
            <h2 className="text-[15px] font-semibold title">Pengguna</h2>
            <p className="text-[12.5px] muted mt-0.5">
              Hanya email di daftar ini yang bisa membuka aplikasi
            </p>
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setForm({ buka: true, awal: null })}
          >
            <UserPlus size={15} /> Tambah
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
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : (
          <div className="px-5 pb-5 space-y-2">
            {users.map((u) => {
              const diri = u.email === saya?.email;
              return (
                <div
                  key={u.email}
                  className="flex items-center gap-3 p-3 rounded-xl"
                  style={{ background: "var(--surface-2)" }}
                >
                  <Avatar nama={u.nama || u.email} size={38} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-medium truncate flex items-center gap-2">
                      {u.nama || "Tanpa nama"}
                      {diri && <span className="badge badge-netral">Kamu</span>}
                      {String(u.status).toLowerCase() !== "aktif" && (
                        <span className="badge badge-over">Nonaktif</span>
                      )}
                    </p>
                    <p className="text-[11.5px] muted truncate">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      className="btn btn-ghost btn-icon btn-sm"
                      title="Ubah"
                      onClick={() => setForm({ buka: true, awal: u })}
                    >
                      <Pencil size={14} />
                    </button>
                    {!diri && (
                      <button
                        className="btn btn-ghost btn-icon btn-sm"
                        title="Hapus"
                        style={{ color: "var(--danger)" }}
                        onClick={() => setHapus(u)}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <div
        className="rounded-2xl p-4 mt-4 text-[13px] leading-relaxed"
        style={{
          background: "var(--accent-soft)",
          border: "1px solid color-mix(in srgb, var(--accent) 20%, transparent)",
        }}
      >
        <p className="font-semibold mb-1" style={{ color: "var(--accent)" }}>
          Cara menambah pasangan
        </p>
        <p className="text-2">
          Klik <b>Tambah</b>, masukkan <b>email Google</b> pasanganmu, lalu
          minta dia membuka aplikasi dan masuk dengan akun itu. Kalian berdua
          melihat pembukuan yang sama.
        </p>
      </div>

      <Modal
        buka={form.buka}
        onTutup={() => setForm({ buka: false, awal: null })}
        judul={form.awal ? "Ubah pengguna" : "Tambah pengguna"}
        lebar={480}
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
        judul="Hapus pengguna?"
        lebar={420}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setHapus(null)}>
              Batal
            </button>
            <button className="btn btn-danger" onClick={konfirmasiHapus}>
              Ya, hapus
            </button>
          </>
        }
      >
        {hapus && (
          <p className="text-[13.5px] text-2 leading-relaxed">
            <b>{hapus.email}</b> tidak akan bisa masuk lagi. Transaksi yang pernah
            dia catat tetap tersimpan.
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
  const [status, setStatus] = useState(
    String(awal?.status || "aktif").toLowerCase()
  );
  const [sedang, setSedang] = useState(false);

  async function simpan() {
    if (!email.includes("@")) {
      toast.gagal("Masukkan alamat email yang benar.");
      return;
    }
    setSedang(true);
    try {
      await api("users.save", {
        user: { email, nama, peran: "admin", status },
      });
      toast.sukses("Pengguna disimpan.");
      onSelesai();
    } catch (e) {
      toast.gagal(e instanceof ApiError ? e.message : "Gagal menyimpan.");
    } finally {
      setSedang(false);
    }
  }

  return (
    <div className="space-y-4">
      <Field
        label="Email Google"
        hint="Harus alamat Gmail atau Google Workspace yang benar-benar dipakai."
      >
        <input
          className="input"
          type="email"
          value={email}
          autoFocus={!awal}
          disabled={!!awal}
          placeholder="nama@gmail.com"
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>

      <Field label="Nama">
        <input
          className="input"
          value={nama}
          placeholder="Contoh: Istri"
          onChange={(e) => setNama(e.target.value)}
        />
      </Field>

      <Field label="Status">
        <select
          className="select"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="aktif">Aktif</option>
          <option value="nonaktif">Nonaktif</option>
        </select>
      </Field>

      <div className="flex items-center justify-end gap-2 pt-2">
        <button className="btn btn-ghost" onClick={onBatal} disabled={sedang}>
          Batal
        </button>
        <button className="btn btn-primary" onClick={simpan} disabled={sedang}>
          {sedang ? "Menyimpan…" : "Simpan"}
        </button>
      </div>
    </div>
  );
}

/* ================================ KATEGORI ================================ */

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
      toast.sukses("Kategori dihapus.");
      setHapus(null);
      picuBootstrap();
    } catch (e) {
      toast.gagal(e instanceof ApiError ? e.message : "Gagal menghapus.");
    }
  }

  return (
    <>
      <div className="grid lg:grid-cols-2 gap-4">
        <DaftarKategori
          judul="Pemasukan"
          keterangan="Sumber uang masuk"
          items={masuk.filter((c) => c.sistem !== 1)}
          onTambah={() => setForm({ buka: true, awal: null, tipe: "Pemasukan" })}
          onUbah={(c) => setForm({ buka: true, awal: c, tipe: c.tipe })}
          onHapus={(c) => setHapus(c)}
        />
        <DaftarKategori
          judul="Pengeluaran"
          keterangan="Pos tempat uang keluar"
          items={keluar}
          onTambah={() => setForm({ buka: true, awal: null, tipe: "Pengeluaran" })}
          onUbah={(c) => setForm({ buka: true, awal: c, tipe: c.tipe })}
          onHapus={(c) => setHapus(c)}
        />
      </div>

      <div
        className="rounded-2xl p-4 mt-4 text-[13px] leading-relaxed"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <p className="font-semibold mb-1">Saran soal jumlah kategori</p>
        <p className="text-2 muted">
          Jangan terlalu banyak. Kalau pilihannya menumpuk, kamu akan malas
          memilih dan semua transaksi berakhir di <b>Lainnya</b> — laporannya jadi
          tidak berguna. Sekitar 10 sampai 15 kategori pengeluaran sudah cukup
          untuk kebanyakan orang.
        </p>
      </div>

      <Modal
        buka={form.buka}
        onTutup={() => setForm({ buka: false, awal: null, tipe: "Pengeluaran" })}
        judul={form.awal ? "Ubah kategori" : "Tambah kategori"}
        lebar={480}
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
        judul="Hapus kategori?"
        lebar={430}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setHapus(null)}>
              Batal
            </button>
            <button className="btn btn-danger" onClick={konfirmasiHapus}>
              Ya, hapus
            </button>
          </>
        }
      >
        {hapus && (
          <p className="text-[13.5px] text-2 leading-relaxed">
            Kategori <b>{hapus.nama}</b> akan dihapus. Kalau sudah dipakai
            transaksi, kategorinya hanya disembunyikan supaya riwayat lama tidak
            rusak — transaksi lamamu tetap aman.
          </p>
        )}
      </Modal>
    </>
  );
}

function DaftarKategori({
  judul,
  keterangan,
  items,
  onTambah,
  onUbah,
  onHapus,
}: {
  judul: string;
  keterangan: string;
  items: Category[];
  onTambah: () => void;
  onUbah: (c: Category) => void;
  onHapus: (c: Category) => void;
}) {
  return (
    <Card besar pad={false}>
      <div className="flex items-center justify-between p-5 pb-3">
        <div>
          <h2 className="text-[15px] font-semibold title">{judul}</h2>
          <p className="text-[12.5px] muted mt-0.5">{keterangan}</p>
        </div>
        <button className="btn btn-ghost btn-icon btn-sm" onClick={onTambah} title="Tambah">
          <Plus size={16} />
        </button>
      </div>

      <div className="px-5 pb-5 space-y-2">
        {items.length === 0 ? (
          <Kosong ikon={<Tags size={22} />} judul="Belum ada kategori" />
        ) : (
          items.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-3 p-3 rounded-xl"
              style={{ background: "var(--surface-2)" }}
            >
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ background: c.warna }}
              />
              <span className="text-[13.5px] flex-1 truncate">{c.nama}</span>
              {c.sistem === 1 && <span className="badge badge-netral">Sistem</span>}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  className="btn btn-ghost btn-icon btn-sm"
                  onClick={() => onUbah(c)}
                  title="Ubah"
                >
                  <Pencil size={13} />
                </button>
                {c.sistem !== 1 && (
                  <button
                    className="btn btn-ghost btn-icon btn-sm"
                    style={{ color: "var(--danger)" }}
                    onClick={() => onHapus(c)}
                    title="Hapus"
                  >
                    <Trash2 size={13} />
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
  const [tipe, setTipe] = useState<"Pemasukan" | "Pengeluaran">(
    awal?.tipe || tipeAwal
  );
  const [warna, setWarna] = useState(awal?.warna || "#6366f1");
  const [sedang, setSedang] = useState(false);

  async function simpan() {
    if (!nama.trim()) {
      toast.gagal("Nama kategori wajib diisi.");
      return;
    }
    setSedang(true);
    try {
      await api("category.save", {
        category: { id: awal?.id || idBaru(), nama, tipe, warna },
      });
      toast.sukses("Kategori disimpan.");
      onSelesai();
    } catch (e) {
      toast.gagal(e instanceof ApiError ? e.message : "Gagal menyimpan.");
    } finally {
      setSedang(false);
    }
  }

  return (
    <div className="space-y-4">
      <Field label="Nama kategori">
        <input
          className="input"
          value={nama}
          autoFocus
          placeholder="Contoh: Cicilan"
          onChange={(e) => setNama(e.target.value)}
        />
      </Field>

      {!awal && (
        <Field label="Jenis">
          <select
            className="select"
            value={tipe}
            onChange={(e) => setTipe(e.target.value as "Pemasukan" | "Pengeluaran")}
          >
            <option value="Pengeluaran">Pengeluaran</option>
            <option value="Pemasukan">Pemasukan</option>
          </select>
        </Field>
      )}

      <Field label="Warna">
        <div className="flex flex-wrap gap-2">
          {WARNA_PILIHAN.map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setWarna(w)}
              className="w-8 h-8 rounded-[10px] transition"
              style={{
                background: w,
                outline: warna === w ? `2px solid ${w}` : "none",
                outlineOffset: 2,
                transform: warna === w ? "scale(1.08)" : "none",
              }}
              aria-label={`Warna ${w}`}
            />
          ))}
        </div>
      </Field>

      <div className="flex items-center justify-end gap-2 pt-2">
        <button className="btn btn-ghost" onClick={onBatal} disabled={sedang}>
          Batal
        </button>
        <button className="btn btn-primary" onClick={simpan} disabled={sedang}>
          {sedang ? "Menyimpan…" : "Simpan"}
        </button>
      </div>
    </div>
  );
}

/* =============================== NOTIFIKASI =============================== */

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
      if (hasil.sent) toast.sukses("Pesan uji terkirim. Cek Telegram-mu.");
      else toast.gagal("Gagal mengirim. Periksa token dan chat ID.");
    } catch (e) {
      toast.gagal(e instanceof ApiError ? e.message : "Gagal mengirim pesan uji.");
    } finally {
      setMenguji(false);
    }
  }

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Card besar>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[15px] font-semibold title">Notifikasi Telegram</h2>
          {loading ? (
            <Skeleton className="h-6 w-20" />
          ) : data?.configured ? (
            <span className="badge badge-aman">
              <CheckCircle2 size={12} /> Tersambung
            </span>
          ) : (
            <span className="badge badge-warning">
              <TriangleAlert size={12} /> Belum diatur
            </span>
          )}
        </div>

        <p className="text-[13.5px] text-2 leading-relaxed mb-4">
          Aplikasi akan mengirim pesan otomatis ke Telegram setiap kali sebuah
          pos budget naik tingkat peringatan. Tidak ada jadwal jam kirim — pesan
          hanya muncul saat memang ada yang perlu kamu tahu.
        </p>

        <div className="space-y-2 mb-4">
          <Tingkat level="warning" isi="Mulai 70% dari batas" />
          <Tingkat level="kritis" isi="Mulai 90% dari batas" />
          <Tingkat level="over" isi="Melewati 100% dari batas" />
        </div>

        <div className="flex items-center gap-2">
          <button
            className="btn btn-primary btn-sm"
            onClick={uji}
            disabled={menguji || !data?.configured}
          >
            <Send size={14} />
            {menguji ? "Mengirim…" : "Kirim pesan uji"}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={reload}>
            Periksa ulang
          </button>
        </div>

        {data && !data.configured && (
          <p className="text-[12.5px] muted mt-3 leading-relaxed">
            Isi token bot dan chat ID lewat <b>Script Properties</b> di editor Apps
            Script, lalu jalankan fungsi <b>setTelegram</b>. Langkah lengkapnya ada
            di README.
          </p>
        )}
      </Card>

      <Card besar>
        <h2 className="text-[15px] font-semibold title mb-4">Cara memasang</h2>
        <ol className="space-y-3.5 text-[13.5px] text-2">
          <Langkah n={1}>
            Buka Telegram, cari <b>@BotFather</b>, kirim <Kode>/newbot</Kode>, ikuti
            perintahnya. Kamu akan mendapat <b>token bot</b>.
          </Langkah>
          <Langkah n={2}>
            Buat channel atau grup, lalu <b>tambahkan bot</b> sebagai anggota dan
            jadikan <b>admin</b>. Tanpa ini, bot tidak bisa mengirim pesan.
          </Langkah>
          <Langkah n={3}>
            Salin <b>chat ID</b> channel (biasanya diawali <Kode>-100</Kode>).
            Bisa dilihat lewat <Kode>getUpdates</Kode> pada bot.
          </Langkah>
          <Langkah n={4}>
            Di editor Apps Script, buka <b>Project Settings → Script properties</b>,
            tambahkan <Kode>TELEGRAM_BOT_TOKEN</Kode> dan{" "}
            <Kode>TELEGRAM_CHAT_ID</Kode>. Jangan ditulis di dalam kode.
          </Langkah>
          <Langkah n={5}>
            Kembali ke halaman ini, klik <b>Kirim pesan uji</b>.
          </Langkah>
        </ol>

        {data?.bot && (
          <div
            className="rounded-xl p-3 mt-4 text-[12.5px]"
            style={{ background: "var(--surface-2)" }}
          >
            <p className="muted">Bot terdeteksi</p>
            <p className="font-mono">{data.bot}</p>
            {data.chatId && (
              <>
                <p className="muted mt-2">Chat ID</p>
                <p className="font-mono">{data.chatId}</p>
              </>
            )}
          </div>
        )}
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
    <div className="flex items-center gap-3">
      <span
        className="w-2.5 h-2.5 rounded-full shrink-0"
        style={{ background: warna }}
      />
      <span className="text-[13px] font-medium capitalize w-[64px]">{level}</span>
      <span className="text-[12.5px] muted">{isi}</span>
    </div>
  );
}

function Langkah({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        className="grid place-items-center w-6 h-6 rounded-lg text-[12px] font-semibold shrink-0"
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
      className="px-1.5 py-0.5 rounded-md text-[11.5px] font-mono"
      style={{ background: "var(--surface-3)" }}
    >
      {children}
    </code>
  );
}

/* ================================ TAMPILAN ================================ */

function BagianTampilan() {
  const [tema, setTema] = useState<"light" | "dark">(() =>
    typeof window === "undefined" ? "light" : ambilTema()
  );

  function pilih(t: "light" | "dark") {
    setTema(t);
    simpanTema(t);
  }

  return (
    <Card besar>
      <h2 className="text-[15px] font-semibold title mb-1">Tema</h2>
      <p className="text-[12.5px] muted mb-5">
        Pilihanmu disimpan di perangkat ini.
      </p>

      <div className="grid sm:grid-cols-2 gap-4 max-w-[560px]">
        <PilihanTema
          aktif={tema === "light"}
          onClick={() => pilih("light")}
          judul="Terang"
          Ikon={Sun}
          latar="#f4f5f7"
          kartu="#ffffff"
        />
        <PilihanTema
          aktif={tema === "dark"}
          onClick={() => pilih("dark")}
          judul="Gelap"
          Ikon={Moon}
          latar="#080b13"
          kartu="#111624"
        />
      </div>
    </Card>
  );
}

function PilihanTema({
  aktif,
  onClick,
  judul,
  Ikon,
  latar,
  kartu,
}: {
  aktif: boolean;
  onClick: () => void;
  judul: string;
  Ikon: React.ComponentType<{ size?: number }>;
  latar: string;
  kartu: string;
}) {
  return (
    <button
      onClick={onClick}
      className="text-left rounded-2xl p-3 transition"
      style={{
        border: `2px solid ${aktif ? "var(--accent)" : "var(--border)"}`,
        background: "var(--surface-2)",
      }}
    >
      <div
        className="rounded-xl p-3 h-[104px] mb-3 relative overflow-hidden"
        style={{ background: latar }}
      >
        <div className="rounded-lg p-2.5" style={{ background: kartu }}>
          <div
            className="h-2 rounded-full mb-2 w-[60%]"
            style={{ background: "var(--accent)", opacity: 0.8 }}
          />
          <div
            className="h-1.5 rounded-full mb-1.5 w-full"
            style={{ background: "var(--border)" }}
          />
          <div
            className="h-1.5 rounded-full w-[75%]"
            style={{ background: "var(--border)" }}
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Ikon size={15} />
        <span className="text-[13.5px] font-medium">{judul}</span>
        {aktif && (
          <CheckCircle2
            size={15}
            className="ml-auto"
            style={{ color: "var(--accent)" }}
          />
        )}
      </div>
    </button>
  );
}

/* ================================== DATA ================================== */

function BagianData() {
  const { user, bootstrap } = useAuth();

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Card besar>
        <h2 className="text-[15px] font-semibold title mb-4">Database</h2>
        <p className="text-[13.5px] text-2 leading-relaxed mb-4">
          Semua catatanmu disimpan di Google Sheets milikmu sendiri. Tidak ada
          data yang dikirim ke tempat lain selain Google dan server aplikasi ini.
        </p>

        <div className="space-y-2 text-[13px]">
          <Baris label="Sheet pengguna" nilai="Users" />
          <Baris label="Sheet dompet" nilai="Dompet" />
          <Baris label="Sheet kategori" nilai="Kategori" />
          <Baris label="Sheet transaksi" nilai="Transaksi" />
          <Baris label="Sheet budget" nilai="Budget" />
          <Baris label="Sheet notifikasi" nilai="Notifikasi" />
        </div>

        <div
          className="rounded-xl p-3.5 mt-4 text-[12.5px] text-2 leading-relaxed"
          style={{ background: "var(--surface-2)" }}
        >
          <p className="font-semibold mb-1">Jangan mengubah isi sheet manual</p>
          <p className="muted">
            Menyisipkan atau menghapus baris langsung di spreadsheet bisa membuat
            aplikasi salah membaca data. Kalau perlu memperbaiki catatan, gunakan
            tombol Ubah di halaman Transaksi.
          </p>
        </div>
      </Card>

      <Card besar>
        <h2 className="text-[15px] font-semibold title mb-4">Cadangan & ekspor</h2>

        <p className="text-[13.5px] text-2 leading-relaxed mb-4">
          Kamu bisa mengunduh seluruh transaksi ke Excel kapan saja lewat halaman
          Laporan. Datamu tidak terkunci di aplikasi ini.
        </p>

        <a href="/laporan" className="btn btn-ghost btn-sm mb-5">
          <ExternalLink size={14} /> Buka halaman Laporan
        </a>

        <div className="divider mb-5" />

        <h3 className="text-[13.5px] font-semibold mb-3">Akun yang terhubung</h3>
        <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "var(--surface-2)" }}>
          <Avatar nama={user?.nama || user?.email || "?"} size={38} />
          <div className="min-w-0">
            <p className="text-[13.5px] font-medium truncate">
              {user?.nama || "Tanpa nama"}
            </p>
            <p className="text-[11.5px] muted truncate">{user?.email}</p>
          </div>
        </div>

        {bootstrap && (
          <p className="text-[12px] muted mt-4">
            Bulan berjalan menurut server: {labelTanggal(bootstrap.today)}
          </p>
        )}
      </Card>
    </div>
  );
}

function Baris({ label, nilai }: { label: string; nilai: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="muted">{label}</span>
      <span className="font-mono text-[12.5px]">{nilai}</span>
    </div>
  );
}
