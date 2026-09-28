export type Tipe = "Pemasukan" | "Pengeluaran" | "Transfer";
export type Level = "aman" | "warning" | "kritis" | "over";
export type JenisDompet =
  | "tunai"
  | "bank"
  | "ewallet"
  | "piutang"
  | "hutang"
  | "investasi"
  | "lainnya";

export interface User {
  email: string;
  nama: string;
  peran: "admin" | "lihat";
  status: string;
  last_login?: string;
  created_at?: string;
}

export interface Wallet {
  id: string;
  nama: string;
  jenis: JenisDompet;
  saldo_awal: number;
  urutan: number;
  aktif: number;
  catatan?: string;
}

export interface Category {
  id: string;
  nama: string;
  tipe: "Pemasukan" | "Pengeluaran";
  warna: string;
  ikon: string;
  sistem: number;
  urutan: number;
  aktif: number;
}

export interface Tx {
  id: string;
  tanggal: string;
  tipe: Tipe;
  wallet_id: string;
  wallet_tujuan_id: string;
  category_id: string;
  jumlah: number;
  biaya_admin: number;
  catatan: string;
  created_by?: string;
  wallet?: string;
  walletTujuan?: string;
  kategori?: string;
  warna?: string;
}

export interface BudgetItem {
  categoryId: string;
  nama: string;
  warna: string;
  batas: number;
  terpakai: number;
  sisa: number;
  persen: number;
  level: Level;
}

export interface BudgetTotal {
  batas: number;
  terpakai: number;
  sisa: number;
  persen: number;
  level: Level;
}

export interface BudgetStatus {
  bulan: string;
  items: BudgetItem[];
  total: BudgetTotal | null;
  jumlahPerhatian?: number;
}

export interface SaldoDompet {
  id: string;
  nama: string;
  jenis: JenisDompet;
  saldo: number;
}

export interface TrenPoint {
  bulan: string;
  label: string;
  masuk: number;
  keluar: number;
  selisih: number;
}

export interface KategoriJumlah {
  id: string;
  nama: string;
  warna: string;
  jumlah: number;
  tipe?: "Pemasukan" | "Pengeluaran";
}

export interface Bootstrap {
  user: User;
  wallets: Wallet[];
  categories: Category[];
  telegram: { configured: boolean; bot: string | null; chatId: string | null };
  today: string;
  bulanIni: string;
}

export interface DashboardData {
  bulan: string;
  totalSaldo: number;
  saldoDompet: SaldoDompet[];
  ringkasan: {
    masuk: number;
    keluar: number;
    biayaAdmin: number;
    selisih: number;
  };
  budgets: BudgetStatus;
  tren: TrenPoint[];
  perKategori: KategoriJumlah[];
  transaksiTerakhir: Tx[];
  hutangPiutang: { id: string; nama: string; jenis: JenisDompet; saldo: number }[];
}

export interface ReportData {
  from: string;
  to: string;
  bulan: string;
  ringkasan: {
    masuk: number;
    keluar: number;
    biayaAdmin: number;
    selisih: number;
    jumlahTransaksi: number;
    rataHarian: number;
  };
  pembanding: {
    bulan: string;
    masuk: number;
    keluar: number;
    selisihMasuk: number;
    selisihKeluar: number;
  };
  perKategori: KategoriJumlah[];
  perDompet: { id: string; nama: string; jenis: JenisDompet; jumlah: number }[];
  harian: { tanggal: string; masuk: number; keluar: number }[];
  tren: TrenPoint[];
}
