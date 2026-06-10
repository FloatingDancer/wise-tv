# 📺 Wise TV - Discord Bot & Activity Player (Nobar Arena)

Wise TV adalah aplikasi **Discord Activity (Embedded App)** resmi yang terintegrasi dengan **Discord Bot**. Anggota server Anda dapat menonton TV lokal (Indonesia), internasional, dan olahraga (Piala Dunia) secara bersama-sama langsung di dalam Voice Channel Discord (seperti fitur Watch Together resmi) dan dikontrol menggunakan **Remote Control** interaktif di chat!

---

## 🛠️ Persyaratan Awal (Prerequisites)
Sebelum menjalankan aplikasi, pastikan komputer Anda sudah terinstal:
- [Node.js](https://nodejs.org/) (Versi 18 ke atas)
- [ngrok](https://ngrok.com/) (Hanya untuk pengujian lokal di aplikasi Discord)

---

## 📦 Langkah 1: Instalasi Dependensi (Lokal)
Buka terminal/command prompt di direktori project `wise-tv` dan jalankan perintah berikut:
```bash
# Untuk Windows PowerShell:
npm.cmd install ; npm.cmd install --prefix client ; npm.cmd install --prefix server

# Untuk Linux / Mac / CMD standard:
npm install && npm install --prefix client && npm install --prefix server
```

---

## ⚙️ Langkah 2: Setup Discord Developer Portal
Untuk mengaktifkan fitur Activity dan Bot di Discord, ikuti langkah berikut:

1. Buka [Discord Developer Portal](https://discord.com/developers/applications) dan login.
2. Klik **New Application**, beri nama (misal: `Wise TV`), lalu klik **Create**.
3. **Konfigurasi Bot**:
   - Masuk ke menu **Bot** di sidebar kiri.
   - Klik **Reset Token** untuk mendapatkan Bot Token Anda. Salin token ini ke `.env` sebagai `DISCORD_TOKEN`.
   - Di bagian **Privileged Gateway Intents**, aktifkan **Guild Members Intent**, **Presence Intent**, dan **Message Content Intent**. Klik *Save Changes*.
4. **Konfigurasi Client ID & Secret**:
   - Masuk ke menu **OAuth2** -> **General**.
   - Salin **Client ID** ke `.env` sebagai `DISCORD_CLIENT_ID`.
   - Klik **Reset Secret** untuk menyalin **Client Secret** ke `.env` sebagai `DISCORD_CLIENT_SECRET`.
5. **Dapatkan Guild ID (Opsional, untuk test cepat)**:
   - Aktifkan Developer Mode di Discord Anda (User Settings -> Advanced -> Developer Mode).
   - Klik kanan server Discord Anda, lalu klik **Copy Server ID**. Taruh di `.env` sebagai `DISCORD_GUILD_ID` agar slash command bot terdaftar instan untuk server testing Anda.

---

## 🌐 Langkah 3: Setup Terowongan (Tunneling) Lokal dengan ngrok
Karena Discord Activity berjalan di dalam iframe aman (HTTPS) milik Discord, Anda tidak bisa memuat URL `http://localhost:3000` secara langsung. Kita membutuhkan ngrok untuk membuat link HTTPS sementara:

1. Jalankan ngrok di terminal Anda:
   ```bash
   ngrok http 3000
   ```
2. ngrok akan memberikan URL HTTPS publik (contoh: `https://abcd-123.ngrok-free.app`). Salin URL tersebut.
3. Kembali ke Discord Developer Portal, buka menu **Embedded Application**.
4. Aktifkan fitur Activity dengan mengisi data nama aplikasi dan deskripsi.
5. Di bagian **URL Mappings**, klik **Add Mapping**:
   - **Prefix**: Ubah menjadi `http://localhost:3000` (atau biarkan kosong jika Anda menggunakan setup terbaru).
   - **Target**: Masukkan URL HTTPS dari ngrok tadi (contoh: `https://abcd-123.ngrok-free.app`).
6. Klik *Save Changes*.

---

## 🚀 Langkah 4: Menjalankan Aplikasi di Lokal
1. Pastikan file `.env` sudah terisi dengan lengkap:
   ```env
   DISCORD_TOKEN=TokenBotAnda
   DISCORD_CLIENT_ID=ClientIDAnda
   DISCORD_CLIENT_SECRET=ClientSecretAnda
   DISCORD_GUILD_ID=GuildIDServerAnda
   PORT=3000
   ```
2. Jalankan build frontend terlebih dahulu:
   ```bash
   # Di root direktori wise-tv
   npm run build
   ```
3. Mulai server backend dan bot:
   ```bash
   npm start
   ```
4. **Undang Bot ke Server Anda**:
   - Di Developer Portal, masuk ke **OAuth2** -> **URL Generator**.
   - Pilih scope: `bot` dan `applications.commands`.
   - Pilih permissions bot: `Send Messages`, `Embed Links`, `Use External Emojis`, `Connect`, `Speak`.
   - Salin link generator di bagian bawah, buka di browser Anda, dan undang bot ke server Anda.

5. **Mulai Nonton**:
   - Masuk ke salah satu **Voice Channel** di Discord Anda.
   - Di chat, ketik slash command: `/nonton`.
   - Discord akan meluncurkan panel **Wise TV** di voice channel Anda secara otomatis, dan bot akan memposting **Remote Control** di text channel!
   - Tekan tombol atau gunakan dropdown pada Remote Control untuk mengganti siaran secara real-time.

---

## ☁️ Langkah 5: Deploy ke Render (24/7 Gratis Tanpa Kartu Kredit)
Untuk membuat bot ini aktif 24 jam gratis tanpa perlu menyalakan komputer Anda:

1. Unggah seluruh isi folder `wise-tv` ke akun **GitHub** pribadi Anda (pastikan file `.env` tidak ikut diunggah, masukkan `.env` ke `.gitignore`).
2. Masuk ke [Render](https://render.com/) menggunakan akun GitHub Anda.
3. Klik **New +** -> **Web Service**.
4. Pilih repositori GitHub `wise-tv` Anda.
5. Konfigurasikan Web Service:
   - **Name**: `wise-tv-bot`
   - **Environment**: `Node`
   - **Region**: Pilih yang terdekat (misal: Singapore)
   - **Branch**: `main`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free`
6. Buka bagian **Advanced** dan tambahkan **Environment Variables** (sama seperti isi `.env` Anda):
   - `DISCORD_TOKEN`
   - `DISCORD_CLIENT_ID`
   - `DISCORD_CLIENT_SECRET`
   - `PORT` = `3000`
7. Klik **Deploy Web Service**.
8. Setelah deployment sukses, Render akan memberikan URL HTTPS permanen (contoh: `https://wise-tv.onrender.com`).
9. Masuk kembali ke Discord Developer Portal -> **Embedded Application** dan ganti URL target di **URL Mappings** dari ngrok tadi dengan URL dari Render ini!

---

## ⏰ Langkah 6: Mencegah Server Render "Tidur" Menggunakan UptimeRobot (100% Gratis)
Render Free Tier akan menonaktifkan server (*sleep*) jika tidak ada traffic web selama 15 menit. Kita bisa menggunakan UptimeRobot agar server tetap bangun 24/7:

1. Daftar akun gratis di [UptimeRobot](https://uptimerobot.com/).
2. Klik **Add New Monitor**:
   - **Monitor Type**: `HTTPS`
   - **Friendly Name**: `Wise TV Bot Keeper`
   - **URL (or IP)**: Masukkan URL web service Render Anda (contoh: `https://wise-tv.onrender.com/api/channels/featured`).
   - **Monitoring Interval**: Setiap `5 minutes`.
3. Klik **Create Monitor**.
4. Selesai! UptimeRobot akan mengirim ping kecil ke bot Anda setiap 5 menit. Server Render Anda tidak akan pernah tidur, dan bot Discord Anda akan aktif 24/7 responsif!
