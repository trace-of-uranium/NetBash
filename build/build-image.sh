#!/bin/bash
# Builds a 32-bit Debian kernel + initramfs with bash preinstalled (runs on a Linux machine or GitHub Actions).
set -euo pipefail
OUT="$PWD/images"; R="$PWD/rootfs"; mkdir -p "$OUT"
sudo apt-get update -qq && sudo apt-get install -y -qq debootstrap cpio
sudo debootstrap --arch=i386 --variant=minbase \
  --include=bash,coreutils,util-linux,procps,grep,sed,gawk,findutils,less,nano,vim-tiny,tar,gzip,bzip2,xz-utils,file,iproute2,iputils-ping,curl,ca-certificates,apt,dpkg \
  bookworm "$R" http://deb.debian.org/debian
# Download (do not install) the kernel package, then unpack just the kernel file.
sudo chroot "$R" apt-get install -y --no-install-recommends --download-only linux-image-686
K=$(sudo sh -c 'ls "'"$R"'"/var/cache/apt/archives/linux-image-[0-9]*-686_*.deb' | grep -v dbg | head -1)
echo "Kernel package: $K"
sudo rm -rf kx; mkdir kx; sudo dpkg-deb -x "$K" kx
sudo cp kx/boot/vmlinuz-* "$OUT/bzImage"; sudo chown "$(id -u):$(id -g)" "$OUT/bzImage"
sudo chroot "$R" apt-get clean
sudo rm -rf "$R"/boot/* "$R"/lib/modules/* "$R"/usr/share/doc "$R"/usr/share/man "$R"/usr/share/locale "$R"/var/lib/apt/lists/*
sudo tee "$R/init" >/dev/null <<'EOF'
#!/bin/bash
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin HOME=/root TERM=linux
mount -t proc proc /proc; mount -t sysfs sys /sys; mount -t devtmpfs dev /dev 2>/dev/null
mkdir -p /dev/pts /tmp; mount -t devpts devpts /dev/pts; mount -t tmpfs tmpfs /tmp
hostname browser; cd /root
echo "Debian $(cat /etc/debian_version), bash $BASH_VERSION - running in your browser"
while true; do setsid -c /bin/bash -l </dev/tty1 >/dev/tty1 2>&1; done
EOF
sudo chmod +x "$R/init"
(cd "$R" && sudo find . | sudo cpio -o -H newc 2>/dev/null | gzip -9) > "$OUT/rootfs.cpio.gz"
ls -lh "$OUT"
[ "$(stat -c %s "$OUT/rootfs.cpio.gz")" -lt 99000000 ] || { echo "rootfs too big for GitHub (100 MB limit)"; exit 1; }
