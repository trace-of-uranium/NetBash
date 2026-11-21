// Settings for the "Real Linux" tab. Change paths here if your file names differ.
window.LINUX_CONFIG={
  lib:'v86/libv86.js',        // v86 emulator script
  wasm:'v86/v86.wasm',        // v86 WebAssembly core
  bios:'bios/seabios.bin',
  vgabios:'bios/vgabios.bin',
  imageType:'kernel',         // 'kernel' = bash image built by build/build-image.sh; or 'cdrom'/'hda' with 'image' below
  kernel:'images/bzImage',
  initrd:'images/rootfs.cpio.gz',
  cmdline:'rdinit=/init console=tty1',
  // image:'images/linux.iso',  // use with imageType 'cdrom' (e.g. Alpine, which uses ash)
  memoryMB:512,
  relay:null                  // optional WebSocket network relay, e.g. 'wss://your-relay.example/'
};
