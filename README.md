# Finansial — Catatan Keuangan Keluarga

Aplikasi pencatatan keuangan untuk dipakai berdua. Data tersimpan di **Google
Sheets** milikmu sendiri, diakses lewat **Google Apps Script**, dan tampilannya
di-hosting di **Vercel**.

Tidak ada kata sandi yang disimpan. Masuk memakai **akun Google**, dan hanya
email yang kamu daftarkan yang bisa membuka aplikasi.

---

## Fitur

| Halaman | Isi |
|---|---|
| **Dashboard** | Sisa budget, pengeluaran, pemasukan, total saldo, tren 6 bulan, donut kategori, progress budget, saldo dompet, transaksi terakhir |
| **Transaksi** | Catat pemasukan / pengeluaran / transfer antar dompet (dengan biaya admin), filter tanggal, tipe, dompet, kategori, pencarian, ubah & hapus |
| **Dompet** | Tunai, bank, e-wallet, piutang, hutang. Saldo dihitung otomatis dari saldo awal |
| **Budget** | Batas total bulanan dan per kategori, tombol salin dari bulan lalu, progress berwarna |
| **Hutang & Piutang** | Catat uang yang dipinjamkan dan yang dipinjam, terima pembayaran, lunasi |
| **Laporan** | Ringkasan periode, perbandingan bulan lalu, tren 12 bulan, per kategori, per dompet, aktivitas harian, export CSV |
| **Pengaturan** | Profil, pengguna, kategori, notifikasi Telegram, tema, data |

### Tingkat peringatan budget

| Tingkat | Ambang |
|---|---|
| Aman | di bawah 70% |
| Warning | 70% ke atas |
| Kritis | 90% ke atas |
| Over | 100% ke atas |

Setiap kali sebuah pos budget **naik tingkat**, pesan otomatis dikirim ke
Telegram. Tidak ada jadwal jam kirim — pesan hanya muncul saat memang ada yang
perlu diketahui.

---

## Struktur

```
finansial/
├── app/
│   ├── (app)/                  → halaman yang butuh masuk
│   │   ├── layout.tsx          → gerbang login + kerangka sidebar
│   │   ├── page.tsx            → Dashboard
│   │   ├── transaksi/page.tsx
│   │   ├── dompet/page.tsx
│   │   ├── budget/page.tsx
│   │   ├── hutang/page.tsx
│   │   ├── laporan/page.tsx
│   │   └── pengaturan/page.tsx
│   ├── globals.css             → sistem desain (warna, kartu, tombol, tabel)
│   ├── layout.tsx
│   └── providers.tsx
├── components/
│   ├── AppShell.tsx            → sidebar + hamburger + catat cepat
│   ├── TxForm.tsx              → form transaksi
│   ├── auth.tsx                → login Google & gerbang
│   ├── charts.tsx              → grafik (Recharts)
│   ├── toast.tsx               → notifikasi dalam aplikasi
│   └── ui.tsx                  → komponen dasar
├── lib/
│   ├── api.ts                  → klien Apps Script + penyimpanan sesi
│   ├── hooks.ts                → useApi + penyegaran antar halaman
│   ├── format.ts               → format rupiah, tanggal, bulan
│   └── types.ts
├── gas/Code.gs                 → backend, salin ke editor Apps Script
└── .env.local.example
```

---

## Cara Pasang

### Bagian 1 — Google Sheets dan Apps Script

1. Buat Google Sheet baru di <https://sheets.new>. Beri nama, misalnya
   `Finansial DB`.
2. Menu **Ekstensi → Apps Script**.
3. Klik ikon gerigi **Project Settings**, centang **Show "appsscript.json"
   manifest file in editor**. Kembali ke **Editor**, buka `appsscript.json`,
   lalu ganti seluruh isinya dengan isi `gas/appsscript.json`. Simpan.

   Ini penting. Berkas itu menyatakan izin yang dibutuhkan aplikasi. Tanpa itu,
   login akan gagal dengan pesan *"Anda tidak memiliki izin untuk memanggil
   UrlFetchApp.fetch"*.

4. Buka `Code.gs`, hapus semua kode di dalamnya, lalu tempel **seluruh isi**
   `gas/Code.gs`. Simpan dengan `Ctrl+S`.

5. Di dropdown fungsi, pilih **`izinkanSemua`**, klik **Run**.
   - Pilih akunmu di layar izin
   - Kalau muncul **"Google hasn't verified this app"**, klik **Advanced** →
     **Go to … (unsafe)** → **Allow**

   Fungsi ini membuat semua sheet, mengisi kategori awal, mendaftarkan emailmu
   sebagai admin, dan meminta izin akses internet.

6. **(Opsional, untuk notifikasi Telegram)** Isi dulu fungsi `setTelegram` di
   bagian atas file dengan token dan chat ID, lalu jalankan sekali. Setelah itu
   nilai di dalam kode boleh dikosongkan lagi — nilainya tersimpan di Script
   Properties.

   Cara mendapatkan token dan chat ID ada di bagian **Notifikasi Telegram** di
   bawah.

7. **(Opsional, disarankan)** Di **Project Settings → Script properties**,
   tambahkan `GOOGLE_CLIENT_ID` berisi Client ID Google-mu. Dengan itu backend
   hanya menerima token login yang memang diterbitkan untuk aplikasimu.

8. **Deploy → New deployment → Web app**
   - Description: terserah
   - **Execute as: Me**
   - **Who has access: Anyone**

9. Salin **URL Web app** yang diakhiri `/exec`. Ini yang nanti jadi
   `NEXT_PUBLIC_GAS_URL`.

> **Tes cepat:** buka URL `/exec` di browser. Harus muncul tulisan
> *"Finansial API aktif."*

> **Penting:** setiap kali `gas/Code.gs` berubah, lakukan
> **Deploy → Manage deployments → Edit → Version: New version → Deploy**.
> Kalau tidak, Apps Script masih menjalankan kode lama.

### Bagian 2 — Client ID Google (untuk login)

1. Buka <https://console.cloud.google.com/> dan buat project baru.
2. Menu **APIs & Services → OAuth consent screen**. Pilih **External**, isi nama
   aplikasi dan email, lalu simpan. Tambahkan emailmu dan email pasangan di
   bagian **Test users** kalau statusnya masih Testing.
3. Menu **APIs & Services → Credentials → Create credentials → OAuth client ID**.
4. Application type: **Web application**.
5. Di **Authorized JavaScript origins**, tambahkan:
   - `http://localhost:3000`
   - `https://nama-proyek.vercel.app` (domain Vercel-mu nanti)
6. Klik Create, lalu salin **Client ID**. Ini yang jadi
   `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.

### Bagian 3 — Jalankan di komputer

```bash
cp .env.local.example .env.local
```

Isi `.env.local`:

```
NEXT_PUBLIC_GAS_URL=https://script.google.com/macros/s/XXXX/exec
NEXT_PUBLIC_GOOGLE_CLIENT_ID=XXXX.apps.googleusercontent.com
```

Lalu:

```bash
npm install
npm run dev
```

Buka <http://localhost:3000>.

### Bagian 4 — Deploy ke Vercel

1. Push repo ini ke GitHub.
2. Buka <https://vercel.com/new>, import repo-nya.
3. Di **Environment Variables**, tambahkan:
   - `NEXT_PUBLIC_GAS_URL`
   - `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
4. Deploy.
5. Setelah dapat domain Vercel, **kembali ke Google Cloud Console** dan tambahkan
   domain itu ke **Authorized JavaScript origins**. Tanpa ini, tombol masuk
   Google akan ditolak.

---

## Notifikasi Telegram

1. Buka Telegram, cari **@BotFather**.
2. Kirim `/newbot`, ikuti perintahnya. Simpan **token** yang diberikan.
3. Buat channel atau grup, lalu **tambahkan bot** sebagai anggota dan jadikan
   **admin**. Bot tidak bisa mengirim pesan ke channel tanpa jadi admin.
4. Ambil **chat ID**:
   - Kirim pesan apa saja di channel,
   - buka `https://api.telegram.org/bot<TOKEN>/getUpdates`,
   - cari nilai `chat.id`, biasanya diawali `-100`.
5. Di editor Apps Script, buka **Project Settings → Script properties**, lalu
   tambahkan:
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_CHAT_ID`

   **Jangan** menulis token di dalam kode, dan jangan pernah commit ke GitHub.
6. Jalankan `setTelegram` dari editor, atau langsung uji lewat tombol
   **Kirim pesan uji** di halaman **Pengaturan → Notifikasi**.

---

## Keamanan

- **Tidak ada kata sandi** yang disimpan, di-hash, atau dikirim ke mana pun.
  Login sepenuhnya ditangani Google.
- Setiap permintaan ke backend membawa **ID token** dari Google. Apps Script
  memverifikasi token itu ke server Google sebelum memproses apa pun.
- Email yang **tidak terdaftar** di sheet `Users` ditolak, walaupun dia berhasil
  login ke Google.
- Tidak ada pendaftaran sendiri. Hanya admin yang bisa menambah pengguna.
- Token Telegram disimpan di **Script Properties**, bukan di dalam kode.

---

## Catatan

- Panggilan pertama ke Apps Script bisa terasa lambat (server baru bangun).
  Panggilan berikutnya normal.
- Aplikasi memakai nomor baris asli spreadsheet. **Jangan menyisipkan atau
  menghapus baris secara manual** saat aplikasi sedang dipakai.
- Kuota gratis Apps Script sangat cukup untuk pemakaian pribadi maupun
  sekeluarga.
