import { GoogleAuth } from "google-auth-library";

/**
 * Akses Google Sheets langsung dari Vercel.
 *
 * Menggantikan Apps Script, yang setiap permintaan POST-nya harus dialihkan
 * ke server lain (302) sehingga makan 5-8 detik. Lewat Sheets API langsung,
 * satu permintaan selesai dalam ratusan milidetik.
 *
 * Semua penulisan memakai valueInputOption=RAW supaya Google Sheets TIDAK
 * mengubah teks "2026-09-29" menjadi nilai tanggal.
 */

const SHEET_ID = process.env.SHEET_ID || "";
const SA_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || "";
const BASE = "https://sheets.googleapis.com/v4/spreadsheets";

export function adaKredensial(): boolean {
  return !!SHEET_ID && !!SA_JSON;
}

export function sheetId(): string {
  return SHEET_ID;
}

/**
 * Uji menyeluruh: baca judul spreadsheet memakai kredensial yang ada.
 * Dipakai endpoint /api/rpc untuk memastikan konfigurasi benar-benar jalan,
 * bukan sekadar terisi.
 */
export async function ujiSheets(): Promise<string> {
  if (!adaKredensial()) return "kredensial belum lengkap";
  try {
    const hasil = (await panggil(
      `/${SHEET_ID}?fields=properties.title`
    )) as { properties?: { title?: string } };
    return `BERHASIL membaca spreadsheet: ${hasil.properties?.title || "(tanpa judul)"}`;
  } catch (e) {
    return `GAGAL: ${e instanceof Error ? e.message : String(e)}`;
  }
}

/* ================================ AUTENTIKASI ============================= */

let auth: GoogleAuth | null = null;

function ambilAuth(): GoogleAuth {
  if (auth) return auth;

  let kredensial: Record<string, unknown>;
  try {
    const teks = SA_JSON.trim().startsWith("{")
      ? SA_JSON
      : Buffer.from(SA_JSON, "base64").toString("utf8");
    kredensial = JSON.parse(teks);
  } catch {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_JSON tidak bisa dibaca. Isi dengan isi berkas JSON service account, atau versi base64-nya."
    );
  }

  auth = new GoogleAuth({
    credentials: kredensial,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return auth;
}

let tokenCache: { nilai: string; sampai: number } | null = null;

async function accessToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.sampai) return tokenCache.nilai;

  const client = await ambilAuth().getClient();
  const hasil = await client.getAccessToken();
  if (!hasil.token) throw new Error("Gagal mendapatkan token akses Google.");

  /* token berlaku 1 jam; simpan 50 menit */
  tokenCache = { nilai: hasil.token, sampai: Date.now() + 50 * 60 * 1000 };
  return hasil.token;
}

class GalatSheets extends Error {
  status: number;
  constructor(status: number, pesan: string) {
    super(pesan);
    this.status = status;
    this.name = "GalatSheets";
  }
}

/** 429 dan 5xx biasanya gangguan sesaat, layak dicoba ulang. */
function sementara(e: unknown): boolean {
  if (e instanceof GalatSheets) return e.status === 429 || e.status >= 500;
  return true; /* kegagalan jaringan */
}

function jeda(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function panggilSekali(
  jalur: string,
  opsi?: { method?: string; body?: unknown }
): Promise<unknown> {
  const token = await accessToken();
  const res = await fetch(`${BASE}${jalur}`, {
    method: opsi?.method || "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: opsi?.body ? JSON.stringify(opsi.body) : undefined,
    cache: "no-store",
  });

  const teks = await res.text();
  if (!res.ok) {
    throw new GalatSheets(
      res.status,
      `Sheets API menolak (${res.status}): ${teks.slice(0, 300)}`
    );
  }
  return teks ? JSON.parse(teks) : {};
}

/**
 * Hanya pembacaan yang dicoba ulang.
 *
 * Mengulang penulisan berbahaya: kalau penulisan sebenarnya berhasil tetapi
 * balasannya hilang, pengulangan akan menambah atau menghapus baris dua kali.
 * Penulisan yang gagal ditangani di lapisan atas, tempat ID transaksi sudah
 * dibuat lebih dulu sehingga pengiriman ulang hanya memperbarui baris yang ada.
 */
async function panggil(
  jalur: string,
  opsi?: { method?: string; body?: unknown }
): Promise<unknown> {
  const metode = opsi?.method || "GET";
  if (metode !== "GET") return panggilSekali(jalur, opsi);

  let terakhir: unknown = null;
  for (let coba = 1; coba <= 3; coba++) {
    try {
      return await panggilSekali(jalur, opsi);
    } catch (e) {
      if (!sementara(e)) throw e;
      terakhir = e;
      if (coba < 3) await jeda(200 * coba);
    }
  }
  throw terakhir instanceof Error
    ? terakhir
    : new Error("Sheets API tidak merespons.");
}

/* ================================== BACA ================================== */

export async function bacaRange(range: string): Promise<unknown[][]> {
  const hasil = (await panggil(
    `/${SHEET_ID}/values/${encodeURIComponent(range)}?majorDimension=ROWS`
  )) as { values?: unknown[][] };
  return hasil.values || [];
}

/**
 * Baca beberapa rentang sekaligus dalam SATU permintaan.
 *
 * Kuota Google Sheets hanya 60 pembacaan per menit. Tanpa ini, satu
 * permintaan aplikasi memakai 5-8 pembacaan, sehingga sekitar 8 klik
 * sudah menghabiskan kuota.
 */
export async function bacaBanyak(ranges: string[]): Promise<unknown[][][]> {
  if (!ranges.length) return [];
  const q = ranges.map((r) => `ranges=${encodeURIComponent(r)}`).join("&");
  const hasil = (await panggil(
    `/${SHEET_ID}/values:batchGet?${q}&majorDimension=ROWS`
  )) as { valueRanges?: { values?: unknown[][] }[] };
  return (hasil.valueRanges || []).map((v) => v.values || []);
}

type InfoSheet = { sheetId: number; title: string };

let infoCache: { daftar: InfoSheet[]; sampai: number } | null = null;

async function daftarSheet(): Promise<InfoSheet[]> {
  if (infoCache && Date.now() < infoCache.sampai) return infoCache.daftar;

  const hasil = (await panggil(
    `/${SHEET_ID}?fields=sheets(properties(sheetId,title))`
  )) as { sheets?: { properties: InfoSheet }[] };

  const daftar = (hasil.sheets || []).map((s) => s.properties);
  infoCache = { daftar, sampai: Date.now() + 60 * 1000 };
  return daftar;
}

export async function idSheet(nama: string): Promise<number | null> {
  const daftar = await daftarSheet();
  const ketemu = daftar.find((s) => s.title === nama);
  return ketemu ? ketemu.sheetId : null;
}

export async function adaSheet(nama: string): Promise<boolean> {
  return (await idSheet(nama)) !== null;
}

export function lupakanInfoSheet() {
  infoCache = null;
}

/* ================================== TULIS ================================= */

export async function tambahBaris(
  nama: string,
  nilai: unknown[]
): Promise<void> {
  const range = `${nama}!A1`;
  await panggil(
    `/${SHEET_ID}/values/${encodeURIComponent(range)}:append` +
      `?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    { method: "POST", body: { values: [nilai] } }
  );
}

/** Tambah banyak baris dalam SATU permintaan tulis. */
export async function tambahBanyak(
  nama: string,
  baris: unknown[][]
): Promise<void> {
  if (!baris.length) return;
  const range = `${nama}!A1`;
  await panggil(
    `/${SHEET_ID}/values/${encodeURIComponent(range)}:append` +
      `?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    { method: "POST", body: { values: baris } }
  );
}

export async function tulisBaris(
  nama: string,
  baris: number,
  nilai: unknown[]
): Promise<void> {
  const akhir = kolomKe(nilai.length);
  const range = `${nama}!A${baris}:${akhir}${baris}`;
  await panggil(
    `/${SHEET_ID}/values/${encodeURIComponent(range)}?valueInputOption=RAW`,
    { method: "PUT", body: { values: [nilai] } }
  );
}

/** Hapus beberapa baris sekaligus, dari bawah ke atas supaya nomornya tetap sah. */
export async function hapusBaris(
  nama: string,
  nomorBaris: number[]
): Promise<void> {
  if (!nomorBaris.length) return;
  const sid = await idSheet(nama);
  if (sid === null) throw new Error(`Sheet "${nama}" tidak ditemukan.`);

  const urut = [...nomorBaris].sort((a, b) => b - a);
  await panggil(`/${SHEET_ID}:batchUpdate`, {
    method: "POST",
    body: {
      requests: urut.map((r) => ({
        deleteDimension: {
          range: {
            sheetId: sid,
            dimension: "ROWS",
            startIndex: r - 1,
            endIndex: r,
          },
        },
      })),
    },
  });
}

/** Buat sheet baru beserta baris judulnya kalau belum ada. */
export async function buatSheet(
  nama: string,
  header: string[]
): Promise<void> {
  if (await adaSheet(nama)) return;

  await panggil(`/${SHEET_ID}:batchUpdate`, {
    method: "POST",
    body: { requests: [{ addSheet: { properties: { title: nama } } }] },
  });
  lupakanInfoSheet();

  await tulisBaris(nama, 1, header);
}

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
