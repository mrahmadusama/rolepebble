# Deploying Dossier on job.mrahmadusama.com

On an **AWS EC2** server paid for by the AWS Free Tier credits, with Docker Compose and Caddy for HTTPS. Everything in this folder:

| File | What it is |
| --- | --- |
| `compose.yml` | PostgreSQL, the app, and Caddy (or a Cloudflare Tunnel) |
| `Caddyfile` | HTTPS for `$DOSSIER_DOMAIN`, forwarding to the app |
| `env.example` | The settings, to copy to `.env` |
| `setup-server.sh` | Installs Docker and adds swap on a fresh Ubuntu server |

## What it costs

New AWS accounts on the **Free plan** get $100 in credits at sign-up and up to $100 more for trying a few services. The plan ends after **6 months** or when the credits run out, whichever comes first; until then nothing is charged to your card.

A `t3.small` (2 vCPUs, 2 GB) with 20 GB of disk and a public IP comes to roughly **$20 a month** (about $15 for the server, $3.60 for the IPv4 address, $1.60 for the disk; a little more in some regions). So $100 lasts about 5 months, and the extra credits cover the rest of the 6.

After that AWS closes the account unless you upgrade it to the Paid plan, and the same server then costs about $20 a month. Before then, export your data (Settings → Your data) or move it to a cheaper server; this folder works anywhere with Docker.

## 1. Create the server

1. Sign up at [aws.amazon.com/free](https://aws.amazon.com/free) and choose the **Free plan**.
2. Pick the region closest to you (top right of the console), then **EC2 → Launch instance**:
   - Name: `dossier`
   - Image: **Ubuntu Server 24.04 LTS**, architecture **64-bit (x86)**
   - Instance type: **t3.small** (marked free tier eligible)
   - Key pair: **Create new key pair** (ED25519, `.pem`), and keep the downloaded file
   - Network settings → **Edit** → security group with three rules:
     - SSH, port 22, source **My IP**
     - HTTP, port 80, source **Anywhere**
     - HTTPS, port 443, source **Anywhere**
   - Storage: **20 GiB gp3** (the default 8 GiB is too small for the image)
3. **Launch instance**.
4. Give it a fixed address, so the domain keeps working after a stop and start: **EC2 → Elastic IPs → Allocate Elastic IP address**, then **Actions → Associate**, and pick the `dossier` instance. Note the IP.

## 2. Point the domain at it

At your domain's DNS provider, add:

| Type | Name | Value |
| --- | --- | --- |
| A | `job` | the Elastic IP |

If the domain is on Cloudflare, set the record to **DNS only** (grey cloud) so Caddy can get the certificate. Check with `dig +short job.mrahmadusama.com`.

## 3. Install and start

On your computer, with the key file you downloaded:

```bash
chmod 400 ~/Downloads/dossier.pem
ssh -i ~/Downloads/dossier.pem ubuntu@<elastic-ip>
```

On the server:

```bash
git clone https://github.com/mrahmadusama/dossier.git
cd dossier
sh deploy/setup-server.sh
exit
```

Log back in (so the `docker` group applies). Then fetch the app's image, make the secrets, and hash your password:

```bash
cd dossier/deploy
docker pull ghcr.io/mrahmadusama/dossier:main
docker tag ghcr.io/mrahmadusama/dossier:main dossier:local
cp env.example .env
sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(openssl rand -hex 24)|" .env
sed -i "s|^DOSSIER_SECRET=.*|DOSSIER_SECRET=$(openssl rand -base64 32)|" .env
docker run --rm -it dossier:local hash-password
```

The image is RolePebble's own, which CI builds and publishes each time a change lands on `main`; building it on a 2 GB server is slow. To try a branch that isn't merged yet, build it here instead with `docker compose build app` (expect 15–20 minutes on a `t3.small`).

`hash-password` asks for your sign-in password twice and prints one line starting with `argon2id:`. Put it in `.env` as `DOSSIER_PASSWORD=argon2id:…` (`nano .env`), and set `TZ` to your time zone (for example `Asia/Karachi`) while you're there. Then:

```bash
docker compose up -d
docker compose logs -f app caddy
```

Once the app logs that it's ready and Caddy that it obtained the certificate, open **https://job.mrahmadusama.com**, sign in, and choose an AI model in **Settings → AI provider**.

## Keeping an eye on the credits

**Billing and Cost Management → Free Tier** shows the credits left and the days remaining. AWS also emails you as they run low.

## Updating

```bash
cd ~/dossier/deploy
docker pull ghcr.io/mrahmadusama/dossier:main
docker tag ghcr.io/mrahmadusama/dossier:main dossier:local
docker compose up -d
docker image prune -f
```

Migrations run when the app starts.

## Backups

The app writes nightly backups to the `data` volume (Settings → Your data also exports everything as one file). For a database dump you can copy off the server:

```bash
docker compose exec -T db pg_dump -U dossier dossier | gzip > dossier-$(date +%F).sql.gz
```

and on your computer: `scp -i ~/Downloads/dossier.pem ubuntu@<elastic-ip>:dossier/deploy/dossier-*.sql.gz .`

## Alternative: a home machine with Cloudflare Tunnel

No cloud server and no open ports: run it on any always-on machine (an old laptop, a Raspberry Pi 4/5 with 4 GB+, a home server). This needs the domain's DNS on Cloudflare (free plan).

1. Cloudflare dashboard → **Zero Trust → Networks → Tunnels → Create a tunnel** (Cloudflared). Copy its token.
2. Under **Public hostnames**, add `job.mrahmadusama.com` → service `HTTP`, URL `app:3000`.
3. In `.env`, set `COMPOSE_PROFILES=tunnel` and `CLOUDFLARE_TUNNEL_TOKEN=<token>`, then follow step 3 above (on macOS, use Docker Desktop instead of `setup-server.sh`; on an ARM machine, build the image with `docker compose build app`, since the published one is x86 only).

Caddy isn't started in this mode; Cloudflare serves HTTPS.
