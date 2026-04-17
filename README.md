# NetWatch 🌐

NetWatch adalah aplikasi monitoring jaringan berbasis web real-time untuk melacak ketersediaan host dan perangkat menggunakan ICMP ping, persistensi MySQL, pembaruan langsung Socket.IO, pemindaian subnet, impor CSV/XLSX, dan notifikasi Discord opsional.

Repository ini dibangun sebagai alat monitoring internal yang ringan: tanpa langkah build frontend, tanpa framework berat, dan tanpa layanan worker eksternal. Backend, scheduler, event real-time, dan frontend statis semuanya berjalan dalam satu aplikasi Node.js.

## Ringkasan Proyek 📋

- **Halaman**: 3 halaman utama - dashboard, manajemen host, dan detail host.
- **Grup API**: 3 grup rute - host, log/statistik, dan kontrol monitor.
- **Migrasi**: 4 migrasi SQL - pembuatan database, tabel, dan data sampel.
- **Tabel Utama**: `hosts` dan `ping_logs`.
- **Lapisan Real-time**: Socket.IO untuk pembaruan status, status monitor, dan progres pemindaian.
- **Lapisan Operasional**: scheduler, pemindaian subnet, impor massal, ekspor CSV, dan webhook Discord.

## Fitur ✨

- **Dashboard Real-time**: Pembaruan status host secara langsung.
- **Manajemen Host (CRUD)**: Label, IP/hostname, pemilik, tim, grup, deskripsi, dan interval ping.
- **Mesin Ping Otomatis**: Interval ping yang dapat dikonfigurasi per host.
- **Ping Manual**: Melalui API dan antarmuka pengguna (UI).
- **Halaman Detail Host**: Metadata, statistik uptime, dan riwayat ping lengkap.
- **Kontrol Monitoring**: Fitur pause/resume untuk monitoring global.
- **Impor Massal**: Dukungan CSV dan XLSX dengan validasi dan penanganan duplikat.
- **Pemindaian Subnet (CIDR)**: Progres pemindaian langsung melalui Socket.IO.
- **Ekspor Data**: Ekspor daftar host dan log ke format CSV.
- **Notifikasi Discord**: Peringatan otomatis saat host mati (DOWN) atau kembali normal (RECOVERED).
- **Frontend Responsif**: Menggunakan HTML/CSS/JS murni tanpa langkah build.

## Tech Stack 🛠️

| Lapisan | Teknologi |
| --- | --- |
| Runtime | Node.js 18+ |
| HTTP Server | Express |
| Database | MySQL |
| Driver DB | mysql2/promise |
| Real-time | Socket.IO |
| Scheduler | node-cron |
| Ping Engine | ping |
| File Upload | multer |
| Impor CSV | csv-parse |
| Impor XLSX | read-excel-file |
| Frontend | Vanilla HTML, CSS, JavaScript |
| Konfigurasi | dotenv |

## Cara Kerja NetWatch ⚙️

### 1. Alur Startup
1. `server.js` memuat variabel lingkungan dari `.env`.
2. Aplikasi membuka koneksi MySQL melalui `src/config/database.js`.
3. `createApp()` membangun aplikasi Express, memasang rute, dan melayani file statis.
4. `createSocketServer()` menghubungkan Socket.IO ke server HTTP.
5. Scheduler dijalankan dan dihubungkan ke Socket.IO.
6. Server HTTP mulai mendengarkan pada `PORT` yang ditentukan.

### 2. Alur Monitoring
1. Scheduler berjalan setiap `SCHEDULER_TICK_SECONDS`.
2. Mengambil daftar host yang jadwal ping-nya sudah tiba.
3. Melakukan probe ICMP dan menormalkan hasilnya (latency/packet loss).
4. Hasil ditulis ke `ping_logs` dan status terbaru diperbarui di tabel `hosts`.
5. Mengirimkan pembaruan real-time ke browser melalui Socket.IO.
6. Jika status berubah (UP <-> DOWN), notifikasi Discord dikirimkan.

## Struktur Direktori 📂

```text
network_check/
|-- public/        # Frontend statis (HTML, CSS, JS)
|-- migrations/    # Script SQL untuk skema database
|-- scripts/       # Script utilitas (seperti migrasi)
|-- src/           # Kode sumber aplikasi (logic, services, routes)
|-- .env.example   # Template variabel lingkungan
|-- README.md      # Dokumentasi ini
`-- server.js      # Entry point aplikasi
```

## Persiapan & Instalasi 🚀

### Prasyarat
- Node.js 18 atau lebih baru
- MySQL Server
- Akses ICMP (ping) yang diizinkan di sistem

### Langkah-langkah
1. **Clone repository** dan masuk ke direktori proyek.
2. **Instal dependensi**:
   ```bash
   npm install
   ```
3. **Setup Variabel Lingkungan**:
   Salin `.env.example` menjadi `.env` dan sesuaikan kredensial database Anda.
4. **Jalankan Migrasi Database**:
   ```bash
   npm run migrate
   ```
5. **Jalankan Aplikasi**:
   - Mode Produksi: `npm start`
   - Mode Pengembangan: `npm run dev`

## Keamanan 🔒

Aplikasi ini **tidak memiliki lapisan autentikasi**. Gunakan hanya di jaringan internal yang tepercaya. Jangan mengekspos aplikasi ini langsung ke internet publik tanpa menambahkan lapisan keamanan tambahan (seperti VPN, Reverse Proxy dengan Auth, atau HTTPS).

## Lisensi 📄

Repository ini ditandai sebagai `UNLICENSED` di `package.json`, yang berarti belum ada lisensi open source resmi yang diterapkan.
