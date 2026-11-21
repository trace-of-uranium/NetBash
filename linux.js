(()=>{
const C=window.LINUX_CONFIG,sc=document.getElementById('screen'),msg=document.getElementById('linuxmsg');let started=false;
const exists=async u=>{try{return(await fetch(u,{method:'HEAD'})).ok}catch(e){return false}};
const load=src=>new Promise((res,rej)=>{const s=document.createElement('script');s.src=src;s.onload=res;s.onerror=()=>rej(new Error('Could not load '+src));document.head.appendChild(s)});
window.startLinux=async()=>{
  if(started)return;
  if(location.protocol==='file:'){msg.textContent='This tab needs the folder to be served over http(s) (for example GitHub Pages or "python3 -m http.server"). Opening index.html directly from disk cannot load the Linux files. The Simulated shell tab still works.';return}
  const miss=[];for(const u of [C.lib,C.wasm,C.bios,C.vgabios,...(C.imageType==='kernel'?[C.kernel,C.initrd]:[C.image])])if(!await exists(u))miss.push(u);
  if(miss.length){msg.textContent='Missing files:\n  '+miss.join('\n  ')+'\n\nAdd them as described in README.md, then reload.';return}
  try{await load(C.lib)}catch(e){msg.textContent=e.message;return}
  const V=window.V86||window.V86Starter;
  if(!V){msg.textContent='libv86.js loaded, but no V86 constructor was found. Your v86 version may differ; see README.md.';return}
  const o={wasm_path:C.wasm,memory_size:C.memoryMB*1048576,vga_memory_size:8*1048576,screen_container:sc,bios:{url:C.bios},vga_bios:{url:C.vgabios},autostart:true};
  if(C.imageType==='kernel'){o.bzimage={url:C.kernel};o.initrd={url:C.initrd};o.cmdline=C.cmdline}else o[C.imageType]={url:C.image};if(C.relay)o.network_relay_url=C.relay;
  try{window.emulator=new V(o);started=true;msg.textContent='Booting. Click the screen, then type. Alpine live images log in as root with no password.'}catch(e){msg.textContent='Emulator failed to start: '+e.message}
};
window.linuxKeys=on=>{try{window.emulator&&window.emulator.keyboard_set_status&&window.emulator.keyboard_set_status(on)}catch(e){}};
})();
