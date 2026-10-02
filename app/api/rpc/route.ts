import { NextResponse, type NextRequest } from "next/server";
import { adaKredensial, ujiSheets } from "@/lib/sheets";
import {
  jalankan,
  meta,
  muatSemua,
  pastikanKolom,
  penggunaTerdaftar,
  sesiBaru,
  siapkanJikaPerlu,
} from "@/lib/backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/* Google Sheets kadang lambat saat pertama diakses. Beri ruang 60 detik
   supaya tidak muncul "Application error" di Vercel. */
export const maxDuration = 60;

/**
 * Satu-satunya pintu masuk backend.
 *
 * Frontend memanggil /api/rpc pada domain yang sama, jadi tidak ada CORS dan
 * tidak ada pengalihan 302 seperti pada Apps Script. Satu permintaan selesai
 * dalam ratusan milidetik, bukan 5-8 detik.
 *
 * Selama GOOGLE_SERVICE_ACCOUNT_JSON belum diisi, permintaan diteruskan ke
 * Apps Script supaya aplikasinya tetap jalan.
 */

function balas(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function gagal(error: string, message: string, status = 200) {
  return balas({ ok: false, error, message }, status);
}

/** Kuota Google Sheets hanya 60 pembacaan per menit. Beri pesan yang jelas. */
function pesanRamah(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  if (m.includes("429") || m.includes("RESOURCE_EXHAUSTED")) {
    return (
      "Google sedang membatasi permintaan (kuota per menit habis). " +
      "Tunggu sekitar satu menit lalu coba lagi."
    );
  }
  return m;
}

/* ============================ VERIFIKASI TOKEN ============================ */

type Who = { email: string; nama: string; sampai: number };

const cacheToken = new Map<string, Who>();
const MASA_TOKEN = 25 * 60 * 1000;

async function verifikasi(idToken: string): Promise<Who | null> {
  if (!idToken) return null;

  /* dipakai potongan akhir token sebagai kunci supaya token tidak disimpan utuh */
  const kunci = idToken.slice(-48);
  const tersimpan = cacheToken.get(kunci);
  if (tersimpan && Date.now() < tersimpan.sampai) return tersimpan;

  let res: Response;
  try {
    res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
      { cache: "no-store" }
    );
  } catch {
    return null;
  }
  if (!res.ok) return null;

  const p = (await res.json()) as {
    email?: string;
    email_verified?: string;
    aud?: string;
    name?: string;
  };
  if (!p.email || p.email_verified !== "true") return null;

  const aud = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (aud && p.aud !== aud) return null;

  const who: Who = {
    email: String(p.email).toLowerCase(),
    nama: p.name || "",
    sampai: Date.now() + MASA_TOKEN,
  };
  cacheToken.set(kunci, who);
  return who;
}

/* ============================ CADANGAN: GAS ============================== */

async function teruskanKeGas(body: unknown) {
  /* GAS_URL dipakai lebih dulu supaya URL cadangan ini tidak perlu
     berawalan NEXT_PUBLIC_ (yang berarti ikut terkirim ke browser). */
  const url = process.env.GAS_URL || process.env.NEXT_PUBLIC_GAS_URL;
  if (!url) {
    return gagal(
      "BELUM_DIKONFIGURASI",
      "Backend belum disiapkan. Isi GOOGLE_SERVICE_ACCOUNT_JSON dan SHEET_ID, atau NEXT_PUBLIC_GAS_URL sebagai cadangan."
    );
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(body),
      redirect: "follow",
      cache: "no-store",
    });
    const teks = await res.text();
    if (!res.ok || !teks.trim().startsWith("{")) {
      return gagal("SEMENTARA", `Apps Script membalas kode ${res.status}.`);
    }
    return new NextResponse(teks, {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch {
    return gagal("JARINGAN", "Tidak bisa menghubungi server.");
  }
}

/* ================================ HANDLER ================================ */

export async function POST(req: NextRequest) {
  let body: { action?: string; payload?: Record<string, unknown>; token?: string };
  try {
    body = await req.json();
  } catch {
    return gagal("BAD_REQUEST", "Body bukan JSON yang sah.");
  }

  const action = String(body.action || "");
  const payload = body.payload || {};

  if (action === "ping") {
    return balas({
      ok: true,
      data: { pong: true, backend: adaKredensial() ? "vercel" : "apps-script" },
    });
  }

  if (!adaKredensial()) return teruskanKeGas(body);

  const who = await verifikasi(String(body.token || ""));
  if (!who) {
    return gagal(
      "UNAUTHORIZED",
      "Session is invalid or expired. Please sign in again."
    );
  }

  try {
    const sesi = sesiBaru(who.email);

    /* Pastikan sheet ada, lalu ambil SELURUH isinya dalam satu permintaan.
       Setelah itu semua pembacaan lain gratis. Kuota Google Sheets hanya
       60 pembacaan per menit, jadi jumlah permintaan harus ditekan. */
    await siapkanJikaPerlu(sesi);
    await muatSemua(sesi);
    /* tambahkan kolom baru kalau fitur baru menambahkannya */
    await pastikanKolom(sesi);

    const terdaftar = await penggunaTerdaftar(sesi, who.email);
    if (!terdaftar.ok) return gagal("FORBIDDEN", terdaftar.pesan || "Not allowed.");

    const data = await jalankan(action, payload, sesi);

    /* Data dasar ikut dikirim supaya aplikasi tidak perlu permintaan kedua. */
    const info = await meta(sesi);
    return balas({ ok: true, meta: info, data });
  } catch (e) {
    return gagal("ERROR", pesanRamah(e));
  }
}

export async function GET() {
  /* Berguna untuk memeriksa konfigurasi: memberi tahu variabel mana yang
     belum terbaca, tanpa pernah menampilkan isinya. */
  const sa = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || "";
  const sid = process.env.SHEET_ID || "";
  const gas = process.env.GAS_URL || process.env.NEXT_PUBLIC_GAS_URL || "";

  const isi = (nilai: string) =>
    nilai ? `terisi, ${nilai.length} karakter` : "KOSONG";

  return balas({
    ok: true,
    data: {
      service: "Finansial API",
      backend: adaKredensial() ? "vercel" : "apps-script",
      petunjuk: "Kirim permintaan dengan metode POST.",
      pemeriksaan: {
        SHEET_ID: isi(sid),
        GOOGLE_SERVICE_ACCOUNT_JSON: isi(sa),
        GOOGLE_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ? "terisi" : "KOSONG",
        GAS_URL: gas ? "terisi" : "KOSONG",
        TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN ? "terisi" : "KOSONG",
        TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID ? "terisi" : "KOSONG",
        ujiBacaSheets: await ujiSheets(),
      },
    },
  });
}
