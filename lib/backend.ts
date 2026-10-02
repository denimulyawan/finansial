import {
  bacaBanyak,
  bacaRange,
  buatSheet,
  hapusBaris,
  idSheet,
  tambahBanyak,
  tambahBaris,
  tulisBaris,
  tulisRange,
} from "./sheets";

/**
 * Logika backend, dipindahkan dari gas/Code.gs.
 *
 * Bentuk permintaan dan balasannya sengaja dibuat sama persis dengan versi
 * Apps Script, jadi halaman-halaman di frontend tidak perlu diubah.
 */

/* ================================ KONSTANTA =============================== */

export const HEADERS: Record<string, string[]> = {
  Users: ["email", "nama", "peran", "status", "created_at", "last_login"],
  Dompet: ["id", "nama", "jenis", "saldo_awal", "urutan", "aktif", "catatan", "created_at"],
  Kategori: ["id", "nama", "tipe", "warna", "ikon", "sistem", "urutan", "aktif", "sembunyi_budget"],
  Transaksi: [
    "id", "tanggal", "tipe", "wallet_id", "wallet_tujuan_id", "category_id",
    "jumlah", "biaya_admin", "catatan", "created_by", "created_at", "updated_at",
  ],
  Budget: ["id", "bulan", "category_id", "jumlah", "updated_at"],
  Notifikasi: ["bulan", "category_id", "level", "sent_at"],
};

const SH = {
  USERS: "Users",
  WALLETS: "Dompet",
  CATS: "Kategori",
  TX: "Transaksi",
  BUDGET: "Budget",
  NOTIF: "Notifikasi",
} as const;

const KAT_BIAYA_ADMIN = "biaya_admin";
const KAT_TOTAL = "TOTAL";

const BATAS_WARNING = 70;
const BATAS_KRITIS = 90;
const BATAS_OVER = 100;

const RANK_LEVEL: Record<string, number> = { aman: 0, warning: 1, kritis: 2, over: 3 };
const IKON_LEVEL: Record<string, string> = { warning: "⚠️", kritis: "🟠", over: "🔴" };
const LABEL_LEVEL: Record<string, string> = {
  aman: "Safe", warning: "Warning", kritis: "Critical", over: "Over",
};

const KATEGORI_AWAL = [
  { id: "gaji", nama: "Gaji", tipe: "Pemasukan", warna: "#10b981", ikon: "Wallet" },
  { id: "thr", nama: "THR", tipe: "Pemasukan", warna: "#22c55e", ikon: "Gift" },
  { id: "bonus", nama: "Bonus", tipe: "Pemasukan", warna: "#34d399", ikon: "TrendingUp" },
  { id: "lain_masuk", nama: "Lainnya", tipe: "Pemasukan", warna: "#6ee7b7", ikon: "Plus" },
  { id: "makan", nama: "Makan", tipe: "Pengeluaran", warna: "#f97316", ikon: "UtensilsCrossed" },
  { id: "transportasi", nama: "Transportasi", tipe: "Pengeluaran", warna: "#3b82f6", ikon: "Car" },
  { id: "tagihan", nama: "Tagihan", tipe: "Pengeluaran", warna: "#8b5cf6", ikon: "Receipt" },
  { id: "hiburan", nama: "Hiburan", tipe: "Pengeluaran", warna: "#ec4899", ikon: "Gamepad2" },
  { id: "pendidikan", nama: "Pendidikan", tipe: "Pengeluaran", warna: "#06b6d4", ikon: "GraduationCap" },
  { id: "orang_tua", nama: "Orang Tua", tipe: "Pengeluaran", warna: "#a855f7", ikon: "Heart" },
  { id: "belanja", nama: "Belanja", tipe: "Pengeluaran", warna: "#eab308", ikon: "ShoppingCart" },
  { id: "kesehatan", nama: "Kesehatan", tipe: "Pengeluaran", warna: "#ef4444", ikon: "Stethoscope" },
  { id: "lainnya", nama: "Lainnya", tipe: "Pengeluaran", warna: "#64748b", ikon: "MoreHorizontal" },
  { id: KAT_BIAYA_ADMIN, nama: "Biaya Admin", tipe: "Pengeluaran", warna: "#94a3b8", ikon: "Landmark", sistem: 1 },
];

const DOMPET_AWAL = [{ id: "tunai", nama: "Cash", jenis: "tunai" }];

type Baris = Record<string, unknown>;
export interface Sesi {
  baca: Map<string, Baris[]>;
  /* panjang baris judul tiap sheet, untuk mendeteksi kolom yang belum ada */
  kolom: Map<string, number>;
  email: string;
}

export function sesiBaru(email: string): Sesi {
  return { baca: new Map(), kolom: new Map(), email };
}

export async function penggunaTerdaftar(
  sesi: Sesi,
  email: string
): Promise<{ ok: boolean; pesan?: string }> {
  /* dibaca dari sesi yang sudah dimuat, jadi tidak menambah permintaan */
  const daftar = await bacaSemua(sesi, SH.USERS);
  const target = email.toLowerCase();
  const u = daftar.find(
    (x) => String(x.email).toLowerCase() === target
  );

  if (!u) {
    return {
      ok: false,
      pesan: `Email ${email} is not registered. Ask the admin to add this email in Settings.`,
    };
  }
  if (String(u.status).toLowerCase() !== "aktif") {
    return { ok: false, pesan: "This account is inactive." };
  }
  return { ok: true };
}

/* ================================= UTILITAS =============================== */

function uid(): string {
  const acak = () => Math.random().toString(36).slice(2, 10);
  return (Date.now().toString(36) + acak() + acak()).slice(0, 16);
}

function num(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return isFinite(v) ? v : 0;
  const s = String(v).replace(/[^0-9,.\-]/g, "");
  const bersih =
    s.includes(",") && s.includes(".")
      ? s.replace(/\./g, "").replace(",", ".")
      : s.includes(",")
        ? s.replace(",", ".")
        : s;
  const n = parseFloat(bersih);
  return isFinite(n) ? n : 0;
}

const TZ = "Asia/Jakarta";

function hariIni(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

function sekarang(): string {
  const d = new Date();
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)?.value || "00";
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}:${g("second")}`;
}

/** Apa pun bentuknya, jadikan teks 'YYYY-MM-DD'. */
export function tanggalStr(v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
  if (v instanceof Date) {
    return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(v);
  }
  const s = String(v).trim();
  const cocok = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (cocok) return `${cocok[1]}-${cocok[2]}-${cocok[3]}`;
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
  }
  return s;
}

function bulanOf(tanggal: unknown): string {
  const s = tanggalStr(tanggal);
  return s.length >= 7 && s[4] === "-" ? s.slice(0, 7) : hariIni().slice(0, 7);
}

function geserBulan(bulan: string, delta: number): string {
  const y = parseInt(bulan.slice(0, 4), 10);
  const m = parseInt(bulan.slice(5, 7), 10);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function akhirBulan(bulan: string): string {
  const y = parseInt(bulan.slice(0, 4), 10);
  const m = parseInt(bulan.slice(5, 7), 10);
  const d = new Date(Date.UTC(y, m, 0));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

const BULAN_PENDEK = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function labelBulan(bulan: string): string {
  const y = bulan.slice(0, 4);
  const m = parseInt(bulan.slice(5, 7), 10);
  return `${BULAN_PENDEK[m - 1] || bulan} ${y}`;
}

function formatRp(n: unknown): string {
  const angka = Math.round(num(n));
  const negatif = angka < 0;
  const s = String(Math.abs(angka));
  let out = "";
  for (let i = s.length; i > 3; i -= 3) out = "." + s.slice(i - 3, i) + out;
  out = s.slice(0, ((s.length - 1) % 3) + 1) + out;
  return (negatif ? "-" : "") + "Rp " + out;
}

function levelOf(persen: number): string {
  if (persen >= BATAS_OVER) return "over";
  if (persen >= BATAS_KRITIS) return "kritis";
  if (persen >= BATAS_WARNING) return "warning";
  return "aman";
}

/* =============================== AKSES SHEET ============================== */

function barisKeObjek(values: unknown[][]): Baris[] {
  if (!values.length) return [];
  const head = values[0].map((h) => String(h));
  const out: Baris[] = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (String(row.join("")) === "") continue;
    const o: Baris = { _row: i + 1 };
    for (let j = 0; j < head.length; j++) o[head[j]] = row[j];
    out.push(o);
  }
  return out;
}

/**
 * Ambil seluruh isi sheet dalam SATU permintaan, lalu simpan di sesi.
 * Sesudah ini semua pembacaan lain gratis.
 */
export async function muatSemua(sesi: Sesi): Promise<void> {
  const nama = Object.keys(HEADERS);
  const hasil = await bacaBanyak(nama.map((n) => `${n}!A1:ZZ`));
  nama.forEach((n, i) => {
    const values = hasil[i] || [];
    sesi.kolom.set(n, (values[0] || []).length);
    sesi.baca.set(n, barisKeObjek(values));
  });
}

export async function siapkanJikaPerlu(sesi: Sesi): Promise<void> {
  let adaYangBaru = false;
  for (const nama of Object.keys(HEADERS)) {
    if (await buatSheet(nama, HEADERS[nama])) adaYangBaru = true;
  }

  /*
   * Data awal HANYA diisi kalau sheet-nya baru dibuat. Kalau tidak, dompet
   * atau kategori yang sengaja dihapus akan muncul lagi dengan sendirinya.
   *
   * Ini juga menutup balapan: dulu dua permintaan yang datang hampir
   * bersamaan sama-sama melihat sheet kosong lalu sama-sama mengisinya,
   * sehingga muncul dua baris dompet dengan id sama.
   */
  if (!adaYangBaru) return;

  await seedKategori(sesi);
  await seedPemilik(sesi);
}

/** Huruf kolom ke-n: 1 -> A, 27 -> AA. */
function kolomKe(n: number): string {
  let s = "";
  let x = n;
  while (x > 0) {
    const sisa = (x - 1) % 26;
    s = String.fromCharCode(65 + sisa) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s || "A";
}

/**
 * Tambahkan nama kolom yang belum ada di baris judul.
 *
 * Diperlukan saat fitur baru menambah kolom, misalnya sembunyi_budget.
 * Baris lama dibiarkan kosong, dan kolom kosong diperlakukan sebagai
 * nilai bawaan sehingga data lama tidak berubah artinya.
 */
export async function pastikanKolom(sesi: Sesi): Promise<void> {
  for (const nama of Object.keys(HEADERS)) {
    const head = HEADERS[nama];
    const ada = sesi.kolom.get(nama) || 0;
    if (ada >= head.length) continue;
    await tulisRange(`${nama}!${kolomKe(ada + 1)}1`, [head.slice(ada)]);
    sesi.kolom.set(nama, head.length);
  }
}

/** Baca seluruh isi sheet, disimpan selama satu permintaan saja. */
async function bacaSemua(sesi: Sesi, nama: string): Promise<Baris[]> {
  const ada = sesi.baca.get(nama);
  if (ada) return ada;

  const values = await bacaRange(`${nama}!A1:ZZ`);
  if (!values.length) {
    sesi.baca.set(nama, []);
    return [];
  }

  const head = values[0].map((h) => String(h));
  const out: Baris[] = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (String(row.join("")) === "") continue;
    const o: Baris = { _row: i + 1 };
    for (let j = 0; j < head.length; j++) o[head[j]] = row[j];
    out.push(o);
  }

  sesi.baca.set(nama, out);
  return out;
}

function lupakan(sesi: Sesi, nama: string) {
  sesi.baca.delete(nama);
}

function barisDari(head: string[], obj: Baris): unknown[] {
  return head.map((h) => (obj[h] === undefined || obj[h] === null ? "" : obj[h]));
}

async function tambah(sesi: Sesi, nama: string, obj: Baris): Promise<void> {
  await tambahBaris(nama, barisDari(HEADERS[nama], obj));
  lupakan(sesi, nama);
}

/** Tambah banyak baris sekaligus - satu permintaan tulis, bukan satu per baris. */
async function tambahSemua(
  sesi: Sesi,
  nama: string,
  objs: Baris[]
): Promise<void> {
  if (!objs.length) return;
  const head = HEADERS[nama];
  await tambahBanyak(nama, objs.map((o) => barisDari(head, o)));
  lupakan(sesi, nama);
}

/** Hapus banyak baris berdasarkan kuncinya - satu permintaan, bukan satu per baris. */
async function hapusBanyak(
  sesi: Sesi,
  nama: string,
  key: string,
  values: unknown[]
): Promise<number> {
  if (!values.length) return 0;
  const set = new Set(values.map(String));
  const list = await bacaSemua(sesi, nama);
  const baris = list
    .filter((b) => set.has(String(b[key])))
    .map((b) => Number(b._row));
  if (!baris.length) return 0;
  await hapusBaris(nama, baris);
  lupakan(sesi, nama);
  return baris.length;
}

async function ubah(
  sesi: Sesi,
  nama: string,
  key: string,
  value: unknown,
  patch: Baris,
  extra?: { kolom: string; nilai: unknown }
): Promise<boolean> {
  const list = await bacaSemua(sesi, nama);
  const head = HEADERS[nama];

  for (const baris of list) {
    let cocok = String(baris[key]) === String(value);
    if (cocok && extra) cocok = String(baris[extra.kolom]) === String(extra.nilai);
    if (!cocok) continue;

    const baru = head.map((h) =>
      patch[h] !== undefined ? patch[h] : (baris[h] ?? "")
    );
    await tulisBaris(nama, Number(baris._row), baru);
    lupakan(sesi, nama);
    return true;
  }
  return false;
}

/**
 * Hapus berdasarkan kunci. Membuang SEMUA baris yang cocok, bukan hanya
 * yang pertama - kalau tidak, baris kembar akan tertinggal dan datanya
 * seolah tidak bisa dihapus.
 */
async function hapus(
  sesi: Sesi,
  nama: string,
  key: string,
  value: unknown
): Promise<boolean> {
  const jumlah = await hapusBanyak(sesi, nama, key, [value]);
  return jumlah > 0;
}

function cari(sesi: Sesi, nama: string, pred: (b: Baris) => boolean) {
  return bacaSemua(sesi, nama).then((l) => l.find(pred) || null);
}

/* ================================== SEED ================================== */

async function seedKategori(sesi: Sesi) {
  const ada = await bacaSemua(sesi, SH.CATS);
  const dikenal = new Set(ada.map((c) => String(c.id)));
  const baru: Baris[] = [];
  for (let i = 0; i < KATEGORI_AWAL.length; i++) {
    const c = KATEGORI_AWAL[i];
    if (dikenal.has(c.id)) continue;
    baru.push({
      id: c.id, nama: c.nama, tipe: c.tipe, warna: c.warna, ikon: c.ikon,
      sistem: c.sistem || 0, urutan: i + 1, aktif: 1,
    });
  }
  await tambahSemua(sesi, SH.CATS, baru);
}

async function seedDompet(sesi: Sesi) {
  if ((await bacaSemua(sesi, SH.WALLETS)).length) return;
  await tambahSemua(
    sesi,
    SH.WALLETS,
    DOMPET_AWAL.map((w, i) => ({
      id: w.id, nama: w.nama, jenis: w.jenis, saldo_awal: 0,
      urutan: i + 1, aktif: 1, catatan: "", created_at: sekarang(),
    }))
  );
}

/** Kalau daftar pengguna kosong, daftarkan OWNER_EMAIL supaya bisa masuk. */
async function seedPemilik(sesi: Sesi) {
  const owner = (process.env.OWNER_EMAIL || "").trim().toLowerCase();
  if (!owner) return;

  const users = await bacaSemua(sesi, SH.USERS);
  if (users.length) return;

  await tambah(sesi, SH.USERS, {
    email: owner, nama: "", peran: "admin", status: "aktif",
    created_at: sekarang(), last_login: "",
  });
}

/* ============================== NORMALISASI =============================== */

function normalWallet(w: Baris) {
  return {
    id: String(w.id), nama: String(w.nama), jenis: String(w.jenis || "lainnya"),
    saldo_awal: num(w.saldo_awal), urutan: num(w.urutan),
    aktif: num(w.aktif) === 0 ? 0 : 1, catatan: String(w.catatan || ""),
  };
}

function normalCategory(c: Baris) {
  return {
    id: String(c.id), nama: String(c.nama), tipe: String(c.tipe),
    warna: String(c.warna || "#64748b"), ikon: String(c.ikon || "Tag"),
    sistem: num(c.sistem) === 1 ? 1 : 0, urutan: num(c.urutan),
    aktif: num(c.aktif) === 0 ? 0 : 1,
    /* kosong berarti tampil; hanya angka 1 yang menyembunyikan */
    tanpaBudget: num(c.sembunyi_budget) === 1 ? 1 : 0,
  };
}

async function walletAktif(sesi: Sesi) {
  return (await bacaSemua(sesi, SH.WALLETS))
    .map(normalWallet)
    .filter((w) => w.aktif === 1)
    .sort((a, b) => a.urutan - b.urutan);
}

async function kategoriAktif(sesi: Sesi) {
  return (await bacaSemua(sesi, SH.CATS))
    .map(normalCategory)
    .filter((c) => c.aktif === 1)
    .sort((a, b) => a.urutan - b.urutan);
}

async function semuaTx(sesi: Sesi): Promise<Baris[]> {
  const daftar = await bacaSemua(sesi, SH.TX);
  return daftar.map((t) => ({ ...t, tanggal: tanggalStr(t.tanggal) }));
}

function publicUser(u: Baris) {
  return {
    email: String(u.email || ""), nama: String(u.nama || ""),
    peran: String(u.peran || "admin"), status: String(u.status || "aktif"),
    last_login: String(u.last_login || ""), created_at: String(u.created_at || ""),
  };
}

/* ================================ PERHITUNGAN ============================= */

function hitungSaldo(
  wallets: { id: string; saldo_awal: number }[],
  txs: Baris[]
): Record<string, number> {
  const bal: Record<string, number> = {};
  wallets.forEach((w) => { bal[w.id] = w.saldo_awal; });
  txs.forEach((t) => {
    const j = num(t.jumlah);
    const fee = num(t.biaya_admin);
    const a = String(t.wallet_id || "");
    const b = String(t.wallet_tujuan_id || "");
    if (bal[a] === undefined) bal[a] = 0;
    if (t.tipe === "Pemasukan") bal[a] += j;
    else if (t.tipe === "Pengeluaran") bal[a] -= j;
    else if (t.tipe === "Transfer") {
      bal[a] -= j + fee;
      if (b) {
        if (bal[b] === undefined) bal[b] = 0;
        bal[b] += j;
      }
    }
  });
  return bal;
}

function pemakaianKategori(txs: Baris[], bulan: string): Record<string, number> {
  const map: Record<string, number> = {};
  txs.forEach((t) => {
    if (bulanOf(t.tanggal) !== bulan) return;
    const j = num(t.jumlah);
    const fee = num(t.biaya_admin);
    if (t.tipe === "Pengeluaran") {
      const k = String(t.category_id);
      map[k] = (map[k] || 0) + j;
    } else if (t.tipe === "Transfer" && fee) {
      map[KAT_BIAYA_ADMIN] = (map[KAT_BIAYA_ADMIN] || 0) + fee;
    }
  });
  return map;
}

async function statusBudget(sesi: Sesi, bulan: string) {
  const budgets = (await bacaSemua(sesi, SH.BUDGET)).filter(
    (b) => String(b.bulan) === bulan
  );
  if (!budgets.length) return { bulan, items: [], total: null, jumlahPerhatian: 0 };

  const cMap: Record<string, ReturnType<typeof normalCategory>> = {};
  (await kategoriAktif(sesi)).forEach((c) => { cMap[c.id] = c; });

  const pakai = pemakaianKategori(await semuaTx(sesi), bulan);

  const items: {
    categoryId: string; nama: string; warna: string; batas: number;
    terpakai: number; sisa: number; persen: number; level: string;
  }[] = [];
  let totalBatas = 0;

  budgets.forEach((b) => {
    const batas = num(b.jumlah);
    if (!(batas > 0)) return;

    /*
     * Batas total TIDAK diisi manual lagi - dihitung dari jumlah semua
     * batas kategori di bawah ini. Baris lama bertanda KAT_TOTAL
     * diabaikan, dan akan terhapus sendiri pada penyimpanan berikutnya.
     */
    if (String(b.category_id) === KAT_TOTAL) return;

    const c = cMap[String(b.category_id)];
    /* kategori sistem dan yang disembunyikan tidak tampil sebagai pos tersendiri */
    if (c && (c.sistem === 1 || c.tanpaBudget === 1)) return;

    const terpakai = pakai[String(b.category_id)] || 0;
    const persen = batas > 0 ? (terpakai / batas) * 100 : 0;
    totalBatas += batas;
    items.push({
      categoryId: String(b.category_id),
      nama: c ? c.nama : String(b.category_id),
      warna: c ? c.warna : "#64748b",
      batas, terpakai, sisa: batas - terpakai,
      persen: Math.round(persen * 10) / 10,
      level: levelOf(persen),
    });
  });

  const totalPakai = Object.values(pakai).reduce((a, b) => a + b, 0);
  items.sort((a, b) => b.persen - a.persen);

  let total = null;
  if (totalBatas > 0) {
    const p = (totalPakai / totalBatas) * 100;
    total = {
      batas: totalBatas, terpakai: totalPakai, sisa: totalBatas - totalPakai,
      persen: Math.round(p * 10) / 10, level: levelOf(p),
    };
  }

  let perhatian = items.filter((i) => i.level !== "aman").length;
  if (total && total.level !== "aman") perhatian++;

  return { bulan, items, total, jumlahPerhatian: perhatian };
}

function trendData(txs: Baris[], n: number, sampai: string) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const b = geserBulan(sampai, -i);
    let masuk = 0, keluar = 0;
    txs.forEach((t) => {
      if (bulanOf(t.tanggal) !== b) return;
      const j = num(t.jumlah);
      const fee = num(t.biaya_admin);
      if (t.tipe === "Pemasukan") masuk += j;
      else if (t.tipe === "Pengeluaran") keluar += j;
      else if (t.tipe === "Transfer") keluar += fee;
    });
    out.push({ bulan: b, label: labelBulan(b), masuk, keluar, selisih: masuk - keluar });
  }
  return out;
}

function rincianKategori(txs: Baris[], bulan: string, cMap: Record<string, ReturnType<typeof normalCategory>>) {
  const pakai = pemakaianKategori(txs, bulan);
  return Object.keys(pakai)
    .map((id) => {
      const c = cMap[id];
      return {
        id, nama: c ? c.nama : id, warna: c ? c.warna : "#64748b",
        tipe: c ? c.tipe : "Pengeluaran", jumlah: pakai[id],
      };
    })
    .filter((x) => x.jumlah > 0)
    .sort((a, b) => b.jumlah - a.jumlah);
}

function urutTx(a: Baris, b: Baris) {
  const ta = String(a.tanggal || ""), tb = String(b.tanggal || "");
  if (ta !== tb) return ta < tb ? 1 : -1;
  const ca = String(a.created_at || ""), cb = String(b.created_at || "");
  if (ca !== cb) return ca < cb ? 1 : -1;
  return 0;
}

function rapikanTx(t: Baris) {
  return {
    id: String(t.id), tanggal: tanggalStr(t.tanggal), tipe: String(t.tipe),
    wallet_id: String(t.wallet_id || ""), wallet_tujuan_id: String(t.wallet_tujuan_id || ""),
    category_id: String(t.category_id || ""), jumlah: num(t.jumlah),
    biaya_admin: num(t.biaya_admin), catatan: String(t.catatan || ""),
    created_by: String(t.created_by || ""),
  };
}

/* =============================== NOTIFIKASI =============================== */

async function telegram(teks: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return false;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId, text: teks, parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function statusTelegram() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  return {
    configured: !!(token && chat),
    bot: token ? token.split(":")[0] + ":***" : null,
    chatId: chat || null,
  };
}

function susunPesan(it: { nama: string; persen: number; terpakai: number; batas: number; sisa: number; level: string }, bulan: string) {
  const ikon = IKON_LEVEL[it.level] || "ℹ️";
  const baris = [
    `${ikon} <b>${it.nama} budget</b> — ${LABEL_LEVEL[it.level] || it.level}`,
    `Month: ${labelBulan(bulan)}`,
    "",
    `Used: <b>${it.persen}%</b>`,
    `${formatRp(it.terpakai)} of ${formatRp(it.batas)}`,
  ];
  baris.push(
    it.level === "over"
      ? `Over by ${formatRp(Math.abs(it.sisa))}`
      : `Left: ${formatRp(it.sisa)}`
  );
  return baris.join("\n");
}

async function cekBudgetDanKirim(sesi: Sesi, bulan: string) {
  try {
    const status = await statusBudget(sesi, bulan);
    if (!status.items.length && !status.total) return { terkirim: 0 };

    const sudah: Record<string, string> = {};
    (await bacaSemua(sesi, SH.NOTIF)).forEach((r) => {
      if (String(r.bulan) === bulan) sudah[String(r.category_id)] = String(r.level);
    });

    type Kandidat = {
      categoryId: string; nama: string; batas: number; terpakai: number;
      sisa: number; persen: number; level: string;
    };

    const kandidat: Kandidat[] = status.items.map((i) => ({
      categoryId: i.categoryId, nama: i.nama, batas: i.batas,
      terpakai: i.terpakai, sisa: i.sisa, persen: i.persen, level: i.level,
    }));

    if (status.total) {
      kandidat.push({
        categoryId: KAT_TOTAL, nama: "Monthly total", batas: status.total.batas,
        terpakai: status.total.terpakai, sisa: status.total.sisa,
        persen: status.total.persen, level: status.total.level,
      });
    }

    let terkirim = 0;
    for (const it of kandidat) {
      if (it.level === "aman") continue;
      const lama = sudah[it.categoryId] || "aman";
      if (RANK_LEVEL[it.level] <= RANK_LEVEL[lama]) continue;
      if (!(await telegram(susunPesan(it, bulan)))) continue;

      terkirim++;
      const rec = { bulan, category_id: it.categoryId, level: it.level, sent_at: sekarang() };
      const ada = await cari(
        sesi, SH.NOTIF,
        (r) => String(r.bulan) === bulan && String(r.category_id) === it.categoryId
      );
      if (ada) {
        await ubah(sesi, SH.NOTIF, "bulan", bulan, rec, {
          kolom: "category_id", nilai: it.categoryId,
        });
      } else {
        await tambah(sesi, SH.NOTIF, rec);
      }
    }

    return { terkirim };
  } catch (e) {
    return { terkirim: 0, error: String(e instanceof Error ? e.message : e) };
  }
}

/* ================================== AKSI ================================== */

export async function jalankan(
  action: string,
  p: Record<string, unknown>,
  sesi: Sesi
): Promise<unknown> {
  switch (action) {
    case "bootstrap": {
      const user = await cari(sesi, SH.USERS, (u) => String(u.email).toLowerCase() === sesi.email);
      return {
        user: user ? publicUser(user) : { email: sesi.email, nama: "", peran: "admin", status: "aktif" },
        wallets: await walletAktif(sesi),
        categories: await kategoriAktif(sesi),
        telegram: statusTelegram(),
        today: hariIni(),
        bulanIni: hariIni().slice(0, 7),
      };
    }

    case "dashboard": {
      const bulan = p.bulan ? String(p.bulan) : hariIni().slice(0, 7);
      const wallets = await walletAktif(sesi);
      const txs = await semuaTx(sesi);
      const saldo = hitungSaldo(wallets, txs);
      const totalSaldo = wallets.reduce((a, w) => a + (saldo[w.id] || 0), 0);

      let masuk = 0, keluar = 0, biayaAdmin = 0;
      txs.forEach((t) => {
        if (bulanOf(t.tanggal) !== bulan) return;
        const j = num(t.jumlah);
        const fee = num(t.biaya_admin);
        if (t.tipe === "Pemasukan") masuk += j;
        else if (t.tipe === "Pengeluaran") keluar += j;
        else if (t.tipe === "Transfer") biayaAdmin += fee;
      });
      keluar += biayaAdmin;

      const cMap: Record<string, ReturnType<typeof normalCategory>> = {};
      (await kategoriAktif(sesi)).forEach((c) => { cMap[c.id] = c; });

      return {
        bulan,
        totalSaldo,
        saldoDompet: wallets.map((w) => ({
          id: w.id, nama: w.nama, jenis: w.jenis, saldo: saldo[w.id] || 0,
        })),
        ringkasan: { masuk, keluar, biayaAdmin, selisih: masuk - keluar },
        budgets: await statusBudget(sesi, bulan),
        tren: trendData(txs, 6, bulan),
        perKategori: rincianKategori(txs, bulan, cMap),
        transaksiTerakhir: txs.slice().sort(urutTx).slice(0, 8).map(rapikanTx),
        hutangPiutang: wallets
          .filter((w) => w.jenis === "hutang" || w.jenis === "piutang")
          .map((w) => ({ id: w.id, nama: w.nama, jenis: w.jenis, saldo: saldo[w.id] || 0 })),
      };
    }

    case "tx.list": {
      const txs = await semuaTx(sesi);
      const from = p.from ? String(p.from) : "";
      const to = p.to ? String(p.to) : "";
      const walletId = p.walletId ? String(p.walletId) : "";
      const categoryId = p.categoryId ? String(p.categoryId) : "";
      const tipe = p.tipe ? String(p.tipe) : "";
      const q = p.q ? String(p.q).toLowerCase() : "";

      const hasil = txs.filter((t) => {
        const tgl = String(t.tanggal || "");
        if (from && tgl < from) return false;
        if (to && tgl > to) return false;
        if (tipe && t.tipe !== tipe) return false;
        if (walletId && t.wallet_id !== walletId && t.wallet_tujuan_id !== walletId) return false;
        if (categoryId && t.category_id !== categoryId) return false;
        if (q) {
          const hay = `${t.catatan || ""} ${t.category_id || ""} ${t.jumlah || ""}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });

      hasil.sort(urutTx);
      const total = hasil.length;
      const limit = p.limit ? num(p.limit) : 300;

      const wMap: Record<string, ReturnType<typeof normalWallet>> = {};
      const cMap: Record<string, ReturnType<typeof normalCategory>> = {};
      (await bacaSemua(sesi, SH.WALLETS)).forEach((w) => { wMap[String(w.id)] = normalWallet(w); });
      (await bacaSemua(sesi, SH.CATS)).forEach((c) => { cMap[String(c.id)] = normalCategory(c); });

      const items = hasil.slice(0, limit).map((t) => {
        const d = rapikanTx(t);
        const w = wMap[String(t.wallet_id)];
        const wt = wMap[String(t.wallet_tujuan_id)];
        const c = cMap[String(t.category_id)];
        return {
          ...d,
          wallet: w ? w.nama : String(t.wallet_id),
          walletTujuan: wt ? wt.nama : "",
          kategori: t.tipe === "Transfer" ? "Transfer" : c ? c.nama : String(t.category_id),
          warna: c ? c.warna : "#64748b",
        };
      });

      return { items, total };
    }

    case "tx.save": {
      const t = (p.transaction || p) as Baris;
      const tipe = String(t.tipe || "");
      if (!["Pemasukan", "Pengeluaran", "Transfer"].includes(tipe)) {
        throw new Error("Invalid transaction type.");
      }

      const jumlah = num(t.jumlah);
      if (!(jumlah > 0)) throw new Error("Amount must be greater than 0.");

      let fee = tipe === "Transfer" ? num(t.biaya_admin) : 0;
      if (fee < 0) fee = 0;

      const walletId = String(t.wallet_id || "");
      if (!walletId) throw new Error("No wallet selected.");
      const wallets = await bacaSemua(sesi, SH.WALLETS);
      if (!wallets.some((w) => String(w.id) === walletId)) throw new Error("Wallet not found.");

      let walletTujuan = "";
      if (tipe === "Transfer") {
        walletTujuan = String(t.wallet_tujuan_id || "");
        if (!walletTujuan) throw new Error("No destination wallet selected.");
        if (walletTujuan === walletId) throw new Error("Source and destination must be different.");
        if (!wallets.some((w) => String(w.id) === walletTujuan)) {
          throw new Error("Destination wallet not found.");
        }
      }

      let categoryId = String(t.category_id || "");
      if (tipe !== "Transfer") {
        if (!categoryId) throw new Error("No category selected.");
        const cats = await bacaSemua(sesi, SH.CATS);
        if (!cats.some((c) => String(c.id) === categoryId)) throw new Error("Category not found.");
      } else {
        categoryId = "";
      }

      const tanggal = String(t.tanggal || "") || hariIni();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) {
        throw new Error("Date must be in YYYY-MM-DD format.");
      }

      const rec: Baris = {
        id: t.id ? String(t.id) : uid(),
        tanggal, tipe, wallet_id: walletId, wallet_tujuan_id: walletTujuan,
        category_id: categoryId, jumlah, biaya_admin: fee,
        catatan: String(t.catatan || ""), created_by: sesi.email,
        created_at: sekarang(), updated_at: sekarang(),
      };

      const adaBaris = t.id
        ? (await bacaSemua(sesi, SH.TX)).find((x) => String(x.id) === String(t.id))
        : null;

      if (adaBaris) {
        rec.created_at = adaBaris.created_at || rec.created_at;
        rec.created_by = adaBaris.created_by || rec.created_by;
        await ubah(sesi, SH.TX, "id", rec.id, rec);
      } else {
        await tambah(sesi, SH.TX, rec);
      }

      const notif = await cekBudgetDanKirim(sesi, bulanOf(tanggal));
      return { transaction: rec, notif };
    }

    case "tx.delete": {
      const id = String(p.id || "");
      if (!id) throw new Error("Missing transaction ID.");

      const tx = (await semuaTx(sesi)).find((t) => String(t.id) === id);
      if (!tx) return { deleted: id, sudahTidakAda: true };

      const bulan = bulanOf(tx.tanggal);
      await hapus(sesi, SH.TX, "id", id);
      return { deleted: id, notif: await cekBudgetDanKirim(sesi, bulan) };
    }

    case "wallet.list": {
      const wallets = (await bacaSemua(sesi, SH.WALLETS))
        .map(normalWallet)
        .sort((a, b) => a.urutan - b.urutan);
      const txs = await semuaTx(sesi);
      const saldo = hitungSaldo(wallets, txs);

      const hitung: Record<string, number> = {};
      txs.forEach((t) => {
        const a = String(t.wallet_id || "");
        hitung[a] = (hitung[a] || 0) + 1;
        const b = String(t.wallet_tujuan_id || "");
        if (b) hitung[b] = (hitung[b] || 0) + 1;
      });

      return {
        wallets: wallets.map((w) => ({
          ...w, saldo: saldo[w.id] || 0, jmlTransaksi: hitung[w.id] || 0,
        })),
      };
    }

    case "wallet.save": {
      const w = (p.wallet || p) as Baris;
      const nama = String(w.nama || "").trim();
      if (!nama) throw new Error("Wallet name is required.");

      const jenis = ["tunai", "bank", "ewallet", "piutang", "hutang", "investasi", "lainnya"]
        .includes(String(w.jenis)) ? String(w.jenis) : "lainnya";

      const rec: Baris = {
        id: w.id ? String(w.id) : uid(),
        nama, jenis, saldo_awal: num(w.saldo_awal),
        urutan: w.urutan !== undefined ? num(w.urutan) : (await bacaSemua(sesi, SH.WALLETS)).length + 1,
        aktif: 1, catatan: String(w.catatan || ""), created_at: sekarang(),
      };

      const adaBaris = w.id
        ? (await bacaSemua(sesi, SH.WALLETS)).find((x) => String(x.id) === rec.id)
        : null;

      if (adaBaris) {
        rec.created_at = adaBaris.created_at || rec.created_at;
        rec.aktif = num(adaBaris.aktif) === 0 ? 0 : 1;
        await ubah(sesi, SH.WALLETS, "id", rec.id, rec);
      } else {
        await tambah(sesi, SH.WALLETS, rec);
      }
      return { wallet: rec };
    }

    case "wallet.archive": {
      const id = String(p.id || "");
      if (!id) throw new Error("Missing wallet ID.");
      const w = (await bacaSemua(sesi, SH.WALLETS)).find((x) => String(x.id) === id);
      if (!w) throw new Error("Wallet not found.");

      const aktif = num(p.aktif) ? 1 : 0;
      if (!aktif) {
        const txs = await semuaTx(sesi);
        const saldo = hitungSaldo([normalWallet(w)], txs)[id] || 0;
        if (Math.abs(saldo) > 0.5 && !p.paksa) {
          throw new Error(
            `This wallet still holds ${formatRp(saldo)}. Transfer it out first, or archive anyway.`
          );
        }
      }
      await ubah(sesi, SH.WALLETS, "id", id, { aktif });
      return { id, aktif };
    }

    case "wallet.hapusBanyak": {
      const ids = ((p.ids as string[]) || []).map(String);
      if (!ids.length) throw new Error("No wallets selected.");

      const wallets = await bacaSemua(sesi, SH.WALLETS);
      const ada = wallets.filter((w) => ids.includes(String(w.id)));
      if (!ada.length) return { dihapus: 0, transaksiTerhapus: 0 };

      const txs = await semuaTx(sesi);
      const terkait = txs.filter(
        (t) =>
          ids.includes(String(t.wallet_id)) ||
          ids.includes(String(t.wallet_tujuan_id))
      );

      if (terkait.length && !p.paksa) {
        throw new Error(
          `${ada.length} wallet dan ${terkait.length} transaksi akan terhapus. ` +
            "Centang paksa untuk melanjutkan."
        );
      }

      /* Satu permintaan untuk semua baris transaksi, satu untuk semua dompet. */
      await hapusBaris(SH.TX, terkait.map((t) => Number(t._row)));
      lupakan(sesi, SH.TX);
      await hapusBaris(SH.WALLETS, ada.map((w) => Number(w._row)));
      lupakan(sesi, SH.WALLETS);

      return { dihapus: ada.length, transaksiTerhapus: terkait.length };
    }

    case "wallet.delete": {
      const id = String(p.id || "");
      if (!id) throw new Error("Missing wallet ID.");

      const w = (await bacaSemua(sesi, SH.WALLETS)).find((x) => String(x.id) === id);
      if (!w) return { deleted: id, sudahTidakAda: true };

      const terkait = (await semuaTx(sesi)).filter(
        (t) => String(t.wallet_id) === id || String(t.wallet_tujuan_id) === id
      );

      if (terkait.length && !p.paksa) {
        throw new Error(
          `This wallet is used by ${terkait.length} transaction(s). ` +
            "Archive it, or delete it together with those transactions."
        );
      }

      await hapusBaris(SH.TX, terkait.map((t) => Number(t._row)));
      lupakan(sesi, SH.TX);
      await hapus(sesi, SH.WALLETS, "id", id);

      return { deleted: id, transaksiTerhapus: terkait.length };
    }

    case "category.save": {
      const c = (p.category || p) as Baris;
      const nama = String(c.nama || "").trim();
      if (!nama) throw new Error("Category name is required.");

      const tipe = String(c.tipe || "Pengeluaran");
      if (!["Pemasukan", "Pengeluaran"].includes(tipe)) throw new Error("Invalid category type.");

      const id = c.id
        ? String(c.id)
        : `${nama.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 24) || "kat"}_${Math.random().toString(36).slice(2, 6)}`;

      const daftar = await bacaSemua(sesi, SH.CATS);
      const adaBaris = c.id ? daftar.find((x) => String(x.id) === id) : null;

      if (adaBaris && num(adaBaris.sistem) === 1) {
        await ubah(sesi, SH.CATS, "id", id, { nama, warna: c.warna || adaBaris.warna });
        return { category: normalCategory(await cari(sesi, SH.CATS, (x) => String(x.id) === id) as Baris) };
      }

      const rec: Baris = {
        id, nama, tipe, warna: String(c.warna || "#64748b"),
        ikon: String(c.ikon || "Tag"), sistem: 0,
        urutan: c.urutan !== undefined ? num(c.urutan) : daftar.length + 1, aktif: 1,
        /* kosong berarti tampil di budget */
        sembunyi_budget: num(c.sembunyi_budget) === 1 ? 1 : "",
      };

      if (adaBaris) await ubah(sesi, SH.CATS, "id", id, rec);
      else await tambah(sesi, SH.CATS, rec);

      return { category: rec };
    }

    case "category.delete": {
      const id = String(p.id || "");
      if (!id) throw new Error("Missing category ID.");
      const c = (await bacaSemua(sesi, SH.CATS)).find((x) => String(x.id) === id);
      if (!c) throw new Error("Category not found.");
      if (num(c.sistem) === 1) throw new Error("System categories cannot be deleted.");

      const dipakai = (await semuaTx(sesi)).some((t) => t.category_id === id);
      if (dipakai) {
        await ubah(sesi, SH.CATS, "id", id, { aktif: 0 });
        return { id, archived: true };
      }

      await hapus(sesi, SH.CATS, "id", id);

      const budgets = (await bacaSemua(sesi, SH.BUDGET)).filter((b) => String(b.category_id) === id);
      for (const b of budgets) await hapus(sesi, SH.BUDGET, "id", String(b.id));

      return { id, deleted: true };
    }

    case "budget.page": {
      const bulan = p.bulan ? String(p.bulan) : hariIni().slice(0, 7);
      const sebelum = geserBulan(bulan, -1);
      return {
        bulan,
        status: await statusBudget(sesi, bulan),
        statusBulanLain: await statusBudget(sesi, sebelum),
        /* Kategori sistem seperti Biaya Admin tidak ikut, karena biayanya
           sudah dihitung otomatis dari transfer. Tetap masuk hitungan total. */
        kategoriTersedia: (await kategoriAktif(sesi)).filter(
          (c) => c.tipe === "Pengeluaran" && c.sistem !== 1 && c.tanpaBudget !== 1
        ),
        adaBudgetBulanLalu: (await bacaSemua(sesi, SH.BUDGET)).some(
          (b) => String(b.bulan) === sebelum
        ),
      };
    }

    case "budget.saveAll": {
      const bulan = String(p.bulan || "");
      if (!/^\d{4}-\d{2}$/.test(bulan)) throw new Error("Month must be in YYYY-MM format.");

      /* Satu permintaan untuk semua penghapusan, satu untuk semua penambahan.
         Kuota tulis Google Sheets hanya 60 per menit. */
      const lama = (await bacaSemua(sesi, SH.BUDGET)).filter((b) => String(b.bulan) === bulan);
      await hapusBanyak(sesi, SH.BUDGET, "id", lama.map((b) => String(b.id)));

      const items = (p.items as { category_id: string; jumlah: number }[]) || [];
      const baru: Baris[] = [];
      for (const it of items) {
        /* batas total tidak lagi disimpan sendiri */
        if (String(it.category_id) === KAT_TOTAL) continue;
        const jumlah = num(it.jumlah);
        if (!(jumlah > 0)) continue;
        baru.push({
          id: uid(), bulan, category_id: String(it.category_id),
          jumlah, updated_at: sekarang(),
        });
      }
      await tambahSemua(sesi, SH.BUDGET, baru);

      return { bulan, status: await statusBudget(sesi, bulan) };
    }

    case "budget.copy": {
      const dari = String(p.dari || "");
      const ke = String(p.ke || "");
      if (!/^\d{4}-\d{2}$/.test(dari) || !/^\d{4}-\d{2}$/.test(ke)) {
        throw new Error("Month must be in YYYY-MM format.");
      }

      const sumber = (await bacaSemua(sesi, SH.BUDGET)).filter((b) => String(b.bulan) === dari);
      if (!sumber.length) throw new Error(`No budget found for ${dari}.`);

      const target = (await bacaSemua(sesi, SH.BUDGET)).filter((b) => String(b.bulan) === ke);
      await hapusBanyak(sesi, SH.BUDGET, "id", target.map((b) => String(b.id)));

      await tambahSemua(
        sesi,
        SH.BUDGET,
        sumber.map((b) => ({
          id: uid(), bulan: ke, category_id: String(b.category_id),
          jumlah: num(b.jumlah), updated_at: sekarang(),
        }))
      );

      return { dari, ke, jumlah: sumber.length, status: await statusBudget(sesi, ke) };
    }

    case "report": {
      const bulan = p.bulan ? String(p.bulan) : hariIni().slice(0, 7);
      const from = p.from ? String(p.from) : `${bulan}-01`;
      const to = p.to ? String(p.to) : akhirBulan(bulan);

      const semua = await semuaTx(sesi);
      const txs = semua.filter((t) => {
        const d = String(t.tanggal || "");
        return d >= from && d <= to;
      });

      let masuk = 0, keluar = 0, biayaAdmin = 0;
      const perKategori: Record<string, number> = {};
      const perDompet: Record<string, number> = {};
      const harian: Record<string, { tanggal: string; masuk: number; keluar: number }> = {};

      txs.forEach((t) => {
        const j = num(t.jumlah);
        const fee = num(t.biaya_admin);
        const d = String(t.tanggal);
        if (!harian[d]) harian[d] = { tanggal: d, masuk: 0, keluar: 0 };

        if (t.tipe === "Pemasukan") {
          masuk += j;
          harian[d].masuk += j;
          const k = String(t.category_id);
          perKategori[k] = (perKategori[k] || 0) + j;
          const a = String(t.wallet_id);
          perDompet[a] = (perDompet[a] || 0) + j;
        } else if (t.tipe === "Pengeluaran") {
          keluar += j;
          harian[d].keluar += j;
          const k = String(t.category_id);
          perKategori[k] = (perKategori[k] || 0) + j;
          const a = String(t.wallet_id);
          perDompet[a] = (perDompet[a] || 0) - j;
        } else if (t.tipe === "Transfer") {
          biayaAdmin += fee;
          keluar += fee;
          harian[d].keluar += fee;
          if (fee) perKategori[KAT_BIAYA_ADMIN] = (perKategori[KAT_BIAYA_ADMIN] || 0) + fee;
          const a = String(t.wallet_id);
          const b = String(t.wallet_tujuan_id);
          perDompet[a] = (perDompet[a] || 0) - j - fee;
          perDompet[b] = (perDompet[b] || 0) + j;
        }
      });

      const wMap: Record<string, ReturnType<typeof normalWallet>> = {};
      const cMap: Record<string, ReturnType<typeof normalCategory>> = {};
      (await bacaSemua(sesi, SH.WALLETS)).forEach((w) => { wMap[String(w.id)] = normalWallet(w); });
      (await bacaSemua(sesi, SH.CATS)).forEach((c) => { cMap[String(c.id)] = normalCategory(c); });

      const bulanLalu = geserBulan(bulan, -1);
      const fromLalu = `${bulanLalu}-01`;
      const toLalu = akhirBulan(bulanLalu);
      let masukLalu = 0, keluarLalu = 0;
      semua.forEach((t) => {
        const d = String(t.tanggal || "");
        if (d < fromLalu || d > toLalu) return;
        const j = num(t.jumlah);
        const fee = num(t.biaya_admin);
        if (t.tipe === "Pemasukan") masukLalu += j;
        else if (t.tipe === "Pengeluaran") keluarLalu += j;
        else if (t.tipe === "Transfer") keluarLalu += fee;
      });

      const hari = Object.keys(harian).sort().map((k) => harian[k]);

      return {
        from, to, bulan,
        ringkasan: {
          masuk, keluar, biayaAdmin, selisih: masuk - keluar,
          jumlahTransaksi: txs.length,
          rataHarian: keluar / (hari.length || 1),
        },
        pembanding: {
          bulan: bulanLalu, masuk: masukLalu, keluar: keluarLalu,
          selisihMasuk: masuk - masukLalu, selisihKeluar: keluar - keluarLalu,
        },
        perKategori: Object.keys(perKategori)
          .map((id) => {
            const c = cMap[id];
            return {
              id, nama: c ? c.nama : id, warna: c ? c.warna : "#64748b",
              tipe: c ? c.tipe : "Pengeluaran", jumlah: perKategori[id],
            };
          })
          .sort((a, b) => b.jumlah - a.jumlah),
        perDompet: Object.keys(perDompet)
          .map((id) => {
            const w = wMap[id];
            return { id, nama: w ? w.nama : id, jenis: w ? w.jenis : "lainnya", jumlah: perDompet[id] };
          })
          .sort((a, b) => b.jumlah - a.jumlah),
        harian: hari,
        tren: trendData(semua, 12, bulan),
      };
    }

    case "users.list":
      return { users: (await bacaSemua(sesi, SH.USERS)).map(publicUser) };

    case "users.save": {
      const u = (p.user || p) as Baris;
      const email = String(u.email || "").trim().toLowerCase();
      if (!email || !email.includes("@")) throw new Error("Invalid email.");

      const peran = String(u.peran || "admin") === "lihat" ? "lihat" : "admin";
      const status = String(u.status || "aktif").toLowerCase() === "nonaktif" ? "nonaktif" : "aktif";

      const adaBaris = (await bacaSemua(sesi, SH.USERS)).find(
        (x) => String(x.email).toLowerCase() === email
      );

      if (adaBaris) {
        if (String(adaBaris.email).toLowerCase() === sesi.email && status === "nonaktif") {
          throw new Error("You cannot deactivate your own account.");
        }
        await ubah(sesi, SH.USERS, "email", adaBaris.email, {
          nama: String(u.nama || ""), peran, status,
        });
      } else {
        await tambah(sesi, SH.USERS, {
          email, nama: String(u.nama || ""), peran, status,
          created_at: sekarang(), last_login: "",
        });
      }

      const hasil = await cari(sesi, SH.USERS, (x) => String(x.email).toLowerCase() === email);
      return { user: publicUser(hasil as Baris) };
    }

    case "users.delete": {
      const email = String(p.email || "").toLowerCase();
      if (!email) throw new Error("Missing email.");
      if (email === sesi.email) throw new Error("You cannot remove your own account.");

      const row = await cari(sesi, SH.USERS, (u) => String(u.email).toLowerCase() === email);
      if (!row) throw new Error("User not found.");

      const aktif = (await bacaSemua(sesi, SH.USERS)).filter(
        (u) => String(u.status).toLowerCase() === "aktif"
      );
      if (aktif.length <= 1) throw new Error("At least one active user is required.");

      await hapus(sesi, SH.USERS, "email", row.email);
      return { deleted: email };
    }

    case "telegram.status":
      return statusTelegram();

    case "telegram.test":
      return { sent: await telegram("✅ <b>Finansial</b>\nNotifikasi Telegram berhasil disambungkan.") };

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

/**
 * Data dasar yang selalu dibutuhkan aplikasi: pengguna, dompet, kategori.
 *
 * Semuanya dibaca dari sesi yang sudah dimuat, jadi TIDAK menambah
 * permintaan ke Google. Dengan ini permintaan pertama halaman sekaligus
 * membawa data dasar, sehingga membuka aplikasi cukup satu perjalanan.
 */
export async function meta(sesi: Sesi) {
  const users = await bacaSemua(sesi, SH.USERS);
  const saya = users.find(
    (u) => String(u.email).toLowerCase() === sesi.email
  );

  return {
    user: saya
      ? publicUser(saya)
      : { email: sesi.email, nama: "", peran: "admin", status: "aktif" },
    wallets: await walletAktif(sesi),
    categories: await kategoriAktif(sesi),
    telegram: statusTelegram(),
    today: hariIni(),
    bulanIni: hariIni().slice(0, 7),
  };
}

export async function adaSheetTransaksi(): Promise<boolean> {
  return (await idSheet(SH.TX)) !== null;
}
