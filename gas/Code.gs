/**
 * ============================================================================
 *  FINANSIAL — Backend Google Apps Script
 *  Database: Google Sheets  |  Frontend: Next.js di Vercel
 * ============================================================================
 *
 *  CARA PASANG (sekali saja):
 *   1. Buat Google Sheet baru di https://sheets.new
 *   2. Menu: Ekstensi -> Apps Script
 *   3. Hapus semua kode di editor, tempel SELURUH isi file ini
 *   4. Simpan (Ctrl+S)
 *   5. Jalankan fungsi `setup` sekali (pilih di dropdown -> Run -> izinkan akses)
 *   6. Isi token Telegram (opsional): jalankan fungsi `setTelegram`
 *   7. Deploy -> New deployment -> Web app
 *        Execute as : Me
 *        Who has access : Anyone
 *      Salin URL yang diakhiri /exec
 *
 *  CATATAN KEAMANAN:
 *   - Token bot Telegram TIDAK disimpan di kode ini, melainkan di
 *     Script Properties (Project Settings -> Script properties).
 *   - Jangan pernah menaruh token di GitHub.
 * ============================================================================
 */

/* ================================ KONFIGURASI ============================== */

var TZ = 'Asia/Jakarta';

var SH = {
  USERS: 'Users',
  WALLETS: 'Dompet',
  CATS: 'Kategori',
  TX: 'Transaksi',
  BUDGET: 'Budget',
  NOTIF: 'Notifikasi'
};

var HEADERS = {
  Users: ['email', 'nama', 'peran', 'status', 'created_at', 'last_login'],
  Dompet: ['id', 'nama', 'jenis', 'saldo_awal', 'urutan', 'aktif', 'catatan', 'created_at'],
  Kategori: ['id', 'nama', 'tipe', 'warna', 'ikon', 'sistem', 'urutan', 'aktif'],
  Transaksi: ['id', 'tanggal', 'tipe', 'wallet_id', 'wallet_tujuan_id', 'category_id',
              'jumlah', 'biaya_admin', 'catatan', 'created_by', 'created_at', 'updated_at'],
  Budget: ['id', 'bulan', 'category_id', 'jumlah', 'updated_at'],
  Notifikasi: ['bulan', 'category_id', 'level', 'sent_at']
};

/** id kategori sistem untuk biaya admin transfer (tidak pernah dipakai transaksi) */
var KAT_BIAYA_ADMIN = 'biaya_admin';

/** id kategori sistem untuk budget total bulanan */
var KAT_TOTAL = 'TOTAL';

var BATAS_WARNING = 70;
var BATAS_KRITIS = 90;
var BATAS_OVER = 100;

var RANK_LEVEL = { aman: 0, warning: 1, kritis: 2, over: 3 };
var IKON_LEVEL = { warning: '\u26A0\uFE0F', kritis: '\uD83D\uDFE0', over: '\uD83D\uDD34' };
var LABEL_LEVEL = { aman: 'Safe', warning: 'Warning', kritis: 'Critical', over: 'Over' };

var KATEGORI_AWAL = [
  // Income
  { id: 'gaji',         nama: 'Salary',        tipe: 'Pemasukan',   warna: '#10b981', ikon: 'Wallet' },
  { id: 'thr',          nama: 'THR',           tipe: 'Pemasukan',   warna: '#22c55e', ikon: 'Gift' },
  { id: 'bonus',        nama: 'Bonus',         tipe: 'Pemasukan',   warna: '#34d399', ikon: 'TrendingUp' },
  { id: 'lain_masuk',   nama: 'Other',         tipe: 'Pemasukan',   warna: '#6ee7b7', ikon: 'Plus' },
  // Expense
  { id: 'makan',        nama: 'Food',          tipe: 'Pengeluaran', warna: '#f97316', ikon: 'UtensilsCrossed' },
  { id: 'transportasi', nama: 'Transport',     tipe: 'Pengeluaran', warna: '#3b82f6', ikon: 'Car' },
  { id: 'tagihan',      nama: 'Bills',         tipe: 'Pengeluaran', warna: '#8b5cf6', ikon: 'Receipt' },
  { id: 'hiburan',      nama: 'Entertainment', tipe: 'Pengeluaran', warna: '#ec4899', ikon: 'Gamepad2' },
  { id: 'pendidikan',   nama: 'Education',     tipe: 'Pengeluaran', warna: '#06b6d4', ikon: 'GraduationCap' },
  { id: 'orang_tua',    nama: 'Parents',       tipe: 'Pengeluaran', warna: '#a855f7', ikon: 'Heart' },
  { id: 'belanja',      nama: 'Shopping',      tipe: 'Pengeluaran', warna: '#eab308', ikon: 'ShoppingCart' },
  { id: 'kesehatan',    nama: 'Health',        tipe: 'Pengeluaran', warna: '#ef4444', ikon: 'Stethoscope' },
  { id: 'lainnya',      nama: 'Other',         tipe: 'Pengeluaran', warna: '#64748b', ikon: 'MoreHorizontal' },
  // System — admin fees on transfers, never shown in the expense picker
  { id: KAT_BIAYA_ADMIN, nama: 'Admin Fee',    tipe: 'Pengeluaran', warna: '#94a3b8', ikon: 'Landmark', sistem: 1 }
];

var DOMPET_AWAL = [
  { id: 'tunai', nama: 'Tunai', jenis: 'tunai' }
];

/* ================================ ENTRY POINT ============================== */

function doGet() {
  return ContentService
    .createTextOutput('Finansial API aktif. Kirim permintaan dengan metode POST.')
    .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var action = String(body.action || '');
    var payload = body.payload || {};

    if (action === 'ping') {
      return json_({ ok: true, data: { pong: true, time: nowIso_() } });
    }

    var who = verifyToken_(body.token || payload.token || '');
    if (!who) {
      return json_({ ok: false, error: 'UNAUTHORIZED', message: 'Session is invalid or expired. Please sign in again.' });
    }

    var user = findUser_(who.email);
    if (!user) {
      return json_({
        ok: false,
        error: 'FORBIDDEN',
        message: 'Email ' + who.email + ' is not registered. Ask the admin to add this email in Settings.'
      });
    }
    if (String(user.status || '').toLowerCase() !== 'aktif') {
      return json_({ ok: false, error: 'FORBIDDEN', message: 'This account is inactive.' });
    }

    touchLogin_(user, who);

    var data = route_(action, payload, user, who);
    return json_({ ok: true, data: data });
  } catch (err) {
    return json_({
      ok: false,
      error: 'ERROR',
      message: String(err && err.message ? err.message : err)
    });
  }
}

function route_(action, p, user, who) {
  switch (action) {
    /* ---- data dasar ---- */
    case 'bootstrap':       return bootstrap_(user);
    case 'dashboard':       return dashboard_(p);
    /* ---- transaksi ---- */
    case 'tx.list':         return txList_(p);
    case 'tx.save':         return txSave_(p, user);
    case 'tx.delete':       return txDelete_(p);
    /* ---- dompet ---- */
    case 'wallet.list':     return walletList_();
    case 'wallet.save':     return walletSave_(p);
    case 'wallet.archive':  return walletArchive_(p);     case 'wallet.delete':   return walletDelete_(p);
    /* ---- kategori ---- */
    case 'category.save':   return categorySave_(p);
    case 'category.delete': return categoryDelete_(p);
    /* ---- budget ---- */
    case 'budget.page':     return budgetPage_(p);
    case 'budget.saveAll':  return budgetSaveAll_(p);
    case 'budget.copy':     return budgetCopy_(p);
    /* ---- laporan ---- */
    case 'report':          return report_(p);
    /* ---- pengguna ---- */
    case 'users.list':      return { users: readAll_(SH.USERS).map(publicUser_) };
    case 'users.save':      return usersSave_(p, user);
    case 'users.delete':    return usersDelete_(p, user);
    /* ---- notifikasi ---- */
    case 'telegram.status': return telegramStatus_();
    case 'telegram.test':   return { sent: telegram_('\u2705 <b>Finansial</b>\nNotifikasi Telegram berhasil disambungkan.') };
    default:
      throw new Error('Unknown action: ' + action);
  }
}

/* ================================ SETUP =================================== */

/** Jalankan sekali dari editor Apps Script. */
function setup() {
  var diperbaiki = [];

  Object.keys(HEADERS).forEach(function (name) {
    var sh = sheet_(name);
    if (perbaikiHeader_(name, sh)) diperbaiki.push(name);
  });

  seedKategori_();
  seedDompet_();

  var email = String(Session.getEffectiveUser().getEmail() || '').toLowerCase();
  if (email) upsertUser_({ email: email, nama: '', peran: 'admin', status: 'aktif' });

  var pesan = 'Setup complete. Owner: ' + email;
  if (diperbaiki.length) {
    pesan += ' | Headers repaired: ' + diperbaiki.join(', ');
  }
  return pesan;
}

/**
 * Pastikan baris pertama sheet sama persis dengan HEADERS.
 *
 * Kalau sheet ini pernah dipakai proyek lain, header lamanya bisa berbeda.
 * Akibatnya data ditulis dengan urutan yang benar tetapi dibaca memakai nama
 * kolom yang salah — transaksinya ada di sheet, tapi tidak muncul di aplikasi.
 */
function perbaikiHeader_(name, sh) {
  var head = HEADERS[name];
  if (!head) return false;

  var sekarang = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1))
    .getValues()[0]
    .map(function (h) { return String(h); });

  if (sekarang.slice(0, head.length).join('|') === head.join('|')) return false;

  sh.getRange(1, 1, 1, head.length).setValues([head]);
  sh.setFrozenRows(1);
  bersihkanCache_();
  return true;
}

/**
 * Alat diagnosis. Jalankan dari editor Apps Script kalau ada data yang sudah
 * masuk ke sheet tetapi tidak muncul di aplikasi.
 *
 * Hasilnya muncul di panel Execution log, dan juga dikembalikan sebagai teks.
 */
function cekStruktur() {
  var baris = [];
  var ss = ss_();

  baris.push('===== SPREADSHEET =====');
  baris.push('Nama : ' + ss.getName());
  baris.push('ID   : ' + ss.getId());
  baris.push('');

  baris.push('===== STRUKTUR SHEET =====');
  Object.keys(HEADERS).forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (!sh) {
      baris.push(name + ' : SHEET TIDAK ADA');
      return;
    }
    var head = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1))
      .getValues()[0]
      .map(function (h) { return String(h); });

    var cocok = head.slice(0, HEADERS[name].length).join('|') === HEADERS[name].join('|');
    baris.push(name + ' : ' + Math.max(sh.getLastRow() - 1, 0) + ' baris data, ' +
               sh.getLastColumn() + ' kolom');
    baris.push('   header sekarang : ' + head.join(' | '));
    baris.push('   header seharusnya: ' + HEADERS[name].join(' | '));
    baris.push('   COCOK : ' + (cocok ? 'YA' : '>>> TIDAK <<<'));
    baris.push('');
  });

  baris.push('===== 3 BARIS TERAKHIR TRANSAKSI =====');
  var tx = ss.getSheetByName(SH.TX);
  if (tx && tx.getLastRow() > 1) {
    var akhir = tx.getLastRow();
    var mulai = Math.max(2, akhir - 2);
    var nilai = tx.getRange(mulai, 1, akhir - mulai + 1, tx.getLastColumn()).getValues();

    nilai.forEach(function (r, idx) {
      var tgl = r[1];
      var jenis = Object.prototype.toString.call(tgl) === '[object Date]' ? 'DATE' : typeof tgl;
      baris.push('Baris ' + (mulai + idx) + ' [' + jenis + ']: ' +
        r.map(function (v) {
          return Object.prototype.toString.call(v) === '[object Date]'
            ? 'DATE(' + Utilities.formatDate(v, TZ, 'yyyy-MM-dd') + ')'
            : String(v);
        }).join(' | '));
    });

    baris.push('');
    baris.push('Nilai tanggal baris terakhir : ' +
      (Object.prototype.toString.call(tx.getRange(akhir, 2).getValue()) === '[object Date]'
        ? 'objek Date (inilah penyebabnya)'
        : 'teks biasa (aman)'));
  } else {
    baris.push('(belum ada transaksi)');
  }

  var teks = baris.join('\n');
  Logger.log(teks);
  return teks;
}

/**
 * Isi token bot Telegram & chat id.
 * Ganti dua nilai di bawah, lalu jalankan fungsi ini SEKALI.
 * Setelah itu nilai boleh dikosongkan lagi.
 */
function setTelegram() {
  var BOT_TOKEN = '';   // contoh: 123456789:AA....
  var CHAT_ID   = '';   // contoh: -1001234567890
  var props = PropertiesService.getScriptProperties();
  if (BOT_TOKEN) props.setProperty('TELEGRAM_BOT_TOKEN', BOT_TOKEN.trim());
  if (CHAT_ID) props.setProperty('TELEGRAM_CHAT_ID', CHAT_ID.trim());
  return telegramStatus_();
}

function telegramStatus_() {
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty('TELEGRAM_BOT_TOKEN');
  var chat = props.getProperty('TELEGRAM_CHAT_ID');
  return {
    configured: !!(token && chat),
    bot: token ? token.split(':')[0] + ':***' : null,
    chatId: chat || null
  };
}

/**
 * Jalankan SEKALI dari editor Apps Script untuk meminta SELURUH izin yang
 * dibutuhkan aplikasi — termasuk akses internet.
 *
 * Izin internet (script.external_request) dipakai untuk dua hal:
 *   1. memverifikasi token login Google setiap kali ada permintaan masuk
 *   2. mengirim notifikasi ke Telegram
 *
 * Kalau muncul peringatan "Google hasn't verified this app":
 *   klik Advanced -> Go to <nama project> (unsafe) -> Allow
 */
function izinkanSemua() {
  // membuat sheet, kategori awal, dan mendaftarkan pemilik
  setup();

  // sengaja memanggil UrlFetchApp supaya izin akses internet ikut diminta
  UrlFetchApp.fetch(
    'https://oauth2.googleapis.com/tokeninfo?id_token=percobaan',
    { muteHttpExceptions: true }
  );

  return 'Permissions granted. Next: Deploy -> Manage deployments -> Edit -> ' +
         'Version: New version -> Deploy.';
}

/* ============================== VERIFIKASI TOKEN ========================== */

/**
 * Memverifikasi ID token Google lewat endpoint tokeninfo,
 * lalu menyimpannya di cache agar tidak memanggil Google tiap request.
 */
function verifyToken_(idToken) {
  if (!idToken) return null;

  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, idToken);
  var key = 'tok_' + Utilities.base64EncodeWebSafe(digest).slice(0, 48);

  var cache = CacheService.getScriptCache();
  var hit = cache.get(key);
  if (hit) {
    try { return JSON.parse(hit); } catch (e) { /* lanjut verifikasi */ }
  }

  var res = UrlFetchApp.fetch(
    'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken),
    { muteHttpExceptions: true }
  );
  if (res.getResponseCode() !== 200) return null;

  var p = JSON.parse(res.getContentText());
  if (!p.email) return null;
  if (String(p.email_verified) !== 'true') return null;

  var expectedAud = PropertiesService.getScriptProperties().getProperty('GOOGLE_CLIENT_ID');
  if (expectedAud && p.aud !== expectedAud) return null;

  var who = {
    email: String(p.email).toLowerCase(),
    nama: p.name || '',
    picture: p.picture || ''
  };

  // token Google berlaku 1 jam; cache 25 menit supaya aman
  cache.put(key, JSON.stringify(who), 1500);
  return who;
}

function findUser_(email) {
  var target = String(email || '').toLowerCase();
  var users = readAll_(SH.USERS);
  for (var i = 0; i < users.length; i++) {
    if (String(users[i].email || '').toLowerCase() === target) return users[i];
  }
  return null;
}

function touchLogin_(user, who) {
  var cache = CacheService.getScriptCache();
  var k = 'login_' + user.email;
  if (cache.get(k)) return;
  cache.put(k, '1', 600);
  try {
    var patch = { last_login: nowIso_() };
    if (!user.nama && who && who.nama) patch.nama = who.nama;
    updateByKey_(SH.USERS, 'email', user.email, patch);
  } catch (e) { /* tidak fatal */ }
}

function publicUser_(u) {
  return {
    email: u.email,
    nama: u.nama,
    peran: u.peran || 'admin',
    status: u.status || 'aktif',
    last_login: u.last_login || '',
    created_at: u.created_at || ''
  };
}

/* ================================= AKSI: DATA ============================= */

function bootstrap_(user) {
  return {
    user: publicUser_(user),
    wallets: activeWallets_(),
    categories: activeCategories_(),
    telegram: telegramStatus_(),
    today: todayStr_(),
    bulanIni: bulanOf_(todayStr_())
  };
}

function dashboard_(p) {
  var bulan = p && p.bulan ? String(p.bulan) : bulanOf_(todayStr_());
  var wallets = activeWallets_();
  var txs = semuaTx_();

  var saldo = computeBalances_(wallets, txs);
  var totalSaldo = 0;
  wallets.forEach(function (w) { totalSaldo += saldo[w.id] || 0; });

  /* --- ringkasan bulan berjalan --- */
  var masuk = 0, keluar = 0, biayaAdmin = 0;
  txs.forEach(function (t) {
    if (bulanOf_(t.tanggal) !== bulan) return;
    var j = num_(t.jumlah), fee = num_(t.biaya_admin);
    if (t.tipe === 'Pemasukan') masuk += j;
    else if (t.tipe === 'Pengeluaran') keluar += j;
    else if (t.tipe === 'Transfer') biayaAdmin += fee;
  });
  keluar += biayaAdmin;

  /* --- budget bulan berjalan --- */
  var budgets = budgetStatus_(bulan);

  /* --- tren N bulan --- */
  var tren = trendData_(6, bulan);

  /* --- pengeluaran per kategori bulan ini --- */
  var perKategori = kategoriBreakdown_(bulan);

  /* --- transaksi terakhir --- */
  var terakhir = txs.slice().sort(urutTx_).slice(0, 8).map(function (t) {
    return decorateTx_(t);
  });

  /* --- tagihan & hutang: dompet jenis hutang --- */
  var hutang = wallets
    .filter(function (w) { return w.jenis === 'hutang' || w.jenis === 'piutang'; })
    .map(function (w) {
      return { id: w.id, nama: w.nama, jenis: w.jenis, saldo: saldo[w.id] || 0 };
    });

  return {
    bulan: bulan,
    totalSaldo: totalSaldo,
    saldoDompet: wallets.map(function (w) {
      return { id: w.id, nama: w.nama, jenis: w.jenis, saldo: saldo[w.id] || 0 };
    }),
    ringkasan: { masuk: masuk, keluar: keluar, biayaAdmin: biayaAdmin, selisih: masuk - keluar },
    budgets: budgets,
    tren: tren,
    perKategori: perKategori,
    transaksiTerakhir: terakhir,
    hutangPiutang: hutang
  };
}

/* ============================== AKSI: TRANSAKSI =========================== */

function txList_(p) {
  var txs = semuaTx_();
  var from = p.from ? String(p.from) : '';
  var to = p.to ? String(p.to) : '';
  var walletId = p.walletId ? String(p.walletId) : '';
  var categoryId = p.categoryId ? String(p.categoryId) : '';
  var tipe = p.tipe ? String(p.tipe) : '';
  var q = p.q ? String(p.q).toLowerCase() : '';

  var hasil = txs.filter(function (t) {
    var tgl = String(t.tanggal || '');
    if (from && tgl < from) return false;
    if (to && tgl > to) return false;
    if (tipe && t.tipe !== tipe) return false;
    if (walletId && t.wallet_id !== walletId && t.wallet_tujuan_id !== walletId) return false;
    if (categoryId && t.category_id !== categoryId) return false;
    if (q) {
      var hay = (String(t.catatan || '') + ' ' + String(t.category_id || '') + ' ' + String(t.jumlah || '')).toLowerCase();
      if (hay.indexOf(q) === -1) return false;
    }
    return true;
  });

  hasil.sort(urutTx_);

  var total = hasil.length;
  var limit = p.limit ? num_(p.limit) : 300;
  hasil = hasil.slice(0, limit);

  var wallets = readAll_(SH.WALLETS);
  var categories = readAll_(SH.CATS);
  var wMap = {}, cMap = {};
  wallets.forEach(function (w) { wMap[w.id] = w; });
  categories.forEach(function (c) { cMap[c.id] = c; });

  var list = hasil.map(function (t) {
    var d = decorateTx_(t);
    var w = wMap[t.wallet_id];
    var wt = wMap[t.wallet_tujuan_id];
    var c = cMap[t.category_id];
    d.wallet = w ? w.nama : t.wallet_id;
    d.walletTujuan = wt ? wt.nama : '';
    d.kategori = t.tipe === 'Transfer' ? 'Transfer' : (c ? c.nama : t.category_id);
    d.warna = c ? c.warna : '#64748b';
    return d;
  });

  return { items: list, total: total };
}

function txSave_(p, user) {
  var t = p.transaction || p;
  var tipe = String(t.tipe || '');
  if (['Pemasukan', 'Pengeluaran', 'Transfer'].indexOf(tipe) === -1) {
    throw new Error('Invalid transaction type.');
  }

  var jumlah = num_(t.jumlah);
  if (!(jumlah > 0)) throw new Error('Amount must be greater than 0.');

  var fee = tipe === 'Transfer' ? num_(t.biaya_admin) : 0;
  if (fee < 0) fee = 0;

  var walletId = String(t.wallet_id || '');
  if (!walletId) throw new Error('No wallet selected.');
  if (!findWallet_(walletId)) throw new Error('Wallet not found.');

  var walletTujuan = '';
  if (tipe === 'Transfer') {
    walletTujuan = String(t.wallet_tujuan_id || '');
    if (!walletTujuan) throw new Error('No destination wallet selected.');
    if (walletTujuan === walletId) throw new Error('Source and destination must be different.');
    if (!findWallet_(walletTujuan)) throw new Error('Destination wallet not found.');
  }

  var categoryId = String(t.category_id || '');
  if (tipe === 'Pengeluaran' || tipe === 'Pemasukan') {
    if (!categoryId) throw new Error('No category selected.');
    if (!findCategory_(categoryId)) throw new Error('Category not found.');
  } else {
    categoryId = '';
  }

  var tanggal = String(t.tanggal || '') || todayStr_();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) throw new Error('Date must be in YYYY-MM-DD format.');

  var rec = {
    id: t.id ? String(t.id) : uid_(),
    tanggal: tanggal,
    tipe: tipe,
    wallet_id: walletId,
    wallet_tujuan_id: walletTujuan,
    category_id: categoryId,
    jumlah: jumlah,
    biaya_admin: fee,
    catatan: String(t.catatan || ''),
    created_by: user.email,
    created_at: nowIso_(),
    updated_at: nowIso_()
  };

  var existing = t.id ? findRowById_(SH.TX, String(t.id)) : null;
  if (existing) {
    rec.created_at = existing.created_at || rec.created_at;
    rec.created_by = existing.created_by || rec.created_by;
    updateByKey_(SH.TX, 'id', rec.id, rec);
  } else {
    append_(SH.TX, rec);
  }

  /* Notifikasi Telegram bila budget melewati batas */
  var bulan = bulanOf_(tanggal);
  var notif = cekBudgetDanKirim_(bulan);

  return { transaction: rec, notif: notif };
}

function txDelete_(p) {
  var id = String(p.id || '');
  if (!id) throw new Error('Missing transaction ID.');

  var row = findRowById_(SH.TX, id);
  /* sudah tidak ada berarti kemungkinan pengiriman ulang; anggap berhasil */
  if (!row) return { deleted: id, sudahTidakAda: true };

  var bulan = bulanOf_(tanggalStr_(row.tanggal));
  deleteByKey_(SH.TX, 'id', id);
  var notif = cekBudgetDanKirim_(bulan);
  return { deleted: id, notif: notif };
}

function decorateTx_(t) {
  return {
    id: t.id,
    tanggal: String(t.tanggal || ''),
    tipe: t.tipe,
    wallet_id: t.wallet_id,
    wallet_tujuan_id: t.wallet_tujuan_id || '',
    category_id: t.category_id || '',
    jumlah: num_(t.jumlah),
    biaya_admin: num_(t.biaya_admin),
    catatan: t.catatan || '',
    created_by: t.created_by || ''
  };
}

function urutTx_(a, b) {
  var ta = String(a.tanggal || ''), tb = String(b.tanggal || '');
  if (ta !== tb) return ta < tb ? 1 : -1;
  var ca = String(a.created_at || ''), cb = String(b.created_at || '');
  if (ca !== cb) return ca < cb ? 1 : -1;
  return 0;
}

/* =============================== AKSI: DOMPET ============================= */

function walletList_() {
  var wallets = readAll_(SH.WALLETS)
    .map(normalizeWallet_)
    .sort(function (a, b) { return (a.urutan || 0) - (b.urutan || 0); });

  var txs = semuaTx_();
  var saldo = computeBalances_(wallets, txs);

  var hitung = {};
  txs.forEach(function (t) {
    hitung[t.wallet_id] = (hitung[t.wallet_id] || 0) + 1;
    if (t.wallet_tujuan_id) hitung[t.wallet_tujuan_id] = (hitung[t.wallet_tujuan_id] || 0) + 1;
  });

  return {
    wallets: wallets.map(function (w) {
      var o = {};
      for (var k in w) {
        if (Object.prototype.hasOwnProperty.call(w, k)) o[k] = w[k];
      }
      o.saldo = saldo[w.id] || 0;
      o.jmlTransaksi = hitung[w.id] || 0;
      return o;
    })
  };
}

function walletSave_(p) {
  var w = p.wallet || p;
  var nama = String(w.nama || '').trim();
  if (!nama) throw new Error('Wallet name is required.');

  var jenis = String(w.jenis || 'tunai');
  if (['tunai', 'bank', 'ewallet', 'piutang', 'hutang', 'investasi', 'lainnya'].indexOf(jenis) === -1) {
    jenis = 'lainnya';
  }

  var rec = {
    id: w.id ? String(w.id) : uid_(),
    nama: nama,
    jenis: jenis,
    saldo_awal: num_(w.saldo_awal),
    urutan: w.urutan !== undefined ? num_(w.urutan) : readAll_(SH.WALLETS).length + 1,
    aktif: 1,
    catatan: String(w.catatan || ''),
    created_at: nowIso_()
  };

  var existing = w.id ? findRowById_(SH.WALLETS, rec.id) : null;
  if (existing) {
    rec.created_at = existing.created_at || rec.created_at;
    rec.aktif = existing.aktif === '' || existing.aktif === undefined ? 1 : existing.aktif;
    updateByKey_(SH.WALLETS, 'id', rec.id, rec);
  } else {
    append_(SH.WALLETS, rec);
  }
  return { wallet: rec };
}

function walletArchive_(p) {
  var id = String(p.id || '');
  if (!id) throw new Error('Missing wallet ID.');
  var w = findWallet_(id);
  if (!w) throw new Error('Wallet not found.');

  var aktif = num_(p.aktif) ? 1 : 0;
  if (!aktif) {
    var txs = semuaTx_();
    var saldo = computeBalances_([w], txs)[w.id] || 0;
    if (Math.abs(saldo) > 0.5 && !p.paksa) {
      throw new Error('This wallet still holds ' + formatRp_(saldo) +
        '. Transfer it out first, or archive anyway.');
    }
  }
  updateByKey_(SH.WALLETS, 'id', id, { aktif: aktif });
  return { id: id, aktif: aktif };
}

/**
 * Hapus dompet secara permanen.
 *
 * Kalau dompet itu masih dipakai transaksi, semua transaksi tersebut ikut
 * dihapus. Ini perlu supaya tidak ada transaksi yang menunjuk dompet yang
 * sudah tidak ada — kalau itu terjadi, saldo dan laporan jadi salah tanpa
 * pesan error apa pun.
 *
 * Tanpa paksa, dompet yang masih dipakai ditolak supaya tidak terhapus
 * karena salah pencet.
 */
function walletDelete_(p) {
  var id = String(p.id || '');
  if (!id) throw new Error('Missing wallet ID.');

  var w = findWallet_(id);
  /* sudah tidak ada berarti kemungkinan pengiriman ulang; anggap berhasil */
  if (!w) return { deleted: id, sudahTidakAda: true };

  var terkait = semuaTx_().filter(function (t) {
    return String(t.wallet_id) === id || String(t.wallet_tujuan_id) === id;
  });

  if (terkait.length && !p.paksa) {
    throw new Error('This wallet is used by ' + terkait.length + ' transaction(s). ' +
      'Archive it, or delete it together with those transactions.');
  }

  terkait.forEach(function (t) { deleteByKey_(SH.TX, 'id', t.id); });
  deleteByKey_(SH.WALLETS, 'id', id);
  bersihkanCache_();

  return { deleted: id, transaksiTerhapus: terkait.length };
}

/* ============================== AKSI: KATEGORI ============================ */

function categorySave_(p) {
  var c = p.category || p;
  var nama = String(c.nama || '').trim();
  if (!nama) throw new Error('Category name is required.');

  var tipe = String(c.tipe || 'Pengeluaran');
  if (['Pemasukan', 'Pengeluaran'].indexOf(tipe) === -1) throw new Error('Invalid category type.');

  var id = c.id ? String(c.id) : slug_(nama) + '_' + Math.random().toString(36).slice(2, 6);
  var existing = c.id ? findRowById_(SH.CATS, id) : null;

  if (existing && num_(existing.sistem) === 1) {
    // kategori sistem: hanya boleh ubah warna/nama tampilan
    updateByKey_(SH.CATS, 'id', id, { nama: nama, warna: c.warna || existing.warna });
    return { category: findCategory_(id) };
  }

  var rec = {
    id: id,
    nama: nama,
    tipe: tipe,
    warna: String(c.warna || '#64748b'),
    ikon: String(c.ikon || 'Tag'),
    sistem: 0,
    urutan: c.urutan !== undefined ? num_(c.urutan) : readAll_(SH.CATS).length + 1,
    aktif: 1
  };

  if (existing) {
    updateByKey_(SH.CATS, 'id', id, rec);
  } else {
    append_(SH.CATS, rec);
  }
  return { category: rec };
}

function categoryDelete_(p) {
  var id = String(p.id || '');
  if (!id) throw new Error('Missing category ID.');
  var c = findCategory_(id);
  if (!c) throw new Error('Category not found.');
  if (num_(c.sistem) === 1) throw new Error('System categories cannot be deleted.');

  var dipakai = readAll_(SH.TX).some(function (t) { return t.category_id === id; });
  if (dipakai) {
    updateByKey_(SH.CATS, 'id', id, { aktif: 0 });
    return { id: id, archived: true };
  }
  deleteByKey_(SH.CATS, 'id', id);

  var budgets = readAll_(SH.BUDGET).filter(function (b) { return b.category_id === id; });
  budgets.forEach(function (b) { deleteByKey_(SH.BUDGET, 'id', b.id); });

  return { id: id, deleted: true };
}

/* =============================== AKSI: BUDGET ============================= */

function budgetPage_(p) {
  var bulan = p && p.bulan ? String(p.bulan) : bulanOf_(todayStr_());
  var txs = semuaTx_();
  var wallets = activeWallets_();

  return {
    bulan: bulan,
    status: budgetStatus_(bulan),
    statusBulanLain: bulanSebelum_(bulan) ? budgetStatus_(bulanSebelum_(bulan)) : null,
    kategoriTersedia: activeCategories_().filter(function (c) {
      return c.tipe === 'Pengeluaran';
    }),
    adaBudgetBulanLalu: readAll_(SH.BUDGET).some(function (b) {
      return b.bulan === bulanSebelum_(bulan);
    })
  };
}

function budgetSaveAll_(p) {
  var bulan = String(p.bulan || '');
  if (!/^\d{4}-\d{2}$/.test(bulan)) throw new Error('Month must be in YYYY-MM format.');

  var items = p.items || [];
  var lama = readAll_(SH.BUDGET).filter(function (b) { return b.bulan === bulan; });
  lama.forEach(function (b) { deleteByKey_(SH.BUDGET, 'id', b.id); });

  items.forEach(function (it) {
    var jumlah = num_(it.jumlah);
    if (!(jumlah > 0)) return;
    append_(SH.BUDGET, {
      id: uid_(),
      bulan: bulan,
      category_id: String(it.category_id),
      jumlah: jumlah,
      updated_at: nowIso_()
    });
  });

  return { bulan: bulan, status: budgetStatus_(bulan) };
}

function budgetCopy_(p) {
  var dari = String(p.dari || '');
  var ke = String(p.ke || '');
  if (!/^\d{4}-\d{2}$/.test(dari) || !/^\d{4}-\d{2}$/.test(ke)) {
    throw new Error('Month must be in YYYY-MM format.');
  }
  var sumber = readAll_(SH.BUDGET).filter(function (b) { return b.bulan === dari; });
  if (!sumber.length) throw new Error('No budget found for ' + dari + '.');

  var target = readAll_(SH.BUDGET).filter(function (b) { return b.bulan === ke; });
  target.forEach(function (b) { deleteByKey_(SH.BUDGET, 'id', b.id); });

  sumber.forEach(function (b) {
    append_(SH.BUDGET, {
      id: uid_(),
      bulan: ke,
      category_id: b.category_id,
      jumlah: num_(b.jumlah),
      updated_at: nowIso_()
    });
  });

  return { dari: dari, ke: ke, jumlah: sumber.length, status: budgetStatus_(ke) };
}

/* ============================== AKSI: LAPORAN ============================= */

function report_(p) {
  var bulan = p && p.bulan ? String(p.bulan) : bulanOf_(todayStr_());
  var from = p.from ? String(p.from) : bulan + '-01';
  var to = p.to ? String(p.to) : akhirBulan_(bulan);

  var txs = semuaTx_().filter(function (t) {
    var d = String(t.tanggal || '');
    return d >= from && d <= to;
  });

  var masuk = 0, keluar = 0, biayaAdmin = 0, jumlahTx = 0;
  var perKategori = {}, perDompet = {};
  var harian = {};

  txs.forEach(function (t) {
    var j = num_(t.jumlah), fee = num_(t.biaya_admin);
    jumlahTx++;
    var d = String(t.tanggal);
    if (!harian[d]) harian[d] = { tanggal: d, masuk: 0, keluar: 0 };

    if (t.tipe === 'Pemasukan') {
      masuk += j;
      harian[d].masuk += j;
      perKategori[t.category_id] = (perKategori[t.category_id] || 0) + j;
      perDompet[t.wallet_id] = (perDompet[t.wallet_id] || 0) + j;
    } else if (t.tipe === 'Pengeluaran') {
      keluar += j;
      harian[d].keluar += j;
      perKategori[t.category_id] = (perKategori[t.category_id] || 0) + j;
      perDompet[t.wallet_id] = (perDompet[t.wallet_id] || 0) - j;
    } else if (t.tipe === 'Transfer') {
      biayaAdmin += fee;
      keluar += fee;
      harian[d].keluar += fee;
      if (fee) perKategori[KAT_BIAYA_ADMIN] = (perKategori[KAT_BIAYA_ADMIN] || 0) + fee;
      perDompet[t.wallet_id] = (perDompet[t.wallet_id] || 0) - j - fee;
      perDompet[t.wallet_tujuan_id] = (perDompet[t.wallet_tujuan_id] || 0) + j;
    }
  });

  var categories = readAll_(SH.CATS);
  var wallets = readAll_(SH.WALLETS);
  var cMap = {}, wMap = {};
  categories.forEach(function (c) { cMap[c.id] = c; });
  wallets.forEach(function (w) { wMap[w.id] = w; });

  var rincianKategori = Object.keys(perKategori).map(function (id) {
    var c = cMap[id];
    return {
      id: id,
      nama: c ? c.nama : id,
      warna: c ? c.warna : '#64748b',
      tipe: c ? c.tipe : 'Pengeluaran',
      jumlah: perKategori[id]
    };
  }).sort(function (a, b) { return b.jumlah - a.jumlah; });

  var rincianDompet = Object.keys(perDompet).map(function (id) {
    var w = wMap[id];
    return {
      id: id,
      nama: w ? w.nama : id,
      jenis: w ? w.jenis : 'lainnya',
      jumlah: perDompet[id]
    };
  }).sort(function (a, b) { return b.jumlah - a.jumlah; });

  var hari = Object.keys(harian).sort().map(function (k) { return harian[k]; });

  /* pembanding bulan sebelumnya */
  var bulanLalu = bulanSebelum_(bulan);
  var fromLalu = bulanLalu + '-01';
  var toLalu = akhirBulan_(bulanLalu);
  var masukLalu = 0, keluarLalu = 0;
  semuaTx_().forEach(function (t) {
    var d = String(t.tanggal || '');
    if (d < fromLalu || d > toLalu) return;
    var j = num_(t.jumlah), fee = num_(t.biaya_admin);
    if (t.tipe === 'Pemasukan') masukLalu += j;
    else if (t.tipe === 'Pengeluaran') keluarLalu += j;
    else if (t.tipe === 'Transfer') keluarLalu += fee;
  });

  return {
    from: from,
    to: to,
    bulan: bulan,
    ringkasan: {
      masuk: masuk,
      keluar: keluar,
      biayaAdmin: biayaAdmin,
      selisih: masuk - keluar,
      jumlahTransaksi: jumlahTx,
      rataHarian: keluar / (hari.length || 1)
    },
    pembanding: {
      bulan: bulanLalu,
      masuk: masukLalu,
      keluar: keluarLalu,
      selisihMasuk: masuk - masukLalu,
      selisihKeluar: keluar - keluarLalu
    },
    perKategori: rincianKategori,
    perDompet: rincianDompet,
    harian: hari,
    tren: trendData_(12, bulan)
  };
}

/* ============================ AKSI: PENGGUNA ============================== */

function usersSave_(p, me) {
  var u = p.user || p;
  var email = String(u.email || '').trim().toLowerCase();
  if (!email || email.indexOf('@') === -1) throw new Error('Invalid email.');

  var peran = String(u.peran || 'admin') === 'lihat' ? 'lihat' : 'admin';
  var status = String(u.status || 'aktif').toLowerCase() === 'nonaktif' ? 'nonaktif' : 'aktif';

  var existing = findUser_(email);
  if (existing) {
    if (existing.email === me.email && status === 'nonaktif') {
      throw new Error('You cannot deactivate your own account.');
    }
    updateByKey_(SH.USERS, 'email', email, {
      nama: String(u.nama || ''),
      peran: peran,
      status: status
    });
  } else {
    upsertUser_({ email: email, nama: String(u.nama || ''), peran: peran, status: status });
  }
  return { user: publicUser_(findUser_(email)) };
}

function usersDelete_(p, me) {
  var email = String(p.email || '').toLowerCase();
  if (!email) throw new Error('Missing email.');
  if (email === me.email) throw new Error('You cannot remove your own account.');
  var row = findUser_(email);
  if (!row) throw new Error('User not found.');
  var semua = readAll_(SH.USERS).filter(function (u) { return String(u.status).toLowerCase() === 'aktif'; });
  if (semua.length <= 1) throw new Error('At least one active user is required.');
  deleteByKey_(SH.USERS, 'email', email);
  return { deleted: email };
}

function upsertUser_(u) {
  var email = String(u.email).toLowerCase();
  var ada = findUser_(email);
  if (ada) {
    updateByKey_(SH.USERS, 'email', email, {
      nama: u.nama !== undefined ? u.nama : ada.nama,
      peran: u.peran || ada.peran || 'admin',
      status: u.status || ada.status || 'aktif'
    });
  } else {
    append_(SH.USERS, {
      email: email,
      nama: u.nama || '',
      peran: u.peran || 'admin',
      status: u.status || 'aktif',
      created_at: nowIso_(),
      last_login: ''
    });
  }
}

/* ============================ HITUNGAN & BANTUAN ========================== */

function normalizeWallet_(w) {
  return {
    id: w.id,
    nama: w.nama,
    jenis: w.jenis || 'lainnya',
    saldo_awal: num_(w.saldo_awal),
    urutan: num_(w.urutan),
    aktif: num_(w.aktif) === 0 ? 0 : 1,
    catatan: w.catatan || ''
  };
}

function normalizeCategory_(c) {
  return {
    id: c.id,
    nama: c.nama,
    tipe: c.tipe,
    warna: c.warna || '#64748b',
    ikon: c.ikon || 'Tag',
    sistem: num_(c.sistem) === 1 ? 1 : 0,
    urutan: num_(c.urutan),
    aktif: num_(c.aktif) === 0 ? 0 : 1
  };
}

function activeWallets_() {
  return readAll_(SH.WALLETS)
    .map(normalizeWallet_)
    .filter(function (w) { return w.aktif === 1; })
    .sort(function (a, b) { return (a.urutan || 0) - (b.urutan || 0); });
}

function activeCategories_() {
  return readAll_(SH.CATS)
    .map(normalizeCategory_)
    .filter(function (c) { return c.aktif === 1; })
    .sort(function (a, b) { return (a.urutan || 0) - (b.urutan || 0); });
}

function findWallet_(id) {
  var list = readAll_(SH.WALLETS);
  for (var i = 0; i < list.length; i++) if (String(list[i].id) === String(id)) return normalizeWallet_(list[i]);
  return null;
}

function findCategory_(id) {
  var list = readAll_(SH.CATS);
  for (var i = 0; i < list.length; i++) if (String(list[i].id) === String(id)) return normalizeCategory_(list[i]);
  return null;
}

function computeBalances_(wallets, txs) {
  var bal = {};
  wallets.forEach(function (w) { bal[w.id] = num_(w.saldo_awal); });
  txs.forEach(function (t) {
    var j = num_(t.jumlah), fee = num_(t.biaya_admin);
    var a = String(t.wallet_id || '');
    var b = String(t.wallet_tujuan_id || '');
    if (t.tipe === 'Pemasukan') {
      if (bal[a] === undefined) bal[a] = 0;
      bal[a] += j;
    } else if (t.tipe === 'Pengeluaran') {
      if (bal[a] === undefined) bal[a] = 0;
      bal[a] -= j;
    } else if (t.tipe === 'Transfer') {
      if (bal[a] === undefined) bal[a] = 0;
      bal[a] -= (j + fee);
      if (b) {
        if (bal[b] === undefined) bal[b] = 0;
        bal[b] += j;
      }
    }
  });
  return bal;
}

/** Pemakaian per kategori pada satu bulan. Biaya admin masuk kategori sistem. */
function pemakaianKategori_(bulan) {
  var map = {};
  semuaTx_().forEach(function (t) {
    if (bulanOf_(t.tanggal) !== bulan) return;
    var j = num_(t.jumlah), fee = num_(t.biaya_admin);
    if (t.tipe === 'Pengeluaran') {
      map[t.category_id] = (map[t.category_id] || 0) + j;
    } else if (t.tipe === 'Transfer' && fee) {
      map[KAT_BIAYA_ADMIN] = (map[KAT_BIAYA_ADMIN] || 0) + fee;
    }
  });
  return map;
}

function levelOf_(persen) {
  if (persen >= BATAS_OVER) return 'over';
  if (persen >= BATAS_KRITIS) return 'kritis';
  if (persen >= BATAS_WARNING) return 'warning';
  return 'aman';
}

function budgetStatus_(bulan) {
  var budgets = readAll_(SH.BUDGET).filter(function (b) { return String(b.bulan) === bulan; });
  if (!budgets.length) return { bulan: bulan, items: [], total: null };

  var cMap = {};
  readAll_(SH.CATS).forEach(function (c) { cMap[c.id] = c; });
  var pakai = pemakaianKategori_(bulan);

  var items = [];
  var totalBatas = 0, totalPakai = 0, adaTotal = false;

  budgets.forEach(function (b) {
    var batas = num_(b.jumlah);
    if (!(batas > 0)) return;

    if (String(b.category_id) === KAT_TOTAL) {
      adaTotal = true;
      totalBatas = batas;
      return;
    }

    var terpakai = pakai[b.category_id] || 0;
    var c = cMap[b.category_id];
    var persen = batas > 0 ? (terpakai / batas) * 100 : 0;
    items.push({
      categoryId: b.category_id,
      nama: c ? c.nama : b.category_id,
      warna: c ? c.warna : '#64748b',
      batas: batas,
      terpakai: terpakai,
      sisa: batas - terpakai,
      persen: Math.round(persen * 10) / 10,
      level: levelOf_(persen)
    });
  });

  /* total pemakaian = semua pengeluaran bulan itu, termasuk biaya admin */
  var semuaPakai = 0;
  Object.keys(pakai).forEach(function (k) { semuaPakai += pakai[k]; });
  totalPakai = semuaPakai;

  items.sort(function (a, b) { return b.persen - a.persen; });

  var total = null;
  if (adaTotal && totalBatas > 0) {
    var pTotal = (totalPakai / totalBatas) * 100;
    total = {
      batas: totalBatas,
      terpakai: totalPakai,
      sisa: totalBatas - totalPakai,
      persen: Math.round(pTotal * 10) / 10,
      level: levelOf_(pTotal)
    };
  }

  var perhatian = items.filter(function (i) { return i.level !== 'aman'; }).length;
  if (total && total.level !== 'aman') perhatian++;

  return { bulan: bulan, items: items, total: total, jumlahPerhatian: perhatian };
}

function kategoriBreakdown_(bulan) {
  var pakai = pemakaianKategori_(bulan);
  var cMap = {};
  readAll_(SH.CATS).forEach(function (c) { cMap[c.id] = c; });

  var out = Object.keys(pakai).map(function (id) {
    var c = cMap[id];
    return {
      id: id,
      nama: c ? c.nama : id,
      warna: c ? c.warna : '#64748b',
      jumlah: pakai[id]
    };
  }).filter(function (x) { return x.jumlah > 0; });

  out.sort(function (a, b) { return b.jumlah - a.jumlah; });
  return out;
}

function trendData_(n, sampaiBulan) {
  var txs = semuaTx_();
  var out = [];
  var bulan = sampaiBulan || bulanOf_(todayStr_());
  var daftar = [];
  for (var i = n - 1; i >= 0; i--) daftar.push(geserBulan_(bulan, -i));

  daftar.forEach(function (b) {
    var masuk = 0, keluar = 0;
    txs.forEach(function (t) {
      if (bulanOf_(t.tanggal) !== b) return;
      var j = num_(t.jumlah), fee = num_(t.biaya_admin);
      if (t.tipe === 'Pemasukan') masuk += j;
      else if (t.tipe === 'Pengeluaran') keluar += j;
      else if (t.tipe === 'Transfer') keluar += fee;
    });
    out.push({
      bulan: b,
      label: labelBulan_(b),
      masuk: masuk,
      keluar: keluar,
      selisih: masuk - keluar
    });
  });
  return out;
}

/* ============================ NOTIFIKASI TELEGRAM ========================= */

function cekBudgetDanKirim_(bulan) {
  try {
    var status = budgetStatus_(bulan);
    if (!status.items.length && !status.total) return { terkirim: 0 };

    var sudah = {};
    readAll_(SH.NOTIF).forEach(function (r) {
      if (String(r.bulan) === bulan) sudah[String(r.category_id)] = String(r.level);
    });

    var terkirim = 0;

    var kandidat = status.items.slice();
    if (status.total) {
      kandidat.push({
        categoryId: KAT_TOTAL,
        nama: 'Monthly total',
        batas: status.total.batas,
        terpakai: status.total.terpakai,
        sisa: status.total.sisa,
        persen: status.total.persen,
        level: status.total.level
      });
    }

    kandidat.forEach(function (it) {
      if (it.level === 'aman') return;
      var lama = sudah[it.categoryId] || 'aman';
      if (RANK_LEVEL[it.level] <= RANK_LEVEL[lama]) return;

      var pesan = susunPesan_(it, bulan);
      var ok = telegram_(pesan);
      if (!ok) return;

      terkirim++;
      var rec = { bulan: bulan, category_id: it.categoryId, level: it.level, sent_at: nowIso_() };
      var ada = findRow_(SH.NOTIF, function (r) {
        return String(r.bulan) === bulan && String(r.category_id) === it.categoryId;
      });
      if (ada) updateByKey_(SH.NOTIF, 'bulan', bulan, rec, it.categoryId);
      else append_(SH.NOTIF, rec);
    });

    return { terkirim: terkirim };
  } catch (e) {
    return { terkirim: 0, error: String(e && e.message ? e.message : e) };
  }
}

function susunPesan_(it, bulan) {
  var ikon = IKON_LEVEL[it.level] || '\u2139\uFE0F';
  var label = LABEL_LEVEL[it.level] || it.level;
  var baris = [];

  baris.push(ikon + ' <b>' + escapeHtml_(it.nama) + ' budget</b> \u2014 ' + label);
  baris.push('Month: ' + labelBulan_(bulan));
  baris.push('');
  baris.push('Used: <b>' + it.persen + '%</b>');
  baris.push(formatRp_(it.terpakai) + ' of ' + formatRp_(it.batas));

  if (it.level === 'over') {
    baris.push('Over by ' + formatRp_(Math.abs(it.sisa)));
  } else {
    baris.push('Left: ' + formatRp_(it.sisa));
  }

  return baris.join('\n');
}

function telegram_(text) {
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty('TELEGRAM_BOT_TOKEN');
  var chatId = props.getProperty('TELEGRAM_CHAT_ID');
  if (!token || !chatId) return false;

  var res = UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    }),
    muteHttpExceptions: true
  });
  return res.getResponseCode() === 200;
}

/* ============================== AKSES SHEET =============================== */

function ss_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('This script must be bound to a Google Sheet (Extensions -> Apps Script).');
  return ss;
}

function sheet_(name) {
  var ss = ss_();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
  }
  var head = HEADERS[name];
  if (head) {
    var now = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0];
    var kosong = String(now.join('')).replace(/,/g, '') === '';
    if (kosong || sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, head.length).setValues([head]);
      sh.setFrozenRows(1);
    }
  }
  return sh;
}

/**
 * Hasil baca disimpan selama SATU permintaan saja.
 *
 * Satu permintaan dashboard bisa membaca sheet Transaksi sampai empat kali
 * (ringkasan, status budget, tren, rincian kategori). Tanpa ini Apps Script
 * membaca ulang seluruh sheet setiap kali, dan aplikasinya terasa berat.
 */
var _cacheBaca = {};

function bersihkanCache_() {
  _cacheBaca = {};
}

function readAll_(name) {
  if (_cacheBaca[name]) return _cacheBaca[name];

  var sh = sheet_(name);
  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();
  if (lastRow < 2 || lastCol < 1) {
    _cacheBaca[name] = [];
    return _cacheBaca[name];
  }

  var values = sh.getRange(1, 1, lastRow, lastCol).getValues();
  var head = values[0].map(function (h) { return String(h); });
  var out = [];
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (String(row.join('')).replace(/,/g, '') === '') continue;
    var o = { _row: i + 1 };
    for (var j = 0; j < head.length; j++) o[head[j]] = row[j];
    out.push(o);
  }

  _cacheBaca[name] = out;
  return out;
}

/**
 * Seragamkan nilai tanggal menjadi teks 'YYYY-MM-DD'.
 *
 * Google Sheets sering mengubah teks '2026-09-29' menjadi nilai tanggal saat
 * ditulis, sehingga ketika dibaca kembali yang didapat adalah objek Date.
 * Perbandingan teks seperti "2026-09-29" < "2026-10-01" jadi kacau, dan
 * transaksi yang sebenarnya ada di sheet bisa tersaring keluar dari daftar.
 */
function tanggalStr_(v) {
  if (v === null || v === undefined || v === '') return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  }
  var s = String(v).trim();
  var cocok = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (cocok) return cocok[1] + '-' + cocok[2] + '-' + cocok[3];
  var d = new Date(s);
  if (!isNaN(d.getTime())) return Utilities.formatDate(d, TZ, 'yyyy-MM-dd');
  return s;
}

/** Transaksi dengan kolom tanggal yang sudah diseragamkan. */
function semuaTx_() {
  return readAll_(SH.TX).map(function (t) {
    if (t.tanggal !== undefined) t.tanggal = tanggalStr_(t.tanggal);
    return t;
  });
}

function append_(name, obj) {
  var sh = sheet_(name);
  var head = HEADERS[name];
  var baris = head.map(function (h) {
    var v = obj[h];
    return v === undefined || v === null ? '' : v;
  });
  sh.appendRow(baris);
  bersihkanCache_();
  return obj;
}

function findRowById_(name, id) {
  var list = readAll_(name);
  for (var i = 0; i < list.length; i++) {
    if (String(list[i].id) === String(id)) return list[i];
  }
  return null;
}

function findRow_(name, pred) {
  var list = readAll_(name);
  for (var i = 0; i < list.length; i++) if (pred(list[i])) return list[i];
  return null;
}

function updateByKey_(name, key, value, patch, extraKeyValue) {
  var sh = sheet_(name);
  var head = HEADERS[name];
  var list = readAll_(name);
  for (var i = 0; i < list.length; i++) {
    var cocok = String(list[i][key]) === String(value);
    if (cocok && extraKeyValue !== undefined) {
      cocok = String(list[i].category_id) === String(extraKeyValue);
    }
    if (!cocok) continue;

    var rowIdx = list[i]._row;
    var baris = head.map(function (h) {
      if (patch[h] !== undefined) return patch[h];
      var v = list[i][h];
      return v === undefined || v === null ? '' : v;
    });
    sh.getRange(rowIdx, 1, 1, head.length).setValues([baris]);
    bersihkanCache_();
    return true;
  }
  return false;
}

function deleteByKey_(name, key, value) {
  var sh = sheet_(name);
  var list = readAll_(name);
  for (var i = list.length - 1; i >= 0; i--) {
    if (String(list[i][key]) === String(value)) {
      sh.deleteRow(list[i]._row);
      bersihkanCache_();
      return true;
    }
  }
  return false;
}

/* ================================ SEED DATA =============================== */

function seedKategori_() {
  var ada = readAll_(SH.CATS);
  var known = {};
  ada.forEach(function (c) { known[String(c.id)] = true; });
  KATEGORI_AWAL.forEach(function (c, i) {
    if (known[c.id]) return;
    append_(SH.CATS, {
      id: c.id,
      nama: c.nama,
      tipe: c.tipe,
      warna: c.warna,
      ikon: c.ikon,
      sistem: c.sistem || 0,
      urutan: i + 1,
      aktif: 1
    });
  });
}

/**
 * Jalankan SEKALI kalau kategori bawaanmu masih memakai nama bahasa Indonesia.
 * Hanya mengganti nama; kategori buatanmu sendiri tidak disentuh.
 */
function ubahKategoriKeInggris() {
  var peta = {
    gaji: 'Salary',
    thr: 'THR',
    bonus: 'Bonus',
    lain_masuk: 'Other',
    makan: 'Food',
    transportasi: 'Transport',
    tagihan: 'Bills',
    hiburan: 'Entertainment',
    pendidikan: 'Education',
    orang_tua: 'Parents',
    belanja: 'Shopping',
    kesehatan: 'Health',
    lainnya: 'Other',
    biaya_admin: 'Admin Fee'
  };

  var diubah = [];
  Object.keys(peta).forEach(function (id) {
    var c = findCategory_(id);
    if (c && c.nama !== peta[id]) {
      updateByKey_(SH.CATS, 'id', id, { nama: peta[id] });
      diubah.push(c.nama + ' -> ' + peta[id]);
    }
  });

  return diubah.length ? 'Renamed: ' + diubah.join(', ') : 'All categories are already in English.';
}

function seedDompet_() {
  if (readAll_(SH.WALLETS).length) return;
  DOMPET_AWAL.forEach(function (w, i) {
    append_(SH.WALLETS, {
      id: w.id,
      nama: w.nama,
      jenis: w.jenis,
      saldo_awal: 0,
      urutan: i + 1,
      aktif: 1,
      catatan: '',
      created_at: nowIso_()
    });
  });
}

/* ================================= UTILITAS ============================== */

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function uid_() {
  return Utilities.getUuid().replace(/-/g, '').slice(0, 16);
}

function slug_(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 24) || 'kat';
}

function num_(v) {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  var s = String(v).replace(/[^0-9,.\-]/g, '');
  if (s.indexOf(',') > -1 && s.indexOf('.') > -1) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.indexOf(',') > -1) {
    s = s.replace(',', '.');
  }
  var n = parseFloat(s);
  return isFinite(n) ? n : 0;
}

function todayStr_() {
  return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
}

function nowIso_() {
  return Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd'T'HH:mm:ss");
}

function bulanOf_(tanggal) {
  var s = String(tanggal || '');
  if (s.length >= 7 && s.charAt(4) === '-') return s.slice(0, 7);
  return Utilities.formatDate(new Date(), TZ, 'yyyy-MM');
}

function bulanSebelum_(bulan) {
  return geserBulan_(bulan, -1);
}

function geserBulan_(bulan, delta) {
  var y = parseInt(String(bulan).slice(0, 4), 10);
  var m = parseInt(String(bulan).slice(5, 7), 10);
  var d = new Date(y, m - 1 + delta, 1);
  return Utilities.formatDate(d, TZ, 'yyyy-MM');
}

function akhirBulan_(bulan) {
  var y = parseInt(String(bulan).slice(0, 4), 10);
  var m = parseInt(String(bulan).slice(5, 7), 10);
  var d = new Date(y, m, 0);
  return Utilities.formatDate(d, TZ, 'yyyy-MM-dd');
}

var NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

function labelBulan_(bulan) {
  var y = String(bulan).slice(0, 4);
  var m = parseInt(String(bulan).slice(5, 7), 10);
  var nama = NAMA_BULAN[m - 1] || bulan;
  return nama.slice(0, 3) + ' ' + y;
}

function formatRp_(n) {
  var angka = Math.round(num_(n));
  var negatif = angka < 0;
  var s = String(Math.abs(angka));
  var out = '';
  while (s.length > 3) {
    out = '.' + s.slice(-3) + out;
    s = s.slice(0, -3);
  }
  return (negatif ? '-' : '') + 'Rp ' + s + out;
}

function escapeHtml_(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
