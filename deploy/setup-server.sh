#!/bin/sh
# One-time setup of a fresh Ubuntu server for Dossier (see deploy/README.md):
# Docker with its Compose plugin, swap on a small server, and ports 80 and
# 443 open in the server's own firewall. Oracle Cloud's Ubuntu images reject
# everything but SSH in iptables, on top of the VCN's security list, so both
# need opening there; AWS's images don't, and that step is skipped.
#
#   sh deploy/setup-server.sh
set -eu

if ! command -v docker > /dev/null; then
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"
  echo "Docker installed. Log out and back in once, so 'docker' works without sudo."
fi

# 2 GB of swap on servers with under 4 GB of memory (a t3.small has 2 GB), so a
# burst of PDFs next to PostgreSQL doesn't run it out of memory.
if [ "$(awk '/MemTotal/ { print $2 }' /proc/meminfo)" -lt 4000000 ] && [ -z "$(swapon --show)" ]; then
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab > /dev/null
  echo "Added 2 GB of swap."
fi

if command -v iptables > /dev/null && sudo iptables -S INPUT | grep -q REJECT; then
  sudo iptables -I INPUT -p tcp -m multiport --dports 80,443 -j ACCEPT
  sudo iptables -I INPUT -p udp --dport 443 -j ACCEPT
  if command -v netfilter-persistent > /dev/null; then
    sudo netfilter-persistent save
  fi
  echo "Opened ports 80 and 443 in iptables."
fi
