#!/usr/bin/env bash
# Obtain (or renew) Let's Encrypt certificate and reload Nginx.
# Requires DOMAIN, CERTBOT_EMAIL in .env and DNS A record pointing to this VPS.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

COMPOSE="docker compose -f docker-compose.prod.yml"

if [[ ! -f .env ]]; then
  echo "ERROR: .env not found."
  exit 1
fi

# shellcheck disable=SC1091
set -a && source .env && set +a

: "${DOMAIN:?Set DOMAIN in .env}"
: "${CERTBOT_EMAIL:?Set CERTBOT_EMAIL in .env}"

data_path="./deploy/certbot"
rsa_key_size=4096
staging="${CERTBOT_STAGING:-0}"

if [[ ! -e "$data_path/conf/options-ssl-nginx.conf" ]] || [[ ! -e "$data_path/conf/ssl-dhparams.pem" ]]; then
  echo "==> Downloading TLS options for Nginx..."
  mkdir -p "$data_path/conf"
  curl -fsSL \
    https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf \
    -o "$data_path/conf/options-ssl-nginx.conf"
  curl -fsSL \
    https://raw.githubusercontent.com/certbot/certbot/master/certbot/certbot/ssl-dhparams.pem \
    -o "$data_path/conf/ssl-dhparams.pem"
fi

if [[ ! -d "$data_path/conf/live/$DOMAIN" ]]; then
  echo "==> Creating dummy certificate for $DOMAIN (nginx startup)..."
  mkdir -p "$data_path/conf/live/$DOMAIN"
  openssl req -x509 -nodes -newkey "rsa:$rsa_key_size" -days 1 \
    -keyout "$data_path/conf/live/$DOMAIN/privkey.pem" \
    -out "$data_path/conf/live/$DOMAIN/fullchain.pem" \
    -subj "/CN=$DOMAIN"
fi

echo "==> Starting nginx..."
$COMPOSE up -d nginx

staging_arg=""
if [[ "$staging" != "0" ]]; then
  staging_arg="--staging"
fi

echo "==> Requesting certificate from Let's Encrypt..."
$COMPOSE run --rm --entrypoint certbot certbot certonly --webroot -w /var/www/certbot \
  --email "$CERTBOT_EMAIL" \
  --agree-tos \
  --no-eff-email \
  $staging_arg \
  -d "$DOMAIN"

echo "==> Reloading nginx..."
$COMPOSE exec nginx nginx -s reload

echo "==> Certificate ready for https://$DOMAIN"
