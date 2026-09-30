/* Backend ada di domain yang sama, jadi tidak ada CORS dan tidak ada
   pengalihan 302 seperti pada Apps Script. */
const ENDPOINT = "/api/rpc";
const TOKEN_KEY = "finansial.token";
const USER_KEY = "finansial.user";
const THEME_KEY = "finansial.theme";

export class ApiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "ApiError";
  }
}

export function gasUrl(): string {
  return ENDPOINT;
}

export function adaKonfigurasi(): boolean {
  /* yang wajib ada sekarang hanya Client ID untuk login;
     backend-nya ada di domain ini sendiri */
  return !!GOOGLE_CLIENT_ID && !GOOGLE_CLIENT_ID.includes("XXXX");
}

/**
 * ID dibuat di sisi browser, bukan di server.
 *
 * Apps Script kadang menjatuhkan isi POST dan mengubahnya menjadi GET,
 * sehingga permintaan yang sebenarnya sudah berhasil terlihat gagal lalu
 * dikirim ulang. Dengan ID yang sama, pengiriman ulang hanya memperbarui
 * baris yang sudah ada — bukan menambah baris baru (transaksi dobel).
 */
export function idBaru(): string {
  const acak = () => Math.random().toString(36).slice(2, 10);
  return (Date.now().toString(36) + acak() + acak()).slice(0, 16);
}

export function ambilToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function simpanToken(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* abaikan */
  }
}

export function hapusSesi() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    /* abaikan */
  }
}

export function simpanUser(user: unknown) {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    /* abaikan */
  }
}

export function ambilUser<T = unknown>(): T | null {
  if (typeof window === "undefined") return null;
  try {
    const s = localStorage.getItem(USER_KEY);
    return s ? (JSON.parse(s) as T) : null;
  } catch {
    return null;
  }
}

export function ambilTema(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  try {
    const t = localStorage.getItem(THEME_KEY);
    if (t === "dark" || t === "light") return t;
  } catch {
    /* abaikan */
  }
  return "light";
}

export function simpanTema(t: "light" | "dark") {
  try {
    localStorage.setItem(THEME_KEY, t);
  } catch {
    /* abaikan */
  }
  if (typeof document !== "undefined") {
    document.documentElement.classList.toggle("dark", t === "dark");
  }
}

/**
 * Panggil API Apps Script. Melempar ApiError bila gagal.
 *
 * Gangguan sementara dicoba ulang otomatis. Ini perlu karena Apps Script
 * mengalihkan setiap POST ke URL script.googleusercontent.com yang hanya
 * berlaku sekali dan cepat kedaluwarsa, sehingga sesekali balas 404 atau
 * halaman HTML. Mengulang permintaan hampir selalu berhasil.
 */
const MAKS_COBA = 3;
const JEDA_MS = 500;

function bolehDiulang(kode: string): boolean {
  return (
    kode === "JARINGAN" ||
    kode === "RESPONS_TIDAK_VALID" ||
    kode === "SEMENTARA"
  );
}

function tunggu(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function api<T = unknown>(
  action: string,
  payload: Record<string, unknown> = {}
): Promise<T> {
  if (!adaKonfigurasi()) {
    throw new ApiError(
      "BELUM_DIKONFIGURASI",
      "URL backend belum diisi. Set NEXT_PUBLIC_GAS_URL di file .env.local lalu jalankan ulang."
    );
  }

  let galatTerakhir: ApiError | null = null;

  for (let percobaan = 1; percobaan <= MAKS_COBA; percobaan++) {
    try {
      return await sekali<T>(action, payload);
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError("ERROR", String(e));
      if (!bolehDiulang(err.code)) throw err;

      galatTerakhir = err;
      if (percobaan < MAKS_COBA) {
        await tunggu(JEDA_MS * percobaan);
      }
    }
  }

  throw new ApiError(
    "SEMENTARA",
    galatTerakhir?.message
      ? `${galatTerakhir.message} Sudah dicoba ${MAKS_COBA} kali.`
      : "Server tidak merespons setelah beberapa kali percobaan."
  );
}

async function sekali<T>(
  action: string,
  payload: Record<string, unknown>
): Promise<T> {
  const body = JSON.stringify({
    action,
    payload,
    token: ambilToken() || "",
  });

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      // text/plain menghindari preflight CORS — Apps Script tidak menangani OPTIONS
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body,
      redirect: "follow",
    });
  } catch {
    throw new ApiError(
      "JARINGAN",
      "Tidak bisa menghubungi server. Periksa koneksi internet."
    );
  }

  if (!res.ok) {
    throw new ApiError(
      "SEMENTARA",
      `Server membalas kode ${res.status}.`
    );
  }

  let json: { ok?: boolean; data?: T; error?: string; message?: string };
  try {
    json = await res.json();
  } catch {
    throw new ApiError(
      "RESPONS_TIDAK_VALID",
      "Balasan server tidak dikenali. Biasanya gangguan sesaat dari Apps Script, atau URL deployment salah."
    );
  }

  if (!json || json.ok !== true) {
    throw new ApiError(json?.error || "ERROR", json?.message || "Terjadi kesalahan.");
  }

  return json.data as T;
}

/**
 * Permintaan identik dipakai bersama, dan hasilnya disimpan sebentar.
 *
 * Dua sebab:
 *  1. Di mode pengembangan React memasang efek dua kali (StrictMode), jadi
 *     tanpa ini setiap halaman memanggil Apps Script dua kali.
 *  2. Satu panggilan ke Apps Script butuh 1-3 detik. Tanpa cache, berpindah
 *     menu bolak-balik terasa lambat padahal datanya belum berubah.
 *
 * Cache dibuang setiap kali ada data yang disimpan (lihat picuMuatUlang),
 * jadi angkanya tidak pernah basi setelah kamu mencatat sesuatu.
 */
const TTL_MS = 20000;
const cacheHasil = new Map<string, { waktu: number; data: unknown }>();
const sedangJalan = new Map<string, Promise<unknown>>();

export function bersihkanCacheApi() {
  cacheHasil.clear();
}

export function apiSekali<T = unknown>(
  action: string,
  payload: Record<string, unknown> = {},
  opsi?: { paksa?: boolean }
): Promise<T> {
  const kunci = action + "|" + JSON.stringify(payload ?? null);

  if (!opsi?.paksa) {
    const tersimpan = cacheHasil.get(kunci);
    if (tersimpan && Date.now() - tersimpan.waktu < TTL_MS) {
      return Promise.resolve(tersimpan.data as T);
    }

    const ada = sedangJalan.get(kunci);
    if (ada) return ada as Promise<T>;
  }

  const p = api<T>(action, payload)
    .then((hasil) => {
      cacheHasil.set(kunci, { waktu: Date.now(), data: hasil });
      return hasil;
    })
    .finally(() => {
      sedangJalan.delete(kunci);
    });

  sedangJalan.set(kunci, p);
  return p;
}

/* ============================ AUTH: GOOGLE ============================ */

let gisPromise: Promise<void> | null = null;

export function muatGoogleIdentity(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (gisPromise) return gisPromise;

  gisPromise = new Promise<void>((resolve, reject) => {
    const w = window as unknown as { google?: unknown };
    if (w.google) return resolve();

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gisPromise = null;
      reject(new Error("Gagal memuat layanan masuk Google. Periksa koneksi internet."));
    };
    document.head.appendChild(script);
  });

  return gisPromise;
}

export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
