# Panduan Deploy DocMatch ke VPS (`docmatch.solusiaplikasi.id`)

Panduan ini disiapkan khusus untuk menghubungkan repositori GitHub **`Muhamad-SazidanA/TVS-Middleware`** ke folder **`/root/docmatch`** di VPS dan mempublikasikannya ke **`https://docmatch.solusiaplikasi.id`** tanpa bentrok dengan aplikasi lain yang sudah berjalan di VPS (`app.spensify.ai`, `Brilian.Ai`, dll.).

> **Port Default:** DocMatch berjalan di **`127.0.0.1:3100`** (internal VPS di belakang Nginx) dan database MySQL berjalan terisolasi di container `docmatch-db` tanpa membuka port `3306` ke publik/host.

---

## Ringkasan File yang Sudah Disiapkan

| File | Fungsi |
| --- | --- |
| `Dockerfile` & `.dockerignore` | Build image produksi Next.js + Prisma (multi-stage, Node 20) |
| `docker-compose.yml` | Menjalankan `docmatch-app` (`127.0.0.1:3100`) + `docmatch-db` (`mysql:8.0`) beserta persistent volume untuk DB, `public/uploads`, dan `src/config` |
| `deploy/docker-entrypoint.sh` | Sinkronisasi schema Prisma (`prisma db push`) otomatis saat container start |
| `ecosystem.config.cjs` | Alternatif menjalankan aplikasi dengan PM2 (tanpa Docker) |
| `deploy/nginx-docmatch.conf` | Konfigurasi Nginx reverse proxy untuk `docmatch.solusiaplikasi.id` (upload max 100 MB, timeout 300s) |
| `deploy/deploy.sh` | Script deploy otomatis (`git pull`, build/restart Docker atau PM2, dan healthcheck) |
| `.github/workflows/deploy-vps.yml` | GitHub Actions CI/CD: verifikasi typecheck & build, lalu auto-deploy ke `/root/docmatch` setiap push ke `master` |
| `.env.production.example` | Template `.env` produksi untuk VPS |

---

## 1. Arahkan DNS Domain ke IP VPS

Di panel DNS `solusiaplikasi.id` (Cloudflare / DNS registrar), buat **A Record**:

- **Type:** `A`
- **Name:** `docmatch` (menghasilkan `docmatch.solusiaplikasi.id`)
- **IPv4 Address:** `<IP_PUBLIC_VPS_ANDA>`
- **Proxy:** DNS Only terlebih dahulu saat setup Certbot SSL (bisa diaktifkan Proxied setelah SSL aktif)

---

## 2. Hubungkan GitHub ke Folder `/root/docmatch` di VPS

Masuk ke VPS via SSH, lalu siapkan SSH Deploy Key agar VPS dapat `git pull` dari GitHub:

```bash
# 1. Buat SSH key khusus repo DocMatch di VPS (jika belum punya)
ssh-keygen -t ed25519 -C "vps-docmatch" -f ~/.ssh/github_docmatch -N ""

# 2. Tampilkan public key lalu copy seluruh output-nya
cat ~/.ssh/github_docmatch.pub
```

Tambahkan public key tersebut ke GitHub:
- Buka **`https://github.com/Muhamad-SazidanA/TVS-Middleware/settings/keys`**
- Klik **Add deploy key**, beri nama misal `VPS DocMatch`, tempel public key, lalu simpan.

Konfigurasikan SSH host alias di VPS dan tarik kode ke `/root/docmatch`:

```bash
cat <<'EOF' >> ~/.ssh/config

Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/github_docmatch
  IdentitiesOnly yes
EOF
chmod 600 ~/.ssh/config

# Karena folder /root/docmatch sudah ada di VPS:
cd /root/docmatch
git init
git remote add origin git@github.com:Muhamad-SazidanA/TVS-Middleware.git
git fetch origin
git checkout -b master origin/master
```

*(Jika menggunakan HTTPS publik, Anda juga bisa memakai `https://github.com/Muhamad-SazidanA/TVS-Middleware.git`, namun SSH Deploy Key wajib agar auto-deploy berjalan tanpa password.)*

---

## 3. Buat File `.env` Produksi di `/root/docmatch/.env`

```bash
cd /root/docmatch
cp .env.production.example .env

# Generate AUTH_SECRET acak:
openssl rand -base64 32
```

Edit `/root/docmatch/.env` (`nano .env`) dan sesuaikan nilai berikut:
- `AUTH_SECRET` -> isi hasil `openssl rand -base64 32`
- `AUTH_URL="https://docmatch.solusiaplikasi.id"`
- `AUTH_TRUST_HOST="true"`
- `MYSQL_ROOT_PASSWORD` & `MYSQL_PASSWORD` -> ganti dengan password kuat
- `DATABASE_URL="mysql://docmatch:<PASSWORD_SAMA_DENGAN_MYSQL_PASSWORD>@docmatch-db:3306/docmatch"`
- `NANONETS_API_KEY` & `API_KEY` -> isi API key Nanonets aktif Anda

---

## 4. Jalankan Aplikasi di VPS

### Opsi A — Docker Compose (Direkomendasikan)

Database MySQL dan aplikasi Next.js terisolasi sepenuhnya:

```bash
cd /root/docmatch
mkdir -p public/uploads
docker compose up -d --build
```

Cek status & log startup:

```bash
docker compose ps
docker compose logs -f docmatch-app
```

Seed akun pengguna awal database (cukup sekali saat pertama kali setup, lihat daftar akun pada `scripts/seed.mjs`):

```bash
docker compose exec docmatch-app npm run db:seed
```

### Opsi B — PM2 + MySQL Host (Tanpa Docker)

Jika ingin memakai MySQL lokal host VPS & PM2 (`pm2` sudah terpasang):
1. Ubah `DATABASE_URL` di `/root/docmatch/.env` ke host `127.0.0.1:3306` dan pastikan database `docmatch` sudah dibuat di MySQL host.
2. Jalankan:
   ```bash
   cd /root/docmatch
   bash deploy/deploy.sh --pm2 --seed
   ```

---

## 5. Pasang Nginx Reverse Proxy & SSL HTTPS (`docmatch.solusiaplikasi.id`)

```bash
cp /root/docmatch/deploy/nginx-docmatch.conf /etc/nginx/sites-available/docmatch.solusiaplikasi.id
ln -sf /etc/nginx/sites-available/docmatch.solusiaplikasi.id /etc/nginx/sites-enabled/docmatch.solusiaplikasi.id

nginx -t && systemctl reload nginx

# Pasang sertifikat SSL Let's Encrypt otomatis:
certbot --nginx -d docmatch.solusiaplikasi.id
```

Pastikan `https://docmatch.solusiaplikasi.id/login` sudah bisa dibuka di browser!

---

## 6. Hubungkan Webhook Nanonets

Di dashboard Nanonets, arahkan Webhook URL ke domain produksi:
- **`https://docmatch.solusiaplikasi.id/api/webhooks/nanonets`**

---

## 7. Aktifkan Auto-Deploy dari GitHub Actions (Opsional, Sekali Klik)

Workflow [`.github/workflows/deploy-vps.yml`](.github/workflows/deploy-vps.yml) sudah disiapkan agar setiap kali ada `git push` ke branch `master`, GitHub otomatis menjalankan typecheck + build lalu SSH ke `/root/docmatch` menjalankan `bash deploy/deploy.sh`.

Siapkan SSH key untuk GitHub Actions di VPS:

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/gh_actions_docmatch -N ""
cat ~/.ssh/gh_actions_docmatch.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

# Salin PRIVATE KEY ini untuk dimasukkan ke GitHub Secret VPS_SSH_KEY:
cat ~/.ssh/gh_actions_docmatch
```

Buka **`https://github.com/Muhamad-SazidanA/TVS-Middleware/settings/secrets/actions`**, tambahkan **Repository secrets**:

| Name | Contoh Value | Wajib |
| --- | --- | --- |
| `VPS_HOST` | IP VPS Anda (misal `103.xxx.xxx.xxx`) | Ya |
| `VPS_USER` | `root` | Ya |
| `VPS_SSH_KEY` | Isi seluruh private key dari `~/.ssh/gh_actions_docmatch` | Ya |
| `VPS_PORT` | `22` (jika port SSH non-standar) | Opsional |
| `VPS_APP_DIR` | `/root/docmatch` | Opsional |
| `DEPLOY_MODE` | `docker` atau `pm2` (default `auto`) | Opsional |

Setelah secrets diisi, deploy manual kapan saja dari tab **Actions -> Verify & Deploy DocMatch to VPS -> Run workflow**, atau cukup `git push origin master`.
