const GAS_URL = process.env.NEXT_PUBLIC_GAS_URL || "";
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
  return GAS_URL;
}

export function adaKonfigurasi(): boolean {
  return !!GAS_URL && !GAS_URL.includes("XXXX");
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

/** Panggil API Apps Script. Melempar ApiError bila gagal. */
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

  const body = JSON.stringify({
    action,
    payload,
    token: ambilToken() || "",
  });

  let res: Response;
  try {
    res = await fetch(GAS_URL, {
      method: "POST",
      // text/plain menghindari preflight CORS — Apps Script tidak menangani OPTIONS
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body,
      redirect: "follow",
    });
  } catch {
    throw new ApiError(
      "JARINGAN",
      "Tidak bisa menghubungi server. Periksa koneksi internet lalu coba lagi."
    );
  }

  let json: { ok?: boolean; data?: T; error?: string; message?: string };
  try {
    json = await res.json();
  } catch {
    throw new ApiError(
      "RESPONS_TIDAK_VALID",
      "Balasan server tidak dikenali. Biasanya karena URL Apps Script salah, atau deployment belum di-set ke akses \"Anyone\"."
    );
  }

  if (!json || json.ok !== true) {
    throw new ApiError(json?.error || "ERROR", json?.message || "Terjadi kesalahan.");
  }

  return json.data as T;
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
