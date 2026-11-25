# Panduan Deploy DocMatch ke VPS (`docmatch.solusiaplikasi.id`)

Panduan ini disiapkan khusus untuk menghubungkan repositori GitHub **`Muhamad-SazidanA/TVS-Middleware`** ke folder **`/root/docmatch`** di VPS dan mempublikasikannya ke **`https://docmatch.solusiaplikasi.id`** tanpa bentrok dengan aplikasi lain yang sudah berjalan di VPS (`app.spensify.ai`, `uti-spensify`, `Brilian.Ai`, `traefik`).

> **Port & Database Default:** DocMatch berjalan di **`127.0.0.1:3100`** (aman dari port terpakai `3000`, `3001`, `9000`, `80`, `443`) dan database **PostgreSQL 16** berjalan terisolasi di container `docmatch-db` tanpa membuka port `5432` ke host/publik.

---

## Ringkasan File yang Sudah Disiapkan

| File | Fungsi |
| --- | --- |
| `Dockerfile` & `.dockerignore` | Build image produksi Next.js + Prisma (multi-stage, Node 20) |
| `docker-compose.yml` | Menjalankan `docmatch-app` (`127.0.0.1:3100`) + `docmatch-db` (`postgres:16-alpine`) beserta persistent volume untuk DB, `public/uploads`, dan `src/config` |
| `deploy/docker-entrypoint.sh` | Sinkronisasi schema Prisma (`prisma db push`) otomatis saat container start |
| `ecosystem.config.cjs` | Alternatif menjalankan aplikasi dengan PM2 (tanpa Docker) |
| `deploy/nginx-docmatch.conf` | Template Nginx reverse proxy (hanya dipakai jika port 80/443 memakai Nginx, **bukan** Traefik) |
| `deploy/deploy.sh` | Script deploy otomatis (`git pull`, build/restart Docker atau PM2, dan healthcheck) |
| `.github/workflows/deploy-vps.yml` | GitHub Actions CI/CD: verifikasi typecheck & build, lalu auto-deploy ke `/root/docmatch` setiap push ke `master` |
| `.env.production.example` | Template `.env` produksi untuk VPS |

---

## 1. Arahkan DNS Domain ke IP VPS

Di panel DNS `solusiaplikasi.id`, buat **A Record**:

- **Type:** `A`
- **Name:** `docmatch` (menghasilkan `docmatch.solusiaplikasi.id`)
- **IPv4 Address:** `<IP_PUBLIC_VPS_ANDA>`

---

## 2. Hubungkan GitHub ke Folder `/root/docmatch` di VPS

Masuk ke VPS via SSH, lalu siapkan SSH Deploy Key dengan Host alias `github-docmatch` (agar tidak bentrok dengan repo lain di VPS):

```bash
ssh-keygen -t ed25519 -C "vps-docmatch" -f ~/.ssh/github_docmatch -N ""
cat ~/.ssh/github_docmatch.pub
```

Tambahkan public key ke **`https://github.com/Muhamad-SazidanA/TVS-Middleware/settings/keys`** (**Add deploy key**), lalu jalankan di VPS:

```bash
printf "\nHost github-docmatch\n  HostName github.com\n  User git\n  IdentityFile ~/.ssh/github_docmatch\n  IdentitiesOnly yes\n" >> ~/.ssh/config
chmod 600 ~/.ssh/config
ssh -T git@github-docmatch

cd /root/docmatch
git init
git remote add origin git@github-docmatch:Muhamad-SazidanA/TVS-Middleware.git
git fetch origin
git checkout -b master origin/master
```

Untuk update berikutnya cukup jalankan:
```bash
cd /root/docmatch && git pull origin master
```

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
- `DOCMATCH_PORT="3100"`
- `POSTGRES_DB="docmatch"`, `POSTGRES_USER="docmatch"`
- `POSTGRES_PASSWORD` -> ganti dengan password kuat
- `DATABASE_URL="postgresql://docmatch:<PASSWORD_SAMA_DENGAN_POSTGRES_PASSWORD>@docmatch-db:5432/docmatch?schema=public"`
- `NANONETS_API_KEY` & `API_KEY` -> isi API key Nanonets aktif Anda

---

## 4. Jalankan Aplikasi di VPS

### Opsi A — Docker Compose (Direkomendasikan)

Database PostgreSQL 16 dan aplikasi Next.js terisolasi sepenuhnya:

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

Test lokal di VPS:
```bash
curl -I http://127.0.0.1:3100/login
```

### Opsi B — PM2 + PostgreSQL Host (Tanpa Docker)

Jika ingin memakai PostgreSQL lokal host & PM2:
1. Ubah `DATABASE_URL` di `/root/docmatch/.env` ke host `127.0.0.1:5432` dan pastikan database `docmatch` sudah dibuat di PostgreSQL host.
2. Jalankan:
   ```bash
   cd /root/docmatch
   bash deploy/deploy.sh --pm2 --seed
   ```

---

## 5. Hubungkan Domain `docmatch.solusiaplikasi.id` (Traefik vs Nginx)

> **PENTING:** Jika port `80` dan `443` di VPS Anda dipegang oleh **Traefik** (`docker ps` menunjukkan container `traefik`), **JANGAN** install atau menyalakan Nginx karena akan bentrok port `80`/`443`.
> Gunakan konfigurasi Traefik (tambahkan network & labels Traefik ke `docker-compose.yml` sesuai config Traefik di VPS Anda).

Jika VPS belum memakai reverse proxy lain dan memakai Nginx:
```bash
cp /root/docmatch/deploy/nginx-docmatch.conf /etc/nginx/sites-available/docmatch.solusiaplikasi.id
ln -sf /etc/nginx/sites-available/docmatch.solusiaplikasi.id /etc/nginx/sites-enabled/docmatch.solusiaplikasi.id
nginx -t && systemctl reload nginx
certbot --nginx -d docmatch.solusiaplikasi.id
```

---

## 6. Hubungkan Webhook Nanonets

Di dashboard Nanonets, arahkan Webhook URL ke domain produksi:
- **`https://docmatch.solusiaplikasi.id/api/webhooks/nanonets`**

---

## 7. Auto-Deploy dari GitHub Actions (Opsional)

Workflow [`.github/workflows/deploy-vps.yml`](.github/workflows/deploy-vps.yml) menjalankan typecheck & build setiap push ke `master`, lalu otomatis deploy ke `/root/docmatch` jika **Repository secrets** (`VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, opsional `VPS_PORT`, `VPS_APP_DIR`) diisi di GitHub Settings -> Secrets and variables -> Actions.
