export const NAMA_BULAN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const NAMA_BULAN_PENDEK = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export const NAMA_HARI = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const NAMA_HARI_PENDEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** 1234567 -> "Rp 1.234.567" */
export function rp(n: number | string | null | undefined, opsi?: { tanpaRp?: boolean }): string {
  const angka = Math.round(Number(n) || 0);
  const negatif = angka < 0;
  const s = String(Math.abs(angka));
  let out = "";
  for (let i = s.length; i > 3; i -= 3) {
    out = "." + s.slice(i - 3, i) + out;
  }
  out = s.slice(0, ((s.length - 1) % 3) + 1) + out;
  const prefix = opsi?.tanpaRp ? "" : "Rp ";
  return (negatif ? "-" : "") + prefix + out;
}

/** 1234567 -> "1.2M" — for chart axes and tight spaces */
export function rpSingkat(n: number | null | undefined): string {
  const v = Number(n) || 0;
  const abs = Math.abs(v);
  const tanda = v < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return tanda + (abs / 1_000_000_000).toFixed(abs >= 10_000_000_000 ? 0 : 1) + "B";
  if (abs >= 1_000_000) return tanda + (abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1) + "M";
  if (abs >= 1_000) return tanda + Math.round(abs / 1_000) + "K";
  return tanda + String(Math.round(abs));
}

export function angkaPolos(n: number | null | undefined): string {
  return new Intl.NumberFormat("id-ID").format(Math.round(Number(n) || 0));
}

/** "1.234.567" | "1234567" | "Rp 1.234.567" -> 1234567 */
export function parseAngka(s: string | number | null | undefined): number {
  if (typeof s === "number") return isFinite(s) ? s : 0;
  if (!s) return 0;
  const bersih = String(s).replace(/[^\d,-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = parseFloat(bersih);
  return isFinite(n) ? n : 0;
}

export function labelBulan(bulan: string): string {
  if (!bulan) return "";
  const [y, m] = bulan.split("-");
  const idx = parseInt(m, 10) - 1;
  return `${NAMA_BULAN_PENDEK[idx] || m} ${y}`;
}

export function labelBulanPanjang(bulan: string): string {
  if (!bulan) return "";
  const [y, m] = bulan.split("-");
  const idx = parseInt(m, 10) - 1;
  return `${NAMA_BULAN[idx] || m} ${y}`;
}

export function bulanSekarang(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function geserBulan(bulan: string, delta: number): string {
  const [y, m] = bulan.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function tanggalHariIni(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function labelTanggal(tanggal: string, opsi?: { denganHari?: boolean }): string {
  if (!tanggal) return "";
  const [y, m, d] = tanggal.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const inti = `${d} ${NAMA_BULAN_PENDEK[m - 1]} ${y}`;
  return opsi?.denganHari ? `${NAMA_HARI_PENDEK[dt.getDay()]}, ${inti}` : inti;
}

export function labelTanggalRelatif(tanggal: string): string {
  const hariIni = tanggalHariIni();
  if (tanggal === hariIni) return "Today";
  const [y, m, d] = hariIni.split("-").map(Number);
  const kemarin = new Date(y, m - 1, d - 1);
  const kemarinStr = `${kemarin.getFullYear()}-${String(kemarin.getMonth() + 1).padStart(2, "0")}-${String(kemarin.getDate()).padStart(2, "0")}`;
  if (tanggal === kemarinStr) return "Yesterday";
  return labelTanggal(tanggal);
}

export const LEVEL_LABEL: Record<string, string> = {
  aman: "Safe",
  warning: "Warning",
  kritis: "Critical",
  over: "Over",
};

export const LEVEL_WARNA: Record<string, string> = {
  aman: "var(--success)",
  warning: "var(--warning)",
  kritis: "var(--kritis)",
  over: "var(--danger)",
};

export const JENIS_DOMPET_LABEL: Record<string, string> = {
  tunai: "Cash",
  bank: "Bank",
  ewallet: "E-Wallet",
  piutang: "Receivable",
  hutang: "Payable",
  investasi: "Investment",
  lainnya: "Other",
};

export function inisial(nama: string): string {
  const bagian = String(nama || "?").trim().split(/\s+/).filter(Boolean);
  if (!bagian.length) return "?";
  if (bagian.length === 1) return bagian[0].slice(0, 2).toUpperCase();
  return (bagian[0][0] + bagian[bagian.length - 1][0]).toUpperCase();
}

/** Bersihkan angka menjadi format ribuan saat mengetik: "1234567" -> "1.234.567" */
export function formatSaatKetik(teks: string): string {
  const n = parseAngka(teks);
  if (!teks) return "";
  return n ? angkaPolos(n) : "";
}

export function persen(n: number | null | undefined, desimal = 1): string {
  const v = Number(n) || 0;
  return `${v.toFixed(desimal)}%`;
}
