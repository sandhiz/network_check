# 🖧 NetWatch — Network Monitoring System
### Product Requirements Document (PRD)

| | |
|---|---|
| **Versi** | 1.0.0 |
| **Tanggal** | April 2026 |
| **Status** | Draft |
| **Author** | Engineering Team |
| **Tech Stack** | Node.js · Express · MySQL · Socket.IO · HTML/CSS/JS |

---

## Daftar Isi

1. [Ringkasan Eksekutif](#1-ringkasan-eksekutif)
2. [Latar Belakang & Masalah](#2-latar-belakang--masalah)
3. [Ruang Lingkup (Scope)](#3-ruang-lingkup-scope)
4. [Stakeholder & User](#4-stakeholder--user)
5. [Fitur & Kebutuhan Fungsional](#5-fitur--kebutuhan-fungsional)
6. [Kebutuhan Non-Fungsional](#6-kebutuhan-non-fungsional)
7. [Arsitektur Sistem](#7-arsitektur-sistem)
8. [Desain Database](#8-desain-database)
9. [REST API Specification](#9-rest-api-specification)
10. [Real-time via Socket.IO](#10-real-time-via-socketio)
11. [Migration & Setup](#11-migration--setup)
12. [Milestone & Timeline](#12-milestone--timeline)
13. [Asumsi & Risiko](#13-asumsi--risiko)
14. [Acceptance Criteria](#14-acceptance-criteria)

---

## 1. Ringkasan Eksekutif

**NetWatch** adalah aplikasi monitoring jaringan berbasis web yang memungkinkan administrator jaringan untuk memantau ketersediaan host/device secara real-time melalui mekanisme **ICMP Ping**. Aplikasi ini dibangun menggunakan **Node.js murni** sebagai backend, **MySQL** sebagai penyimpanan data, dan antarmuka web responsif yang dapat diakses dari browser manapun.

Tujuan utama sistem ini adalah memberikan visibilitas penuh terhadap kondisi jaringan, mendeteksi kegagalan konektivitas secara cepat, dan menyediakan riwayat uptime/downtime untuk keperluan analisis dan pelaporan.

---

## 2. Latar Belakang & Masalah

### 2.1 Masalah yang Diselesaikan

- Administrator kesulitan memantau banyak device jaringan secara manual satu per satu
- Tidak ada notifikasi otomatis ketika device/server mengalami downtime
- Tidak tersedia riwayat historis status koneksi untuk keperluan audit
- Tools monitoring yang ada terlalu kompleks atau berbayar

### 2.2 Solusi yang Ditawarkan

NetWatch hadir sebagai solusi **ringan, open-source, berbasis web** yang mudah di-deploy, menggunakan teknologi standar Node.js dan MySQL tanpa dependensi berat. Sistem melakukan ping otomatis secara berkala dan menampilkan hasilnya secara real-time di dashboard.

---

## 3. Ruang Lingkup (Scope)

### 3.1 ✅ In Scope (V1)

- Manajemen daftar IP/Host yang akan dimonitor (CRUD)
- Proses ping ICMP otomatis secara periodik (interval configurable per host)
- Dashboard real-time dengan status UP/DOWN per host
- Riwayat log ping dengan timestamp, latency, dan status
- Notifikasi visual ketika host berubah status
- Statistik uptime per host (persentase)
- REST API untuk integrasi eksternal
- Database MySQL dengan migration script

### 3.2 ❌ Out of Scope (V1 — direncanakan V2)

- Notifikasi via email / SMS / Slack
- SNMP monitoring
- Autentikasi & multi-user management
- Grafik time-series latency

---

## 4. Stakeholder & User

| Role | Deskripsi |
|---|---|
| **Network Administrator** | Pengguna utama, memantau infrastruktur jaringan |
| **System Administrator** | Memantau server dan virtual machine |
| **IT Support Team** | Mendeteksi dan merespons insiden jaringan |

---

## 5. Fitur & Kebutuhan Fungsional

| ID | Fitur | Prioritas | Deskripsi |
|---|---|---|---|
| F-01 | Dashboard Real-time | 🔴 High | Tampilkan semua host beserta status UP/DOWN dengan auto-refresh via WebSocket |
| F-02 | Manajemen Host | 🔴 High | CRUD host: tambah IP/hostname, label, deskripsi, grup, dan interval ping |
| F-03 | Auto Ping Engine | 🔴 High | Background job Node.js yang melakukan ping ke semua host aktif secara periodik |
| F-04 | Log Riwayat | 🔴 High | Simpan setiap hasil ping (timestamp, latency ms, status, packet loss) ke database |
| F-05 | Statistik Uptime | 🟡 Medium | Hitung persentase uptime per host dalam rentang 24 jam / 7 hari / 30 hari |
| F-06 | Filter & Search | 🟡 Medium | Filter host berdasarkan status, grup, atau pencarian nama/IP |
| F-07 | Detail Host | 🟡 Medium | Halaman detail host: info, grafik status, dan log terbaru |
| F-08 | REST API | 🟡 Medium | Endpoint API untuk get status host, trigger manual ping, dan kelola host |
| F-09 | Import Host CSV | 🟢 Low | Import daftar host dari file CSV untuk bulk insert |
| F-10 | Export Log | 🟢 Low | Export log ping ke format CSV |

---

## 6. Kebutuhan Non-Fungsional

### 6.1 Performa

- Sistem mampu memonitor minimal **500 host** secara bersamaan
- Response time dashboard **< 2 detik**
- Ping engine tidak memblokir I/O request HTTP (non-blocking async)

### 6.2 Ketersediaan

- Uptime aplikasi target **99%** pada environment produksi
- Recovery otomatis jika koneksi database terputus sementara

### 6.3 Keamanan

- Input IP/hostname divalidasi sebelum dieksekusi (mencegah command injection)
- Query database menggunakan **prepared statement**
- Konfigurasi credential dari file `.env` (tidak hardcode di source code)

---

## 7. Arsitektur Sistem

### 7.1 Technology Stack

| Komponen | Teknologi |
|---|---|
| **Runtime** | Node.js v18+ (LTS) |
| **Framework** | Express.js — HTTP server & REST API |
| **Database** | MySQL 8.x |
| **DB Driver** | mysql2 (Promise-based) |
| **Real-time** | Socket.IO — push update ke browser |
| **Ping Library** | `ping` (npm) — wrapper ICMP cross-platform |
| **Scheduler** | `node-cron` — cron job ping engine |
| **Frontend** | Vanilla HTML + CSS + JavaScript (no framework) |
| **Env Config** | `.env` via `dotenv` |
| **DB Credential** | host: `localhost` \| user: `root` \| password: _(kosong)_ |

### 7.2 Struktur Direktori Proyek

```
netwatch/
├── src/
│   ├── config/
│   │   └── database.js             # Koneksi MySQL pool
│   ├── controllers/
│   │   ├── host.controller.js      # CRUD host
│   │   └── log.controller.js       # Query log ping
│   ├── services/
│   │   ├── ping.service.js         # Logic ping engine
│   │   └── scheduler.service.js    # node-cron scheduler
│   ├── routes/
│   │   ├── host.routes.js
│   │   └── log.routes.js
│   ├── socket/
│   │   └── events.js               # Socket.IO event handler
│   └── app.js                      # Express app setup
├── public/
│   ├── index.html                  # Dashboard
│   ├── hosts.html                  # Manajemen host
│   ├── detail.html                 # Detail host
│   ├── css/
│   │   └── style.css
│   └── js/
│       ├── dashboard.js
│       ├── hosts.js
│       └── socket-client.js
├── migrations/
│   ├── 001_create_database.sql
│   ├── 002_create_hosts.sql
│   ├── 003_create_ping_logs.sql
│   └── 004_seed_sample_data.sql
├── scripts/
│   └── migrate.js                  # Runner migration otomatis
├── .env.example
├── package.json
└── server.js                       # Entry point
```

### 7.3 Diagram Alur Sistem

```
Browser ──────► Express Server (Node.js) ──────► MySQL DB
   ▲                    │                            │
   │                    │ Socket.IO                  │
   └────────────────────┘                            │
                         ▲                           │
                         │                           │
              node-cron Scheduler                    │
                         │                           │
              Ping Service (ICMP) ───── host data ───┘
                         │
                  simpan hasil ping
                         │
                     ping_logs ──────────────────────►
```

---

## 8. Desain Database

### 8.1 Konfigurasi Koneksi

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=netwatch_db
DB_PORT=3306
```

### 8.2 Tabel: `hosts`

Menyimpan daftar host/IP yang akan dimonitor.

| Column | Type | Constraint | Keterangan |
|---|---|---|---|
| `id` | INT UNSIGNED | PK, AUTO_INCREMENT | Primary key |
| `label` | VARCHAR(100) | NOT NULL | Nama/label host |
| `ip_address` | VARCHAR(255) | NOT NULL, UNIQUE | IP atau hostname |
| `description` | TEXT | NULL | Deskripsi opsional |
| `group_name` | VARCHAR(100) | NULL | Grup/kategori host |
| `ping_interval` | INT | DEFAULT 60 | Interval ping (detik) |
| `is_active` | TINYINT(1) | DEFAULT 1 | 1=aktif, 0=nonaktif |
| `last_status` | ENUM('up','down','unknown') | DEFAULT 'unknown' | Status terakhir |
| `last_ping_at` | DATETIME | NULL | Waktu ping terakhir |
| `last_latency` | FLOAT | NULL | Latency terakhir (ms) |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Waktu dibuat |
| `updated_at` | TIMESTAMP | ON UPDATE CURRENT_TIMESTAMP | Waktu diupdate |

### 8.3 Tabel: `ping_logs`

Menyimpan riwayat setiap hasil ping.

| Column | Type | Constraint | Keterangan |
|---|---|---|---|
| `id` | BIGINT UNSIGNED | PK, AUTO_INCREMENT | Primary key |
| `host_id` | INT UNSIGNED | NOT NULL, FK → hosts.id | Referensi ke host |
| `status` | ENUM('up','down') | NOT NULL | Hasil ping |
| `latency_ms` | FLOAT | NULL | Latency dalam milidetik |
| `packet_loss` | TINYINT | DEFAULT 0 | Packet loss (%) |
| `error_msg` | VARCHAR(255) | NULL | Pesan error jika down |
| `pinged_at` | DATETIME | NOT NULL, INDEX | Timestamp ping |

### 8.4 Entity Relationship

```
hosts (1) ────────────── (N) ping_logs
  id ◄──────────────────── host_id (FK)
```

---

## 9. REST API Specification

**Base URL:** `http://localhost:3000/api`

### Host Endpoints

| Method | Endpoint | Deskripsi |
|---|---|---|
| `GET` | `/hosts` | Ambil semua host dengan status terkini |
| `POST` | `/hosts` | Tambah host baru |
| `GET` | `/hosts/:id` | Detail host + statistik uptime |
| `PUT` | `/hosts/:id` | Update data host |
| `DELETE` | `/hosts/:id` | Hapus host |
| `POST` | `/hosts/:id/ping` | Trigger manual ping ke host |
| `PATCH` | `/hosts/:id/toggle` | Toggle aktif/nonaktif host |

### Log Endpoints

| Method | Endpoint | Deskripsi |
|---|---|---|
| `GET` | `/logs` | Ambil log ping (dengan filter & pagination) |
| `GET` | `/logs/host/:id` | Log ping per host |
| `GET` | `/stats` | Statistik global semua host |

### Contoh Request & Response

**POST /api/hosts**
```json
// Request Body
{
  "label": "Web Server Production",
  "ip_address": "192.168.1.10",
  "description": "Nginx web server utama",
  "group_name": "Production",
  "ping_interval": 30
}

// Response 201
{
  "success": true,
  "data": {
    "id": 1,
    "label": "Web Server Production",
    "ip_address": "192.168.1.10",
    "last_status": "unknown",
    "created_at": "2026-04-16T08:00:00.000Z"
  }
}
```

**GET /api/hosts**
```json
// Response 200
{
  "success": true,
  "data": [
    {
      "id": 1,
      "label": "Web Server Production",
      "ip_address": "192.168.1.10",
      "group_name": "Production",
      "last_status": "up",
      "last_latency": 2.45,
      "last_ping_at": "2026-04-16T08:05:00.000Z",
      "is_active": 1
    }
  ]
}
```

---

## 10. Real-time via Socket.IO

### Events: Server → Client

| Event | Payload | Keterangan |
|---|---|---|
| `host:status_update` | `{ hostId, status, latency, timestamp }` | Dikirim setiap ada hasil ping baru |
| `host:down` | `{ hostId, label, ip, timestamp }` | Alert khusus ketika host baru DOWN |
| `host:recovered` | `{ hostId, label, ip, timestamp }` | Alert ketika host kembali UP |
| `stats:update` | `{ totalHosts, upCount, downCount }` | Update statistik global dashboard |

### Events: Client → Server

| Event | Payload | Keterangan |
|---|---|---|
| `ping:manual` | `{ hostId }` | Request manual ping dari browser |
| `subscribe:host` | `{ hostId }` | Subscribe update untuk host tertentu |

---

## 11. Migration & Setup

### 11.1 File Migration

```
migrations/
├── 001_create_database.sql    → CREATE DATABASE netwatch_db
├── 002_create_hosts.sql       → CREATE TABLE hosts
├── 003_create_ping_logs.sql   → CREATE TABLE ping_logs + FK + INDEX
└── 004_seed_sample_data.sql   → INSERT sample hosts untuk testing
```

### 11.2 Cara Menjalankan dari Nol

```bash
# 1. Clone & install dependencies
git clone <repo-url> netwatch
cd netwatch
npm install

# 2. Setup environment
cp .env.example .env
# Edit .env sesuai kebutuhan (default sudah siap untuk localhost)

# 3. Jalankan migration (buat DB + tabel + seed)
node scripts/migrate.js

# 4. Jalankan server
node server.js

# 5. Buka browser
# http://localhost:3000
```

### 11.3 Environment Variables (.env.example)

```env
# Server
PORT=3000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=netwatch_db
DB_PORT=3306

# Ping Engine
DEFAULT_PING_INTERVAL=60      # detik
PING_TIMEOUT=5000             # ms
MAX_CONCURRENT_PINGS=50       # max ping paralel

# Log Retention
LOG_RETENTION_DAYS=90         # hapus log > 90 hari
```

---

## 12. Milestone & Timeline

| Fase | Deliverable | Durasi | Target |
|---|---|---|---|
| **Fase 1** — Foundation | Setup project, koneksi DB, migration, struktur dasar Express | 3 hari | Minggu 1 |
| **Fase 2** — Core Engine | Ping service, scheduler node-cron, simpan log ke DB | 3 hari | Minggu 1-2 |
| **Fase 3** — Dashboard | Frontend dashboard, Socket.IO real-time update, status badge | 4 hari | Minggu 2 |
| **Fase 4** — CRUD Host | Halaman manajemen host, form add/edit/delete, validasi | 3 hari | Minggu 3 |
| **Fase 5** — Detail & Log | Halaman detail host, log riwayat, statistik uptime | 3 hari | Minggu 3-4 |
| **Fase 6** — Polish | Filter, search, export CSV, error handling, dokumentasi API | 4 hari | Minggu 4 |

**Total estimasi: ~20 hari kerja (4 minggu)**

---

## 13. Asumsi & Risiko

### 13.1 Asumsi

- Server dijalankan di lingkungan Linux/Mac/Windows dengan Node.js v18+
- MySQL berjalan di localhost dengan user `root` tanpa password (dev environment)
- Sistem memiliki akses raw socket untuk melakukan ICMP ping
- Jaringan yang dimonitor dapat dijangkau dari server tempat app berjalan

### 13.2 Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| ICMP diblokir firewall | Ping gagal meskipun host UP | Tambahkan opsi TCP port check sebagai fallback |
| Volume log terlalu besar | DB melambat setelah berbulan-bulan | Implementasi log rotation / auto-delete log > 90 hari |
| Race condition scheduler | Ping tumpang tindih jika interval terlalu pendek | Gunakan flag `is_pinging` per host sebelum eksekusi |
| Root MySQL di production | Risiko keamanan tinggi | Buat user MySQL terbatas khusus `netwatch_db` |
| Memory leak pada scheduler | Server crash setelah lama berjalan | Monitor dengan `--inspect` dan rate limit concurrent pings |

---

## 14. Acceptance Criteria

Sistem dinyatakan **DONE** jika seluruh kondisi berikut terpenuhi:

- [ ] Dashboard menampilkan semua host dengan status UP/DOWN secara real-time tanpa refresh manual
- [ ] Ping engine berjalan di background dan menyimpan hasil ke database setiap interval yang dikonfigurasi
- [ ] CRUD host berfungsi penuh: tambah, edit, hapus, dan toggle aktif/nonaktif
- [ ] Log riwayat ping dapat dilihat per host dengan filter tanggal
- [ ] Statistik uptime dihitung dengan benar (persentase berdasarkan log)
- [ ] Migration script berjalan tanpa error dan membuat struktur database lengkap
- [ ] Tidak ada SQL injection vulnerability (seluruh query menggunakan prepared statement)
- [ ] Aplikasi berjalan stabil selama minimal 1 jam tanpa crash atau memory leak signifikan

---

*NetWatch PRD v1.0 | Engineering Team | April 2026*
