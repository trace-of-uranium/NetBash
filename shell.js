const $t=document.getElementById('t'),$log=document.getElementById('log'),$in=document.getElementById('in'),$pr=document.getElementById('pr'),$row=document.getElementById('row');
const has=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const D=c=>({t:'d',c}),F=d=>({t:'f',d});
class Ctl{constructor(k,v){this.k=k;this.v=v}}
/* ---------- virtual filesystem (persisted in localStorage) ---------- */
function seed(){return D({home:D({user:D({
'notes.txt':F('apple\nbanana\ncherry\nbanana\napple\nbanana\n'),
'demo.sh':F(`#!/bin/bash
greet() { echo "Hello, $1!"; }
for n in Ada Linus Grace; do greet "$n"; done
count=0
while [ $count -lt 3 ]; do count=$((count+1)); done
echo "count=$count"
`)})}),tmp:D({}),etc:D({motd:F('Welcome to bash in a browser.\n')})})}
let root=null;try{root=JSON.parse(localStorage.getItem('bashfs'))}catch(e){}
if(!root||root.t!=='d')root=seed();
const save=()=>{try{localStorage.setItem('bashfs',JSON.stringify(root))}catch(e){}};
const sh={env:{HOME:'/home/user',USER:'user',PWD:'/home/user',PATH:'/bin',SHELL:'/bin/bash',HOSTNAME:'browser',IFS:' \t\n'},funcs:{},st:0,pos:[],hist:[],int:false,n:0,depth:0};
function abs(p){if(p==='~'||p.startsWith('~/'))p=sh.env.HOME+p.slice(1);const o=[];for(const s of(p[0]==='/'?p:sh.env.PWD+'/'+p).split('/')){if(!s||s==='.')continue;s==='..'?o.pop():o.push(s)}return'/'+o.join('/')}
function node(p){let n=root;for(const s of abs(p).split('/').filter(Boolean)){if(n.t!=='d'||!has(n.c,s))return null;n=n.c[s]}return n}
const prot=p=>/^\/(etc|bin|usr|var|root|boot)(\/|$)/.test(abs(p));
function parent(p){if(prot(p)&&sh.env.USER!=='root')throw new Error(p+': Permission denied');const a=abs(p).split('/').filter(Boolean),nm=a.pop(),pn=node('/'+a.join('/'));return[pn&&pn.t==='d'?pn:null,nm]}
function wr(p,data,app){if(abs(p)==='/dev/null')return;const[pn,nm]=parent(p);if(!pn||!nm)throw new Error(p+': No such file or directory');let f=has(pn.c,nm)?pn.c[nm]:null;if(f&&f.t==='d')throw new Error(p+': Is a directory');if(!f)f=pn.c[nm]=F('');f.d=app?f.d+data:data;save()}
function rd(p){const n=node(p);if(!n)throw new Error(p+': No such file or directory');if(n.t==='d')throw new Error(p+': Is a directory');return n.d}
const esc=c=>c.replace(/[.*+?^${}()|[\]\\\/]/g,'\\$&');
function gsrc(p){let o='';for(let i=0;i<p.length;i++){const c=p[i];if(c==='\\')o+=esc(p[++i]||'\\');else if(c==='*')o+='.*';else if(c==='?')o+='.';else if(c==='['){const j=p.indexOf(']',i+2);if(j>0){o+='['+p.slice(i+1,j).replace(/^!/,'^').replace(/\\/g,'\\\\')+']';i=j}else o+='\\['}else o+=esc(c)}return o}
function glob(pat){const segs=pat.split('/').filter(Boolean);let bases=[pat[0]==='/'?'/':''];for(const sg of segs){const nb=[];for(const b of bases){const dir=node(b||'.');if(!dir||dir.t!=='d')continue;const sep=(b===''||b.endsWith('/'))?'':'/';if(/(^|[^\\])[*?\[]/.test(sg)){const re=new RegExp('^'+gsrc(sg)+'$');for(const k of Object.keys(dir.c).sort())if(!(k[0]==='.'&&sg[0]!=='.')&&re.test(k))nb.push(b+sep+k)}else{const k=sg.replace(/\\(.)/g,'$1');if(has(dir.c,k))nb.push(b+sep+k)}}bases=nb}return bases}
/* ---------- lexer ---------- */
function close(s,i){const o=s[i],c=o==='('?')':'}';let d=0;for(let j=i;j<s.length;j++){const x=s[j];if(x==="'"){j=s.indexOf("'",j+1);if(j<0)break}else if(x==='"'){j++;while(j<s.length&&s[j]!=='"'){if(s[j]==='\\')j++;j++}}else if(x==='\\')j++;else if(x===o)d++;else if(x===c&&--d===0)return j}throw{inc:1}}
function lex(s){const T=[],n=s.length;let i=0;
while(i<n){const c=s[i];
if(c===' '||c==='\t'){i++;continue}
if(c==='\\'&&s[i+1]==='\n'){i+=2;continue}
if(c==='#'){while(i<n&&s[i]!=='\n')i++;continue}
if(c==='\n'){T.push({o:'\n'});i++;continue}
const m=s.slice(i).match(/^(\d?>>|\d?>&\d|&>|\d?>|<<<|<|&&|\|\||\||;|&)/);
if(m){T.push({o:m[1]});i+=m[1].length;continue}
let w='';
while(i<n){const ch=s[i];
if(/[\s|&;<>]/.test(ch))break;
if(ch==='\\'){w+=s.substr(i,2);i+=2;continue}
if(ch==="'"){const j=s.indexOf("'",i+1);if(j<0)throw{inc:1};w+=s.slice(i,j+1);i=j+1;continue}
if(ch==='"'){let j=i+1;while(j<n&&s[j]!=='"'){if(s[j]==='\\')j++;else if(s[j]==='$'&&s[j+1]==='(')j=close(s,j+1);j++}if(j>=n)throw{inc:1};w+=s.slice(i,j+1);i=j+1;continue}
if(ch==='`'){const j=s.indexOf('`',i+1);if(j<0)throw{inc:1};w+=s.slice(i,j+1);i=j+1;continue}
if(ch==='$'&&(s[i+1]==='('||s[i+1]==='{')){const j=close(s,i+1);w+=s.slice(i,j+1);i=j+1;continue}
w+=ch;i++}
const fm=w.match(/^([\w.-]+\(\))\{$/);if(fm){T.push({w:fm[1]},{w:'{'})}else T.push({w})}
return T}
/* ---------- parser ---------- */
function parse(T){let p=0;
const synt=t=>new Error("syntax error near unexpected token `"+(t.w??(t.o==='\n'?'newline':t.o))+"'");
const eof=()=>{throw{inc:1}};
const isW=(t,v)=>t&&t.w===v;
const isRed=x=>x&&x.o&&/[<>]/.test(x.o);
const skipNL=()=>{while(T[p]&&(T[p].o==='\n'||T[p].o===';'))p++};
function expect(w){const t=T[p];if(!t)eof();if(t.w!==w)throw synt(t);p++}
function list(stops){const L=[];for(;;){skipNL();const t=T[p];if(!t)break;if(t.w!==undefined&&stops.includes(t.w))break;L.push(andor());if(T[p]&&T[p].o==='&')p++}return L}
function andor(){const l=pipe(),r=[];while(T[p]&&(T[p].o==='&&'||T[p].o==='||')){const op=T[p++].o;while(T[p]&&T[p].o==='\n')p++;if(!T[p])eof();r.push([op,pipe()])}return{l,r}}
function pipe(){const c=[cmd()];while(T[p]&&T[p].o==='|'){p++;while(T[p]&&T[p].o==='\n')p++;if(!T[p])eof();c.push(cmd())}return c}
function rd1(){const x=T[p++];if(/&\d$/.test(x.o))return{o:x.o};const t=T[p];if(!t)eof();if(t.w===undefined)throw synt(t);p++;return{o:x.o,t:t.w}}
function cmd(){const t=T[p];if(!t)eof();if(t.o)throw synt(t);const w=t.w;let n=null;
if(w==='if'){p++;const br=[];let c=list(['then']);expect('then');let b=list(['elif','else','fi']);br.push([c,b]);let el=null;while(isW(T[p],'elif')){p++;c=list(['then']);expect('then');b=list(['elif','else','fi']);br.push([c,b])}if(isW(T[p],'else')){p++;el=list(['fi'])}expect('fi');n={k:'if',br,el}}
else if(w==='while'||w==='until'){p++;const c=list(['do']);expect('do');const b=list(['done']);expect('done');n={k:'while',c,b,neg:w==='until'}}
else if(w==='for'){p++;const v=T[p++]?.w;if(!T[p])eof();let items=null;if(isW(T[p],'in')){p++;items=[];while(T[p]&&T[p].w!==undefined)items.push(T[p++].w)}skipNL();expect('do');const b=list(['done']);expect('done');n={k:'for',v,items,b}}
else if(w==='{'){p++;const b=list(['}']);expect('}');n={k:'grp',b}}
else if(w==='function'||/^[\w.-]+\(\)$/.test(w)||(T[p+1]&&T[p+1].w==='()')){let name=w;p++;if(w==='function'){name=T[p++]?.w;if(!name)eof()}if(T[p]&&T[p].w==='()')p++;name=name.replace(/\(\)$/,'');skipNL();if(!T[p])eof();n={k:'fn',name,body:cmd()};return n}
if(n){n.red=[];while(isRed(T[p]))n.red.push(rd1());return n}
const words=[],red=[];
while(T[p]){const x=T[p];if(x.w!==undefined){words.push(x.w);p++}else if(isRed(x))red.push(rd1());else break}
return{k:'cmd',words,red}}
const L=list([]);if(p<T.length)throw synt(T[p]);return L}
const parseSrc=s=>{try{return parse(lex(s))}catch(e){if(e&&e.inc)throw new Error('syntax error: unexpected end of file');throw e}};
/* ---------- expansion ---------- */
const getv=n=>n==='?'?String(sh.st):n==='#'?String(sh.pos.length):n==='@'||n==='*'?sh.pos.join(' '):n==='$'?'4242':n==='0'?'bash':/^\d$/.test(n)?sh.pos[n-1]??'':sh.env[n]??'';
async function sub(src){let b='';await execList(parseSrc(src),{stdin:{s:null},out:s=>b+=s,err:s=>print(s,'er')});return b.replace(/\n+$/,'')}
async function arith(e){e=(await expand(e,1)).join(' ').replace(/[A-Za-z_]\w*/g,m=>/^-?\d+$/.test(sh.env[m])?sh.env[m]:'0');if(!/^[\d\s+\-*/%()<>=!&|^~?:]*$/.test(e))throw new Error('arithmetic syntax error');return Math.trunc(Function('"use strict";return('+(e.trim()||'0')+')')())||0}
async function param(e){
if(e[0]==='#'&&e.length>1)return String(getv(e.slice(1)).length);
const m=e.match(/^(\w+|[?#@*])(.*)$/s);if(!m)throw new Error('bad substitution');
const name=m[1],rest=m[2],v=getv(name);if(!rest)return v;let r;
if(r=rest.match(/^(:?)([-=+])(.*)$/s)){const unset=r[1]?v==='':!(name in sh.env),w=(await expand(r[3],1)).join(' ');if(r[2]==='-')return unset?w:v;if(r[2]==='=')return unset?(sh.env[name]=w):v;return unset?'':w}
if(r=rest.match(/^(#{1,2}|%{1,2})(.*)$/s)){const re=new RegExp('^'+gsrc(r[2])+'$'),k=[...Array(v.length+1).keys()],long=r[1].length===2;
if(r[1][0]==='#'){for(const x of long?k.reverse():k)if(re.test(v.slice(0,x)))return v.slice(x)}else{for(const x of long?k:k.reverse())if(re.test(v.slice(x)))return v.slice(0,x)}return v}
if(r=rest.match(/^(\/\/?)([^/]*)\/?(.*)$/s))return v.replace(new RegExp(gsrc(r[2]),r[1]==='//'?'g':''),()=>r[3]);
if(r=rest.match(/^(\^\^?|,,?)$/))return r[1][0]==='^'?v.toUpperCase():v.toLowerCase();
return v}
async function expand(raw,ns){
const Fs=[];let cur='',pat='',hv=false,q=false;
const push=()=>{if(hv)Fs.push([cur,pat]);cur='';pat='';hv=false};
const add=(s,qq)=>{cur+=s;pat+=qq?s.replace(/[*?\[\]\\]/g,'\\$&'):s;hv=true};
const val=s=>{if(q||ns)add(s,true);else for(const x of s.split(/(\s+)/)){if(/^\s+$/.test(x))push();else if(x)add(x,false)}};
for(let i=0;i<raw.length;i++){const c=raw[i];
if(c==="'"&&!q){const j=raw.indexOf("'",i+1);add(raw.slice(i+1,j),true);i=j;continue}
if(c==='"'){q=!q;hv=true;continue}
if(c==='\\'){const d=raw[++i];if(d===undefined)continue;if(q&&!/[$`"\\]/.test(d))add('\\'+d,true);else add(d,true);continue}
if(c==='~'&&!q&&i===0&&(raw[1]===undefined||raw[1]==='/')){add(sh.env.HOME,true);continue}
if(c==='`'){const j=raw.indexOf('`',i+1);val(await sub(raw.slice(i+1,j)));i=j;continue}
if(c==='$'){const d=raw[i+1];
if(d==='('){const j=close(raw,i+1),inner=raw.slice(i+2,j);val(inner[0]==='('&&inner.endsWith(')')?String(await arith(inner.slice(1,-1))):await sub(inner));i=j;continue}
if(d==='{'){const j=close(raw,i+1);val(await param(raw.slice(i+2,j)));i=j;continue}
const m=raw.slice(i+1).match(/^([A-Za-z_]\w*|[?#@*$!]|\d)/);
if(m){const nm=m[1];i+=nm.length;if(nm==='@'&&q&&!ns){sh.pos.forEach((x,k)=>{if(k)push();add(x,true)})}else val(getv(nm));continue}
add('$',true);continue}
add(c,q)}
push();
const out=[];for(const[s,pt]of Fs){if(!ns&&/(^|[^\\])[*?\[]/.test(pt)){const g=glob(pt);if(g.length){out.push(...g);continue}}out.push(s)}
return out}
/* ---------- executor ---------- */
const tick=async()=>{if(sh.int)throw new Ctl('int');if(++sh.n%100===0)await new Promise(r=>setTimeout(r))};
async function execList(L,io){let st=0;for(const n of L){st=await execAO(n,io);sh.st=st}return st}
async function execAO(n,io){let st=await execPipe(n.l,io);sh.st=st;for(const[op,pp]of n.r){if((op==='&&')===(st===0)){st=await execPipe(pp,io);sh.st=st}}return st}
async function execPipe(c,io){let stdin=io.stdin,st=0;for(let i=0;i<c.length;i++){const last=i===c.length-1;let b='';st=await execCmd(c[i],{stdin,out:last?io.out:s=>b+=s,err:io.err});stdin={s:b}}return st}
async function execCmd(n,io){const fl=[],o={...io};
try{for(const r of n.red||[]){
let m=r.o.match(/^(\d)?>&(\d)$/);if(m){(m[1]||'1')==='1'?o.out=o.err:o.err=o.out;continue}
const tg=(await expand(r.t,1))[0]??'';
if(r.o==='<'){o.stdin={s:rd(tg)};continue}
if(r.o==='<<<'){o.stdin={s:tg+'\n'};continue}
const fd=r.o==='&>'?3:r.o[0]==='2'?2:1;wr(tg,'',r.o.endsWith('>>'));let b='';const f=s=>b+=s;fl.push(()=>wr(tg,b,true));
if(fd!==2)o.out=f;if(fd!==1)o.err=f}
return await execNode(n,o)}finally{for(const f of fl)f()}}
async function execNode(n,io){switch(n.k){
case'if':for(const[c,b]of n.br)if(await execList(c,io)===0)return execList(b,io);return n.el?execList(n.el,io):0;
case'grp':return execList(n.b,io);
case'fn':sh.funcs[n.name]=n.body;return 0;
case'for':{let it=[];if(n.items)for(const w of n.items)it.push(...await expand(w));else it=[...sh.pos];let st=0;
for(const v of it){await tick();sh.env[n.v]=v;try{st=await execList(n.b,io)}catch(e){if(e instanceof Ctl&&e.k==='break')break;if(e instanceof Ctl&&e.k==='continue')continue;throw e}}return st}
case'while':{let st=0;for(;;){await tick();if(((await execList(n.c,io))===0)===n.neg)break;try{st=await execList(n.b,io)}catch(e){if(e instanceof Ctl&&e.k==='break')break;if(e instanceof Ctl&&e.k==='continue')continue;throw e}}return st}
default:return simple(n,io)}}
async function simple(n,io){
const W=n.words.slice(),as=[];
while(W.length&&/^[A-Za-z_]\w*=/.test(W[0])){const w=W.shift(),k=w.indexOf('=');as.push([w.slice(0,k),(await expand(w.slice(k+1),1)).join(' ')])}
const args=[];for(const w of W)args.push(...await expand(w));
if(!args.length){for(const[k,v]of as)sh.env[k]=v;return 0}
const old={};for(const[k,v]of as){old[k]=sh.env[k];sh.env[k]=v}
try{return await dispatch(args[0],args.slice(1),io)}finally{for(const k in old)old[k]===undefined?delete sh.env[k]:sh.env[k]=old[k]}}
async function runScript(src,args,io){const sp=sh.pos;sh.pos=args;try{return await execList(parseSrc(src),io)}catch(e){if(e instanceof Ctl&&e.k==='exit')return e.v;throw e}finally{sh.pos=sp}}
async function dispatch(name,a,io){
if(has(sh.funcs,name)){if(++sh.depth>150){sh.depth--;throw new Error('maximum function nesting level exceeded')}const sp=sh.pos;sh.pos=a;try{return await execCmd(sh.funcs[name],io)}catch(e){if(e instanceof Ctl&&e.k==='return')return e.v;throw e}finally{sh.pos=sp;sh.depth--}}
if(has(B,name)){try{return(await B[name](a,io,name))|0}catch(e){if(e instanceof Ctl)throw e;io.err(name+': '+(e.message||e)+'\n');return 1}}
if(has(X,name)){if(inst(name)){try{return(await X[name](a,io))|0}catch(e){if(e instanceof Ctl)throw e;io.err(name+': '+(e.message||e)+'\n');return 1}}io.err("Command '"+name+"' not found, but can be installed with:\n\nsudo apt install "+CAT.find(c=>c[5].includes(name))[0]+"\n");return 127}
if(name.includes('/')){const f=node(name);if(f&&f.t==='f')return runScript(f.d,a,io);io.err(name+': No such file or directory\n');return 127}
io.err(name+': command not found\n');return 127}
/* ---------- builtins ---------- */
const B={};
const inp=io=>io.stdin.s??'';
const files=(a,io)=>a.length?a.map(rd):[inp(io)];
const lines=s=>{const l=s.split('\n');if(l[l.length-1]==='')l.pop();return l};
const L2=l=>l.length?l.join('\n')+'\n':'';
const unesc=s=>s.replace(/\\(n|t|\\|r|0|e)/g,(m,c)=>({n:'\n',t:'\t','\\':'\\',r:'\r',0:'\0',e:'\x1b'}[c]));
B.echo=(a,io)=>{let n=0,e=0;while(a[0]&&/^-[neE]+$/.test(a[0])){const f=a.shift();if(f.includes('n'))n=1;if(f.includes('e'))e=1}let s=a.join(' ');if(e)s=unesc(s);io.out(s+(n?'':'\n'))};
B.printf=(a,io)=>{const f=unesc(a[0]||''),r=a.slice(1);let k=0,o='';do{o+=f.replace(/%(-?\d*)(?:\.(\d+))?([sdf%])/g,(m,w,pr,c)=>{if(c==='%')return'%';let v=r[k++]??'';if(c==='d')v=String(parseInt(v)||0);else if(c==='f')v=(+v||0).toFixed(pr===undefined?6:+pr);else if(pr!==undefined)v=v.slice(0,+pr);const W=Math.abs(+w)||0;return w[0]==='-'?v.padEnd(W):v.padStart(W)})}while(k<r.length&&/%[^%]/.test(f));io.out(o)};
B.cd=a=>{let t=a[0]??sh.env.HOME;if(t==='-')t=sh.env.OLDPWD||sh.env.PWD;const n=node(t);if(!n)throw new Error(t+': No such file or directory');if(n.t!=='d')throw new Error(t+': Not a directory');sh.env.OLDPWD=sh.env.PWD;sh.env.PWD=abs(t)};
B.pwd=(a,io)=>io.out(sh.env.PWD+'\n');
B.ls=(a,io)=>{const fl=new Set(),ps=[];let st=0;for(const x of a)/^-[a-zA-Z]+$/.test(x)?[...x.slice(1)].forEach(c=>fl.add(c)):ps.push(x);if(!ps.length)ps.push('.');
const L=fl.has('l'),fmt=(nm,n)=>L?(n.t==='d'?'d':'-')+'rwxr-xr-x 1 user user '+String(n.t==='d'?4096:n.d.length).padStart(6)+' '+new Date().toDateString().slice(4,10)+' '+nm:nm;
const dirs=[],fs=[];for(const p of ps){const n=node(p);if(!n){io.err("ls: cannot access '"+p+"': No such file or directory\n");st=2;continue}n.t==='d'?dirs.push([p,n]):fs.push(fmt(p,n))}
const out=[];if(fs.length)out.push(fs.join(L?'\n':'  '));
for(const[p,n]of dirs){let k=Object.keys(n.c).sort();k=fl.has('a')?['.','..',...k]:k.filter(x=>x[0]!=='.');out.push((ps.length>1?p+':\n':'')+(L||fl.has('1')?k.map(x=>fmt(x,n.c[x]||n)).join('\n'):k.join('  ')))}
if(out.length)io.out(out.join('\n\n')+'\n');return st};
B.cat=(a,io)=>{let nn=0;if(a[0]==='-n'){nn=1;a.shift()}let s=files(a,io).join('');if(nn)s=L2(lines(s).map((l,i)=>String(i+1).padStart(6)+'\t'+l));io.out(s)};
B.mkdir=a=>{let p=0;for(const x of a){if(x==='-p'){p=1;continue}if(prot(x)&&sh.env.USER!=='root')throw new Error("cannot create directory '"+x+"': Permission denied");const g=abs(x).split('/').filter(Boolean);let n=root;for(let i=0;i<g.length;i++){const k=g[i];if(has(n.c,k)){if(n.c[k].t!=='d')throw new Error(x+': Not a directory');if(i===g.length-1&&!p)throw new Error("cannot create directory '"+x+"': File exists");n=n.c[k]}else{if(i<g.length-1&&!p)throw new Error("cannot create directory '"+x+"': No such file or directory");n=n.c[k]=D({})}}}save()};
B.touch=a=>{for(const x of a)if(!node(x))wr(x,'')};
B.rm=a=>{let r=0,f=0;for(const x of a){if(/^-[rRf]+$/.test(x)){if(/[rR]/.test(x))r=1;if(x.includes('f'))f=1;continue}const[pn,nm]=parent(x),n=node(x);if(!n){if(!f)throw new Error("cannot remove '"+x+"': No such file or directory");continue}if(n.t==='d'&&!r)throw new Error("cannot remove '"+x+"': Is a directory");if(abs(x)==='/')throw new Error('refusing to remove /');delete pn.c[nm]}save()};
B.rmdir=a=>{for(const x of a){const[pn,nm]=parent(x),n=node(x);if(!n||n.t!=='d')throw new Error(x+': Not a directory');if(Object.keys(n.c).length)throw new Error(x+': Directory not empty');delete pn.c[nm]}save()};
function cpmv(a,mv){let r=0;const p=a.filter(x=>{if(/^-[rRf]+$/.test(x)){if(/[rR]/.test(x))r=1;return false}return true});if(p.length<2)throw new Error('missing file operand');const dst=p.pop(),dn=node(dst);
if(p.length>1&&!(dn&&dn.t==='d'))throw new Error("target '"+dst+"' is not a directory");
for(const s of p){const n=node(s);if(!n)throw new Error("cannot stat '"+s+"': No such file or directory");if(n.t==='d'&&!r&&!mv)throw new Error("-r not specified; omitting directory '"+s+"'");
const tg=dn&&dn.t==='d'?abs(dst)+'/'+abs(s).split('/').pop():dst;if(abs(tg)===abs(s))continue;if(abs(tg).startsWith(abs(s)+'/'))throw new Error('cannot move a directory into itself');
const[pn,nm]=parent(tg);if(!pn)throw new Error("cannot create '"+dst+"': No such file or directory");pn.c[nm]=JSON.parse(JSON.stringify(n));if(mv){const[sp,sn]=parent(s);delete sp.c[sn]}}save()}
B.cp=a=>cpmv(a,0);B.mv=a=>cpmv(a,1);
B.grep=(a,io)=>{const fl=new Set(),fs=[];let pat=null;for(const x of a){if(/^-[a-zA-Z]+$/.test(x))[...x.slice(1)].forEach(c=>fl.add(c));else if(pat===null)pat=x;else fs.push(x)}
if(pat===null)throw new Error('usage: grep [-ivncrlFw] pattern [file...]');
let src=fl.has('F')?esc(pat):pat;if(fl.has('w'))src='\\b'+src+'\\b';const re=new RegExp(src,fl.has('i')?'i':'');
const srcs=[],walk=(p,n)=>{if(n.t==='f')srcs.push([p,n.d]);else for(const k of Object.keys(n.c).sort())walk(p+(p.endsWith('/')?'':'/')+k,n.c[k])};
if(!fs.length)fl.has('r')?walk('.',node('.')):srcs.push([null,inp(io)]);else for(const f of fs){const n=node(f);if(!n){io.err('grep: '+f+': No such file or directory\n');continue}fl.has('r')?walk(f,n):srcs.push([f,rd(f)])}
const pre=srcs.length>1||fl.has('r');let hit=0;
for(const[f,t]of srcs){let c=0;lines(t).forEach((l,i)=>{if(re.test(l)!==fl.has('v')){c++;hit=1;if(!fl.has('c')&&!fl.has('l'))io.out((pre&&f?f+':':'')+(fl.has('n')?(i+1)+':':'')+l+'\n')}});if(fl.has('c'))io.out((pre&&f?f+':':'')+c+'\n');if(fl.has('l')&&c)io.out(f+'\n')}
return hit?0:1};
const ht=(a,io,tail)=>{let n=10;const fs=[];for(let i=0;i<a.length;i++){if(a[i]==='-n')n=+a[++i];else if(/^-\d+$/.test(a[i]))n=-a[i];else fs.push(a[i])}for(const t of files(fs,io)){const l=lines(t);io.out(L2(tail?l.slice(Math.max(0,l.length-n)):l.slice(0,n)))}};
B.head=(a,io)=>ht(a,io,0);B.tail=(a,io)=>ht(a,io,1);
B.wc=(a,io)=>{const fl=a.filter(x=>x[0]==='-').join(''),fs=a.filter(x=>x[0]!=='-');files(fs,io).forEach((t,i)=>{const v=[['l',t.split('\n').length-1],['w',t.split(/\s+/).filter(Boolean).length],['c',t.length]].filter(([k])=>!fl||fl.includes(k)).map(x=>x[1]);io.out((v.length===1?v[0]:v.map(x=>String(x).padStart(7)).join(''))+(fs[i]?' '+fs[i]:'')+'\n')})};
B.sort=(a,io)=>{const fl=a.filter(x=>x[0]==='-').join(''),fs=a.filter(x=>x[0]!=='-');let l=files(fs,io).flatMap(lines);l.sort(fl.includes('n')?(x,y)=>parseFloat(x)-parseFloat(y)||0:(x,y)=>x<y?-1:x>y?1:0);if(fl.includes('r'))l.reverse();if(fl.includes('u'))l=l.filter((x,i)=>x!==l[i-1]);io.out(L2(l))};
B.uniq=(a,io)=>{const c=a.includes('-c'),o=[];for(const l of lines(files(a.filter(x=>x[0]!=='-'),io).join(''))){const p=o[o.length-1];if(p&&p[0]===l)p[1]++;else o.push([l,1])}io.out(L2(o.map(([l,n])=>c?String(n).padStart(7)+' '+l:l)))};
B.cut=(a,io)=>{let d='\t',f='1';const fs=[];for(let i=0;i<a.length;i++){const x=a[i];if(x==='-d')d=a[++i];else if(x==='-f')f=a[++i];else if(x.startsWith('-d'))d=x.slice(2);else if(x.startsWith('-f'))f=x.slice(2);else fs.push(x)}
const idx=f.split(',').flatMap(r=>{const[s,e]=r.split('-');return r.includes('-')?Array.from({length:(+e||99)-(+s||1)+1},(_,i)=>(+s||1)+i):[+s]});
io.out(L2(files(fs,io).flatMap(lines).map(l=>l.split(d).filter((_,i)=>idx.includes(i+1)).join(d))))};
const trset=s=>s.replace(/\[:(\w+):\]/g,(m,c)=>({lower:'abcdefghijklmnopqrstuvwxyz',upper:'ABCDEFGHIJKLMNOPQRSTUVWXYZ',digit:'0123456789',space:' \t\n'}[c]||'')).replace(/(.)-(.)/g,(m,x,y)=>{let o='';for(let c=x.charCodeAt(0);c<=y.charCodeAt(0);c++)o+=String.fromCharCode(c);return o});
B.tr=(a,io)=>{let d=0;const s=a.filter(x=>x==='-d'?!(d=1):1).map(x=>trset(unesc(x)));let t=inp(io);if(d)t=[...t].filter(c=>!s[0].includes(c)).join('');else{const[x,y='']=s;t=[...t].map(c=>{const i=x.indexOf(c);return i<0?c:(y[Math.min(i,y.length-1)]??c)}).join('')}io.out(t)};
B.sed=(a,io)=>{let n=0,sc=null;const fs=[];for(let i=0;i<a.length;i++){if(a[i]==='-n')n=1;else if(a[i]==='-e')sc=a[++i];else if(sc===null)sc=a[i];else fs.push(a[i])}
const ls=files(fs,io).flatMap(lines);let m,out;
if(m=sc.match(/^s(.)(.*?)\1(.*?)\1([gi]*)$/)){const re=new RegExp(m[2],m[4]),rp=m[3].replace(/\\(\d)/g,'$$$1').replace(/&/g,'$$&');out=ls.map(l=>l.replace(re,rp))}
else if(m=sc.match(/^(?:(\d+|\$)(?:,(\d+|\$))?|\/(.*)\/)?([dp])$/)){const mt=(l,i)=>{if(m[3]!==undefined)return new RegExp(m[3]).test(l);if(!m[1])return true;const s=m[1]==='$'?ls.length:+m[1],e=m[2]===undefined?s:m[2]==='$'?ls.length:+m[2];return i+1>=s&&i+1<=e};
out=m[4]==='d'?ls.filter((l,i)=>!mt(l,i)):n?ls.filter(mt):ls.flatMap((l,i)=>mt(l,i)?[l,l]:[l])}
else throw new Error('unsupported script (supports s///, d, p)');
io.out(L2(out))};
B.rev=(a,io)=>io.out(L2(files(a,io).flatMap(lines).map(l=>[...l].reverse().join(''))));
B.tac=(a,io)=>io.out(L2(files(a,io).flatMap(lines).reverse()));
B.tee=(a,io)=>{const ap=a.includes('-a');for(const f of a.filter(x=>x[0]!=='-'))wr(f,inp(io),ap);io.out(inp(io))};
B.find=(a,io)=>{let st='.',nm=null,ty=null;const i0=a[0]&&a[0][0]!=='-'?(st=a[0],1):0;for(let i=i0;i<a.length;i++){if(a[i]==='-name')nm=new RegExp('^'+gsrc(a[++i])+'$');else if(a[i]==='-type')ty=a[++i]}
const n=node(st);if(!n)throw new Error(st+': No such file or directory');const o=[],w=(p,n)=>{if((!nm||nm.test(p.split('/').pop()))&&(!ty||ty===n.t))o.push(p);if(n.t==='d')for(const k of Object.keys(n.c).sort())w(p+(p.endsWith('/')?'':'/')+k,n.c[k])};w(st,n);io.out(L2(o))};
B.basename=(a,io)=>{const p=a[0].replace(/\/+$/,'').split('/').pop();io.out((a[1]&&p.endsWith(a[1])?p.slice(0,-a[1].length):p)+'\n')};
B.dirname=(a,io)=>{const s=a[0].replace(/\/+$/,''),k=s.lastIndexOf('/');io.out((k<0?'.':k===0?'/':s.slice(0,k))+'\n')};
B.xargs=(a,io)=>dispatch(a[0]||'echo',[...a.slice(1),...inp(io).split(/\s+/).filter(Boolean)],{...io,stdin:{s:null}});
B.seq=(a,io)=>{const n=a.map(Number),[s,i,e]=n.length===1?[1,1,n[0]]:n.length===2?[n[0],1,n[1]]:n,o=[];if(i>0)for(let x=s;x<=e;x+=i)o.push(x);else if(i<0)for(let x=s;x>=e;x+=i)o.push(x);io.out(L2(o))};
B.date=(a,io)=>{const d=new Date(),p=n=>String(n).padStart(2,'0'),Y=d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate()),T=p(d.getHours())+':'+p(d.getMinutes())+':'+p(d.getSeconds());
io.out((a[0]&&a[0][0]==='+'?a[0].slice(1).replace(/%([YmdHMSFT])/g,(m,c)=>({Y:d.getFullYear(),m:p(d.getMonth()+1),d:p(d.getDate()),H:p(d.getHours()),M:p(d.getMinutes()),S:p(d.getSeconds()),F:Y,T}[c])):d.toString())+'\n')};
B.sleep=async a=>{const end=Date.now()+(+a[0]||0)*1000;while(Date.now()<end){if(sh.int)throw new Ctl('int');await new Promise(r=>setTimeout(r,50))}};
B.true=()=>0;B[':']=()=>0;B.false=()=>1;
for(const k of['chmod','chown','set','alias','unalias','trap','umask','shopt'])B[k]=()=>0;
B.exit=a=>{throw new Ctl('exit',+a[0]||0)};
B.return=a=>{throw new Ctl('return',a[0]===undefined?sh.st:+a[0])};
B.break=()=>{throw new Ctl('break')};B.continue=()=>{throw new Ctl('continue')};
B.export=(a,io)=>{if(!a.length)for(const[k,v]of Object.entries(sh.env))io.out('declare -x '+k+'="'+v+'"\n');for(const x of a){const m=x.match(/^(\w+)=(.*)$/s);if(m)sh.env[m[1]]=m[2];else if(!(x in sh.env))sh.env[x]=''}};
B.local=B.declare=B.readonly=B.export;
B.unset=a=>{for(const x of a){delete sh.env[x];delete sh.funcs[x]}};
B.shift=a=>{sh.pos=sh.pos.slice(+a[0]||1)};
B.env=B.printenv=(a,io)=>io.out(Object.entries(sh.env).map(([k,v])=>k+'='+v+'\n').join(''));
B.let=async a=>{let r=0;for(const x of a){const m=x.match(/^(\w+)(\+\+|--|[-+*/%]?=)(.*)$/);if(!m){r=await arith(x);continue}const[,v,o,e]=m,cur=+sh.env[v]||0;r=o==='++'?cur+1:o==='--'?cur-1:o==='='?await arith(e):await arith(cur+o[0]+'('+e+')');sh.env[v]=String(r)}return r?0:1};
function test(a){a=[...a];if(a[0]==='!'){a.shift();return!test(a)}
if(a.length===0)return false;if(a.length===1)return a[0]!=='';
if(a.length===2){const[o,x]=a,n=node(x);switch(o){case'-z':return x==='';case'-n':return x!=='';case'-e':return!!n;case'-f':return n?.t==='f';case'-d':return n?.t==='d';case'-s':return!!n&&(n.t==='d'||n.d.length>0)}}
if(a.length===3){const[x,o,y]=a;switch(o){case'=':case'==':return x===y;case'!=':return x!==y;case'-eq':return+x===+y;case'-ne':return+x!==+y;case'-lt':return+x<+y;case'-gt':return+x>+y;case'-le':return+x<=+y;case'-ge':return+x>=+y;case'=~':return new RegExp(y).test(x)}}
throw new Error('unsupported test expression')}
B.test=a=>test(a)?0:1;
B['[']=a=>{if(a.pop()!==']')throw new Error("missing `]'");return test(a)?0:1};
B['[[']=a=>{if(a.pop()!==']]')throw new Error("missing `]]'");return test(a)?0:1};
B.read=async(a,io)=>{let pr='';let vars=[];for(let i=0;i<a.length;i++){if(a[i]==='-p')pr=a[++i];else if(a[i][0]!=='-')vars.push(a[i])}if(!vars.length)vars=['REPLY'];
let line;const st=io.stdin;if(st.s!==null){if(st.s==='')return 1;const k=st.s.indexOf('\n');line=k<0?st.s:st.s.slice(0,k);st.s=k<0?'':st.s.slice(k+1)}else line=await askLine(pr);
const w=line.trim().split(/\s+/);vars.forEach((v,i)=>sh.env[v]=i===vars.length-1?w.slice(i).join(' '):w[i]||'');return 0};
B.source=B['.']=(a,io)=>runScript(rd(a[0]),a.slice(1),io);
B.bash=B.sh=(a,io)=>a[0]==='-c'?runScript(a[1],a.slice(3),io):runScript(rd(a[0]),a.slice(1),io);
B.eval=(a,io)=>runScript(a.join(' '),sh.pos,io);
B.whoami=(a,io)=>io.out('user\n');B.hostname=(a,io)=>io.out('browser\n');
B.uname=(a,io)=>io.out(a.includes('-a')?'Linux browser 6.0.0-js x86_64 GNU/Linux\n':'Linux\n');
B.history=(a,io)=>sh.hist.forEach((h,i)=>io.out(String(i+1).padStart(5)+'  '+h+'\n'));
B.clear=()=>{$log.textContent=''};
B.which=B.type=(a,io)=>{let st=0;for(const x of a){if(has(sh.funcs,x))io.out(x+' is a function\n');else if(has(B,x))io.out(x+' is a shell builtin\n');else{io.err('bash: type: '+x+': not found\n');st=1}}return st};
B.help=(a,io)=>io.out('Commands:\n'+Object.keys(B).sort().join(' ')+'\n\nShell syntax: pipes, && || ;, > >> < 2> 2>&1 <<<, $VAR ${VAR:-x} ${#VAR} $(cmd) $((1+2)),\nglobs, if/elif/else, for, while/until, functions, break/continue/return.\nNot supported: case, heredocs, arrays, subshell ( ), background jobs.\nAccounts: user/user and root/root (change with passwd). Try: sudo apt update, apt search cow,\nsudo apt install cowsay, nmcli dev wifi list, su -. reset-fs restores the starting filesystem.\n');
B['reset-fs']=()=>{try{localStorage.removeItem('bashfs')}catch(e){}root=seed();sh.env.PWD=sh.env.HOME;save()};
/* ---------- users, su/sudo/passwd ---------- */
const nap=ms=>new Promise(r=>setTimeout(r,ms));
const ensure=p=>{let n=root;for(const k of p.split('/').filter(Boolean)){if(!has(n.c,k))n.c[k]=D({});n=n.c[k]}};
['/usr/bin','/root','/var/log','/etc/apt','/home/user'].forEach(ensure);
if(!has(root.c.etc.c,'os-release'))root.c.etc.c['os-release']=F('PRETTY_NAME="Ubuntu 22.04 LTS (simulated)"\nNAME="Ubuntu"\nVERSION_ID="22.04"\n');
sh.stack=[];sh.sudoUntil=0;sh.net={wifi:true,ssid:'HomeNet'};
try{sh.users=JSON.parse(localStorage.getItem('bashusers'))}catch(e){}
if(!sh.users||!sh.users.root)sh.users={root:{pw:'root',home:'/root',sudo:true},user:{pw:'user',home:'/home/user',sudo:true}};
const isRoot=()=>sh.env.USER==='root';
const uid=n=>n==='root'?0:1000+Object.keys(sh.users).filter(k=>k!=='root').indexOf(n);
function syncPw(){root.c.etc.c.passwd=F(Object.entries(sh.users).map(([n,u])=>n+':x:'+uid(n)+':'+uid(n)+'::'+u.home+':/bin/bash').join('\n')+'\n');save()}
const saveUsers=()=>{try{localStorage.setItem('bashusers',JSON.stringify(sh.users))}catch(e){}syncPw()};syncPw();
function setUser(t,cd){sh.env.USER=sh.env.LOGNAME=t;sh.env.HOME=sh.users[t].home;if(cd)sh.env.PWD=sh.users[t].home}
const needRoot=()=>{if(!isRoot())throw new Error('Permission denied')};
B.whoami=(a,io)=>io.out(sh.env.USER+'\n');
B.id=(a,io)=>{const n=a[0]||sh.env.USER,u=sh.users[n];if(!u)throw new Error("'"+n+"': no such user");const i=uid(n);io.out('uid='+i+'('+n+') gid='+i+'('+n+') groups='+i+'('+n+')'+(u.sudo?',27(sudo)':'')+'\n')};
B.su=async(a,io)=>{const login=a.includes('-')||a.includes('-l'),t=a.find(x=>x[0]!=='-')||'root',u=sh.users[t];
if(!u){io.err('su: user '+t+' does not exist\n');return 1}
if(!isRoot()&&(await askLine('Password: ',1))!==u.pw){await nap(800);io.err('su: Authentication failure\n');return 1}
sh.stack.push({u:sh.env.USER,h:sh.env.HOME,p:sh.env.PWD});setUser(t,login)};
B.sudo=async(a,io)=>{if(!a.length)throw new Error('usage: sudo [-i|-s] command');const me=sh.env.USER;
if(me!=='root'){if(!sh.users[me].sudo){io.err(me+' is not in the sudoers file.  This incident will be reported.\n');return 1}
if(Date.now()>sh.sudoUntil){let ok=0;for(let i=0;i<3&&!ok;i++){ok=(await askLine('[sudo] password for '+me+': ',1))===sh.users[me].pw;if(!ok&&i<2)io.err('Sorry, try again.\n')}if(!ok){io.err('sudo: 3 incorrect password attempts\n');return 1}sh.sudoUntil=Date.now()+3e5}}
const sw=a[0]==='-i'||a[0]==='-s'||(a[0]==='su'&&(a.length===1||a[1]==='-'));
if(sw){if(me!=='root'){sh.stack.push({u:me,h:sh.env.HOME,p:sh.env.PWD});setUser('root',a[0]!=='-s'&&a[0]!=='su'||a[1]==='-')}return 0}
sh.env.USER='root';try{return await dispatch(a[0],a.slice(1),io)}finally{sh.env.USER=me}};
B.passwd=async(a,io)=>{const me=sh.env.USER,t=a[0]||me,u=sh.users[t];
if(!u){io.err("passwd: user '"+t+"' does not exist\n");return 1}
if(t!==me&&me!=='root'){io.err('passwd: You may not view or modify password information for '+t+'.\n');return 1}
io.out('Changing password for '+t+'.\n');
if(me!=='root'&&(await askLine('Current password: ',1))!==u.pw){io.err('passwd: Authentication token manipulation error\n');return 1}
const p1=await askLine('New password: ',1);if(!p1){io.err('No password supplied\n');return 1}
if(p1!==await askLine('Retype new password: ',1)){io.err('Sorry, passwords do not match.\n');return 1}
u.pw=p1;saveUsers();io.out('passwd: password updated successfully\n')};
B.useradd=B.adduser=a=>{needRoot();const n=a.filter(x=>x[0]!=='-').pop();if(!n||!/^[a-z_][a-z0-9_-]*$/.test(n))throw new Error('invalid user name');if(sh.users[n])throw new Error("user '"+n+"' already exists");sh.users[n]={pw:'',home:'/home/'+n,sudo:false};ensure('/home/'+n);saveUsers()};
B.usermod=a=>{needRoot();const n=a[a.length-1];if(!sh.users[n])throw new Error("user '"+n+"' does not exist");if(a.includes('sudo'))sh.users[n].sudo=true;saveUsers()};
B.userdel=a=>{needRoot();const n=a[a.length-1];if(n==='root'||!sh.users[n])throw new Error("cannot delete '"+n+"'");delete sh.users[n];saveUsers()};
/* ---------- network (simulated Wi-Fi; browsers cannot touch real radios) ---------- */
const netOk=()=>!!(sh.net.wifi&&sh.net.ssid)&&navigator.onLine!==false;
const NETS=[['HomeNet','WPA2','password123',82],['CoffeeShop_Guest','--','',64],['Office_5G','WPA2','hunter2',47],['FreeAirportWiFi','--','',31]];
const bars=s=>s>75?'▂▄▆█':s>55?'▂▄▆_':s>35?'▂▄__':'▂___';
B.nmcli=async(a,io)=>{const al={d:'dev',device:'dev',r:'radio',c:'con',connection:'con',g:'general',general:'general',n:'networking'},[c0,...r]=a,c=al[c0]||c0||'general';
if(c==='radio'){if(r[1]){sh.net.wifi=r[1]==='on';if(!sh.net.wifi)sh.net.ssid=null;return}io.out(r[0]==='wifi'?(sh.net.wifi?'enabled\n':'disabled\n'):'WIFI-HW  WIFI      WWAN-HW  WWAN\nenabled  '+(sh.net.wifi?'enabled ':'disabled')+'  enabled  enabled\n');return}
if(c==='dev'){const s=r[0]||'status';
if(s==='status'){io.out('DEVICE  TYPE      STATE         CONNECTION\nwlan0   wifi      '+(!sh.net.wifi?'unavailable ':sh.net.ssid?'connected   ':'disconnected')+'  '+(sh.net.ssid||'--')+'\nlo      loopback  unmanaged     --\n');return}
if(s==='disconnect'){sh.net.ssid=null;io.out("Device 'wlan0' successfully disconnected.\n");return}
if(s==='wifi'){const sub=r[1]||'list';if(!sh.net.wifi)throw new Error('Wi-Fi is disabled');
if(sub==='rescan')return;
if(sub==='list'){io.out('IN-USE  BSSID              SSID              MODE   CHAN  RATE        SIGNAL  BARS  SECURITY\n');NETS.forEach((n,i)=>io.out((n[0]===sh.net.ssid?'*':' ').padEnd(8)+('02:00:00:00:00:0'+i).padEnd(20)+n[0].padEnd(18)+'Infra  '+String(36+i*4).padEnd(6)+'270 Mbit/s  '+String(n[3]).padEnd(8)+bars(n[3]).padEnd(6)+n[1]+'\n'));return}
if(sub==='connect'){const ss=r[2],n=NETS.find(x=>x[0]===ss);if(!n)throw new Error("No network with SSID '"+ss+"' found.");const pi=r.indexOf('password');if(n[1]!=='--'&&(pi<0||r[pi+1]!==n[2]))throw new Error('Connection activation failed: (7) Secrets were required, but not provided.');await nap(800);sh.net.ssid=ss;io.out("Device 'wlan0' successfully activated with '3f2c1a7e-0000-4d1e-9a11-5b2e7c9d0f42'.\n");return}}}
if(c==='con'){io.out('NAME      UUID                                  TYPE  DEVICE\n'+(sh.net.ssid?sh.net.ssid.padEnd(10)+'3f2c1a7e-0000-4d1e-9a11-5b2e7c9d0f42  wifi  wlan0\n':''));return}
if(c==='general'||c==='networking'){io.out(netOk()?'STATE      CONNECTIVITY  WIFI-HW  WIFI\nconnected  full          enabled  enabled\n':'STATE         CONNECTIVITY  WIFI-HW  WIFI\ndisconnected  none          enabled  '+(sh.net.wifi?'enabled':'disabled')+'\n');return}
throw new Error("Object '"+c+"' is not valid.")};
const addr=()=>'1: lo: <LOOPBACK,UP> mtu 65536\n    inet 127.0.0.1/8 scope host lo\n2: wlan0: <BROADCAST,MULTICAST'+(netOk()?',UP':'')+'> mtu 1500\n    link/ether 02:42:ac:11:00:02\n'+(netOk()?'    inet 192.168.1.42/24 brd 192.168.1.255 scope global wlan0\n':'');
B.ip=(a,io)=>{if(/^a(ddr(ess)?)?$/.test(a[0]||'a'))io.out(addr());else if(/^r/.test(a[0]))io.out(netOk()?'default via 192.168.1.1 dev wlan0\n192.168.1.0/24 dev wlan0 scope link\n':'');else throw new Error('unsupported (try: ip a, ip route)')};
B.ping=async(a,io)=>{const h=a.filter(x=>x[0]!=='-'&&!/^\d+$/.test(x)).pop(),i=a.indexOf('-c'),c=i>=0?+a[i+1]:4;if(!h)throw new Error('usage: ping [-c count] host');
if(!netOk()){io.err('ping: '+h+': Temporary failure in name resolution\n');return 2}
io.out('PING '+h+' 56(84) bytes of data.\n');let ok=0;
for(let k=0;k<c;k++){if(sh.int)throw new Ctl('int');const t=performance.now();let g=1;try{await fetch('https://'+h,{mode:'no-cors',cache:'no-store'})}catch(e){g=0}const ms=performance.now()-t;if(g){ok++;io.out('64 bytes from '+h+': icmp_seq='+(k+1)+' ttl=57 time='+ms.toFixed(1)+' ms\n')}else io.out('From '+h+' icmp_seq='+(k+1)+' Destination Host Unreachable\n');await nap(600)}
io.out('\n--- '+h+' ping statistics ---\n'+c+' packets transmitted, '+ok+' received, '+Math.round(100-ok/c*100)+'% packet loss\n(timings are HTTPS round trips; browsers cannot send ICMP)\n');return ok?0:1};
/* ---------- simulated apt / dpkg ---------- */
const BASE=['bash','coreutils','sudo','apt','network-manager','iputils-ping','passwd'];
const CAT=[
['bash','5.1-6ubuntu1','GNU Bourne Again SHell',1380,[],[],'5.1-6ubuntu1.1'],
['coreutils','8.32-4.1ubuntu1','GNU core utilities',7300,[],[]],
['sudo','1.9.9-1ubuntu2.2','Provide limited super user privileges to specific users',2200,[],[],'1.9.9-1ubuntu2.4'],
['apt','2.4.9','commandline package manager',4000,[],[]],
['network-manager','1.36.6-0ubuntu2','network management framework (daemon and userspace tools)',5000,[],[]],
['iputils-ping','3:20211215-1','Tools to test the reachability of network hosts',100,[],[]],
['passwd','1:4.8.1-2ubuntu2','change and administer password and group data',2900,[],[]],
['hello','2.10-2ubuntu4','example package based on GNU hello',56,[],['hello']],
['cowsay','3.03+dfsg2-8','configurable talking cow',88,[],['cowsay']],
['fortune-mod','1:1.99.1-7.1','provides fortune cookies on demand',1340,[],['fortune']],
['tree','2.0.2-1','displays directory tree, in color',48,[],['tree']],
['bc','1.07.1-2build1','GNU bc arbitrary precision calculator language',86,[],['bc']],
['neofetch','7.1.0-4','shows Linux System Information with Distribution Logo',90,['bc'],['neofetch']],
['curl','7.81.0-1ubuntu1.15','command line tool for transferring data with URL syntax',194,[],['curl'],'7.81.0-1ubuntu1.18'],
['wget','1.21.2-2ubuntu1','retrieves files from the web',367,[],['wget']],
['net-tools','1.60+git20181103-1ubuntu1','NET-3 networking toolkit',204,[],['ifconfig']],
['wireless-tools','30~pre9-13.1ubuntu4','Tools for manipulating Linux Wireless Extensions',91,[],['iwconfig']]];
const cat=n=>CAT.find(p=>p[0]===n);
const pk=(()=>{try{return JSON.parse(localStorage.getItem('bashpkgs'))}catch(e){return null}})()||{inst:{},lists:false};
for(const n of BASE)if(!pk.inst[n])pk.inst[n]=cat(n)[1];
const sp=()=>{try{localStorage.setItem('bashpkgs',JSON.stringify(pk))}catch(e){}};
const inst=n=>{const p=CAT.find(c=>c[5].includes(n));return p&&pk.inst[p[0]]};
const ups=()=>pk.lists?CAT.filter(p=>p[6]&&pk.inst[p[0]]&&pk.inst[p[0]]!==p[6]):[];
const kb=n=>n.toLocaleString('en-US')+' kB',MIR='http://archive.ubuntu.com/ubuntu';
const need=io=>{if(isRoot())return 0;io.err('E: Could not open lock file /var/lib/dpkg/lock-frontend - open (13: Permission denied)\nE: Unable to acquire the dpkg frontend lock (/var/lib/dpkg/lock-frontend), are you root?\n');return 1};
const netFail=io=>{io.err("Err:1 "+MIR+" jammy InRelease\n  Temporary failure resolving 'archive.ubuntu.com'\nE: Failed to fetch "+MIR+"/dists/jammy/InRelease  Temporary failure resolving 'archive.ubuntu.com'\n");return 100};
const confirm2=async(yes,io)=>{if(yes)return 1;if(/^n/i.test(await askLine('Do you want to continue? [Y/n] '))){io.out('Abort.\n');return 0}return 1};
const stub=(p)=>{for(const b of p[5])wr('/usr/bin/'+b,'#!/bin/sh\n# provided by package '+p[0]+'\n')};
const unstub=p=>{for(const b of p[5]){const[pn,nm]=parent('/usr/bin/'+b);if(pn)delete pn.c[nm]}save()};
B.apt=B['apt-get']=async(a,io)=>{
const fl=a.filter(x=>x[0]==='-'),ar=a.filter(x=>x[0]!=='-'),c=ar.shift(),yes=fl.some(f=>/^(-\w*y\w*|--yes|--assume-yes)$/.test(f));
const S=['Reading package lists... Done\n','Building dependency tree... Done\n','Reading state information... Done\n'];
switch(c){
case'update':{if(need(io))return 100;if(!netOk())return netFail(io);const R=['jammy','jammy-updates','jammy-backports','jammy-security'],z=[270,119,109,110];
for(let i=0;i<4;i++){io.out('Get:'+(i+1)+' '+MIR+' '+R[i]+' InRelease ['+z[i]+' kB]\n');await nap(250)}
io.out('Get:5 '+MIR+' jammy/universe amd64 Packages [14.1 MB]\n');await nap(600);io.out('Fetched 14.7 MB in 2s (7,350 kB/s)\n');for(const s of S)io.out(s);
pk.lists=true;sp();const n=ups().length;io.out(n?n+" packages can be upgraded. Run 'apt list --upgradable' to see them.\n":'All packages are up to date.\n');return 0}
case'upgrade':case'dist-upgrade':case'full-upgrade':{if(need(io))return 100;for(const s of S)io.out(s);const u=ups();
if(!u.length){io.out('Calculating upgrade... Done\n0 upgraded, 0 newly installed, 0 to remove and 0 not upgraded.\n');return 0}
if(!netOk())return netFail(io);const sz=u.reduce((s,p)=>s+p[3],0);
io.out('Calculating upgrade... Done\nThe following packages will be upgraded:\n  '+u.map(p=>p[0]).join(' ')+'\n'+u.length+' upgraded, 0 newly installed, 0 to remove and 0 not upgraded.\nNeed to get '+kb(sz)+' of archives.\n');
if(!await confirm2(yes,io))return 1;
for(const[i,p]of u.entries()){io.out('Get:'+(i+1)+' '+MIR+' jammy-updates/main amd64 '+p[0]+' amd64 '+p[6]+' ['+kb(p[3])+']\n');await nap(250)}
for(const p of u){io.out('Preparing to unpack .../'+p[0]+'_'+p[6]+'_amd64.deb ...\nUnpacking '+p[0]+' ('+p[6]+') over ('+pk.inst[p[0]]+') ...\n');await nap(150)}
for(const p of u){io.out('Setting up '+p[0]+' ('+p[6]+') ...\n');pk.inst[p[0]]=p[6]}sp();return 0}
case'install':{if(need(io))return 100;if(!ar.length){io.err('E: No packages specified\n');return 100}for(const s of S)io.out(s);
const todo=[];let bad=0;const add=n=>{const p=cat(n);if(!p||!pk.lists){io.err('E: Unable to locate package '+n+'\n');bad=1;return}if(pk.inst[n]||todo.includes(p))return;p[4].forEach(add);todo.push(p)};
for(const n of ar){if(cat(n)&&pk.inst[n])io.out(n+' is already the newest version ('+pk.inst[n]+').\n');else add(n)}
if(bad)return 100;
if(!todo.length){io.out('0 upgraded, 0 newly installed, 0 to remove and '+ups().length+' not upgraded.\n');return 0}
if(!netOk())return netFail(io);
const sz=todo.reduce((s,p)=>s+p[3],0),ex=todo.filter(p=>!ar.includes(p[0]));
if(ex.length)io.out('The following additional packages will be installed:\n  '+ex.map(p=>p[0]).join(' ')+'\n');
io.out('The following NEW packages will be installed:\n  '+todo.map(p=>p[0]).join(' ')+'\n0 upgraded, '+todo.length+' newly installed, 0 to remove and '+ups().length+' not upgraded.\nNeed to get '+kb(sz)+' of archives.\nAfter this operation, '+kb(Math.round(sz*3.4))+' of additional disk space will be used.\n');
if(!await confirm2(yes,io))return 1;
for(const[i,p]of todo.entries()){io.out('Get:'+(i+1)+' '+MIR+' jammy/universe amd64 '+p[0]+' amd64 '+p[1]+' ['+kb(p[3])+']\n');await nap(220)}
io.out('Fetched '+kb(sz)+' in 1s ('+kb(Math.round(sz/1.2))+'/s)\n');
for(const p of todo){io.out('Selecting previously unselected package '+p[0]+'.\nPreparing to unpack .../'+p[0]+'_'+p[1]+'_amd64.deb ...\nUnpacking '+p[0]+' ('+p[1]+') ...\n');await nap(120)}
for(const p of todo){io.out('Setting up '+p[0]+' ('+p[1]+') ...\n');pk.inst[p[0]]=p[1];stub(p);await nap(100)}
sp();io.out('Processing triggers for man-db (2.10.2-1) ...\n');return 0}
case'remove':case'purge':case'autoremove':{if(need(io))return 100;for(const s of S)io.out(s);
const go=[];if(c!=='autoremove')for(const n of ar){const p=cat(n);if(p&&BASE.includes(n)){io.err('E: Removing essential system package '+n+' is not allowed\n');return 100}if(!p||!pk.inst[n]){io.out("Package '"+n+"' is not installed, so not removed\n");continue}go.push(p)}
if(!go.length){io.out('0 upgraded, 0 newly installed, 0 to remove and '+ups().length+' not upgraded.\n');return 0}
io.out('The following packages will be REMOVED:\n  '+go.map(p=>p[0]).join(' ')+'\n0 upgraded, 0 newly installed, '+go.length+' to remove and '+ups().length+' not upgraded.\nAfter this operation, '+kb(Math.round(go.reduce((s,p)=>s+p[3],0)*3.4))+' disk space will be freed.\n');
if(!await confirm2(yes,io))return 1;
for(const p of go){io.out('Removing '+p[0]+' ('+pk.inst[p[0]]+') ...\n');delete pk.inst[p[0]];unstub(p);await nap(100)}sp();return 0}
case'search':{io.out('Sorting... Done\nFull Text Search... Done\n');if(!pk.lists)return 0;const t=ar.map(x=>x.toLowerCase());
for(const p of CAT)if(t.every(x=>(p[0]+' '+p[2]).toLowerCase().includes(x)))io.out(p[0]+'/jammy'+(pk.inst[p[0]]?' '+pk.inst[p[0]]+' amd64 [installed]':' '+p[1]+' amd64')+'\n  '+p[2]+'\n\n');return 0}
case'show':{for(const n of ar){const p=cat(n);if(!p){io.err('E: No packages found\n');return 100}io.out('Package: '+n+'\nVersion: '+p[1]+'\nPriority: optional\nSection: universe/utils\nInstalled-Size: '+p[3]*3+'\nDepends: '+(p[4].join(', ')||'libc6')+'\nDescription: '+p[2]+'\n\n')}return 0}
case'list':{io.out('Listing... Done\n');const ins=fl.includes('--installed'),up=fl.includes('--upgradable'),U=ups();
for(const p of CAT){const v=pk.inst[p[0]];if(up){if(U.includes(p))io.out(p[0]+'/jammy-updates '+p[6]+' amd64 [upgradable from: '+v+']\n');continue}if(ins&&!v)continue;if(!pk.lists&&!v)continue;io.out(p[0]+'/jammy '+(v||p[1])+' amd64'+(v?' [installed]':'')+'\n')}return 0}
case undefined:case'help':io.out('apt 2.4.9 (amd64)\nUsage: apt [options] command\n  update, upgrade, install <pkg>, remove <pkg>, autoremove, search <term>, show <pkg>, list [--installed|--upgradable]\n');return 0;
default:io.err('E: Invalid operation '+c+'\n');return 100}};
B['apt-cache']=(a,io)=>B.apt(a[0]==='search'||a[0]==='show'?a:['help'],io);
B.dpkg=(a,io)=>{if(a[0]==='-l'||a[0]==='--list'){io.out('Desired=Unknown/Install/Remove/Purge/Hold\n||/ Name            Version           Architecture Description\n+++-===============-=================-============-===================================\n');for(const p of CAT)if(pk.inst[p[0]])io.out('ii  '+p[0].padEnd(15)+' '+pk.inst[p[0]].padEnd(17)+' amd64        '+p[2]+'\n')}
else if(a[0]==='-s'){const n=a[1];if(!pk.inst[n]){io.err("dpkg-query: package '"+n+"' is not installed and no information is available\n");return 1}io.out('Package: '+n+'\nStatus: install ok installed\nVersion: '+pk.inst[n]+'\n')}else throw new Error('supported: -l, -s <pkg>')};
B.which=(a,io)=>{let st=1;for(const x of a){if(has(B,x)||inst(x)){io.out('/usr/bin/'+x+'\n');st=0}}return st};
/* ---------- commands that exist only once their package is installed ---------- */
const X={};
X.hello=(a,io)=>io.out('Hello, world!\n');
X.cowsay=(a,io)=>{const l=(a.join(' ')||inp(io).trim()||'Moo!').split('\n'),w=Math.max(...l.map(x=>x.length)),b=l.length===1?'< '+l[0]+' >':l.map((x,i)=>(i?i===l.length-1?'\\':'|':'/')+' '+x.padEnd(w)+' '+(i?i===l.length-1?'/':'|':'\\')).join('\n');
io.out(' '+'_'.repeat(w+2)+'\n'+b+'\n '+'-'.repeat(w+2)+'\n'+String.raw`        \   ^__^
         \  (oo)\_______
            (__)\       )\/\
                ||----w |
                ||     ||
`)};
X.fortune=(a,io)=>{const q=['A script that works on the first try is usually hiding something.','The shell forgets nothing except what you meant to type.','Every rm -rf is a short story with a sad ending.','Tab completes you.','There is no place like ~.','Today you will cat a file, and it will be the wrong one.'];io.out(q[Math.floor(Math.random()*q.length)]+'\n')};
X.tree=(a,io)=>{const st=a[0]||'.',n=node(st);if(!n)throw new Error(st+' [error opening dir]');let d=0,f=0;const o=[st],w=(n,pre)=>{if(n.t!=='d')return;const k=Object.keys(n.c).filter(x=>x[0]!=='.').sort();k.forEach((x,i)=>{const l=i===k.length-1;o.push(pre+(l?'└── ':'├── ')+x);if(n.c[x].t==='d'){d++;w(n.c[x],pre+(l?'    ':'│   '))}else f++})};w(n,'');io.out(o.join('\n')+'\n\n'+d+' directories, '+f+' files\n')};
X.bc=(a,io)=>{const l=a.includes('-l');for(const e of files(a.filter(x=>x[0]!=='-'),io).flatMap(lines)){if(!e.trim())continue;if(!/^[\d\s+\-*/%().^]+$/.test(e))throw new Error('syntax error');let r=Function('"use strict";return('+e.replace(/\^/g,'**')+')')();if(!l)r=Math.trunc(r);io.out(String(+r.toFixed(10))+'\n')}};
X.neofetch=(a,io)=>{const n=sh.env.USER+'@browser';io.out(n+'\n'+'-'.repeat(n.length)+'\nOS: Ubuntu 22.04 LTS (simulated) x86_64\nKernel: 6.0.0-js\nUptime: '+Math.round(performance.now()/60000)+' mins\nPackages: '+Object.keys(pk.inst).length+' (dpkg)\nShell: bash 5.1 (JavaScript)\nResolution: '+screen.width+'x'+screen.height+'\nCPU: '+(navigator.hardwareConcurrency||'?')+' cores (your real browser)\nMemory: '+(navigator.deviceMemory?navigator.deviceMemory+' GB':'unknown')+'\nNetwork: '+(sh.net.ssid||'disconnected')+'\n')};
X.ifconfig=(a,io)=>io.out('lo: flags=73<UP,LOOPBACK,RUNNING>  mtu 65536\n        inet 127.0.0.1  netmask 255.0.0.0\nwlan0: flags='+(netOk()?'4163<UP,BROADCAST,RUNNING,MULTICAST>':'4099<UP,BROADCAST,MULTICAST>')+'  mtu 1500\n'+(netOk()?'        inet 192.168.1.42  netmask 255.255.255.0  broadcast 192.168.1.255\n':'')+'        ether 02:42:ac:11:00:02\n');
X.iwconfig=(a,io)=>io.out('wlan0     IEEE 802.11  ESSID:"'+(sh.net.ssid||'off/any')+'"\n          Mode:Managed  '+(sh.net.ssid?'Frequency:5.18 GHz  Access Point: 02:00:00:00:00:00\n          Link Quality=70/70  Signal level=-40 dBm\n':'Access Point: Not-Associated\n')+'lo        no wireless extensions.\n');
X.curl=async(a,io)=>{let url=null,o=null,I=0;for(let i=0;i<a.length;i++){const x=a[i];if(x==='-o')o=a[++i];else if(x==='-I'||x==='--head')I=1;else if(x[0]!=='-')url=x}
if(!url)throw new Error("try 'curl --help' for more information");if(!/^https?:/.test(url))url='https://'+url;
if(!netOk()){io.err('curl: (6) Could not resolve host: '+url.split('/')[2]+'\n');return 6}
try{const r=await fetch(url),t=I?'HTTP '+r.status+'\n'+[...r.headers].map(([k,v])=>k+': '+v).join('\n')+'\n':await r.text();o?wr(o,t):io.out(t)}catch(e){io.err('curl: (7) Failed to connect: the browser blocked the request (CORS or mixed content)\n');return 7}};
X.wget=async(a,io)=>{let url=null,o=null;for(let i=0;i<a.length;i++){if(a[i]==='-O')o=a[++i];else if(a[i][0]!=='-')url=a[i]}
if(!url)throw new Error('missing URL');if(!/^https?:/.test(url))url='https://'+url;if(!netOk()){io.err("wget: unable to resolve host address '"+url.split('/')[2]+"'\n");return 4}
o=o||url.split('?')[0].split('/').filter(Boolean).slice(2).pop()||'index.html';
try{const r=await fetch(url);if(!r.ok){io.err('ERROR '+r.status+'\n');return 8}const t=await r.text();wr(o,t);io.out("'"+o+"' saved ["+t.length+"]\n")}catch(e){io.err('wget: the browser blocked the request (CORS or mixed content)\n');return 4}};
/* ---------- terminal UI ---------- */
function print(s,c){if(!s)return;const n=document.createElement('span');if(c)n.className=c;n.textContent=s;$log.append(n);$t.scrollTop=$t.scrollHeight}
let busy=false,cont='',readCb=null,hi=0;
const short=p=>p===sh.env.HOME?'~':p.startsWith(sh.env.HOME+'/')?'~'+p.slice(sh.env.HOME.length):p;
const pnodes=()=>readCb?[[readCb.p,'']]:cont?[['> ','']]:[[sh.env.USER+'@browser','pr'],[':',''],[short(sh.env.PWD),'pd'],[sh.env.USER==='root'?'# ':'$ ','']];
function setPrompt(){$in.type=readCb&&readCb.secret?'password':'text';$pr.textContent='';for(const[t,c]of pnodes()){const s=document.createElement('span');if(c)s.className=c;s.textContent=t;$pr.append(s)}$row.style.display=busy&&!readCb?'none':'flex';if($row.style.display==='flex')$in.focus();$t.scrollTop=$t.scrollHeight}
function echoPrompt(line){for(const[t,c]of pnodes())print(t,c);print((readCb&&readCb.secret?'':line)+'\n')}
function askLine(p,secret){return new Promise(r=>{readCb={p,r,secret};setPrompt()})}
const tio={stdin:{s:null},out:s=>print(s),err:s=>print(s,'er')};
async function submit(line){
const src=cont+line;if(!src.trim()&&!cont)return;let L;
try{L=parse(lex(src))}catch(e){if(e&&e.inc){cont=src+'\n';setPrompt();return}cont='';print((e.message||e)+'\n','er');sh.st=2;return}
cont='';if(src.trim()){sh.hist.push(src);hi=sh.hist.length}
busy=true;sh.int=false;setPrompt();
try{await execList(L,tio)}catch(e){if(e instanceof Ctl){if(e.k==='exit'){if(sh.stack.length){const s=sh.stack.pop();sh.env.USER=s.u;sh.env.HOME=s.h;sh.env.PWD=s.p;print('exit\n')}else print('logout\n')}else if(e.k==='int'){print('^C\n');sh.st=130}}else print((e.message||String(e))+'\n','er')}
readCb=null;busy=false;setPrompt()}
function complete(){const v=$in.value.slice(0,$in.selectionStart),w=v.match(/(\S*)$/)[1],first=v.slice(0,v.length-w.length).trim()==='';let c;
if(first&&!w.includes('/'))c=[...new Set([...Object.keys(B),...Object.keys(X).filter(inst),...Object.keys(sh.funcs)])].filter(x=>x.startsWith(w)&&!/^[\[.:]/.test(x)).map(x=>x+' ');
else{const k=w.lastIndexOf('/'),dp=w.slice(0,k+1),bs=w.slice(k+1),d=node(dp||'.');c=d&&d.t==='d'?Object.keys(d.c).filter(n=>n.startsWith(bs)&&(bs||n[0]!=='.')).sort().map(n=>dp+n+(d.c[n].t==='d'?'/':' ')):[]}
if(!c.length)return;let cp=c[0];for(const x of c)while(!x.startsWith(cp))cp=cp.slice(0,-1);
if(c.length===1||cp.length>w.length)$in.setRangeText(cp,$in.selectionStart-w.length,$in.selectionStart,'end');
else{echoPrompt($in.value);print(c.map(x=>x.trim()).join('  ')+'\n')}}
$in.addEventListener('keydown',e=>{
if(e.ctrlKey&&e.key==='c'&&$in.selectionStart===$in.selectionEnd){e.preventDefault();if(busy)sh.int=true;else{echoPrompt($in.value+'^C');$in.value='';cont=''}if(readCb){const cb=readCb;readCb=null;cb.r('');sh.int=true}setPrompt();return}
if(e.ctrlKey&&e.key==='l'){e.preventDefault();$log.textContent='';return}
if(e.key==='Enter'){e.preventDefault();const line=$in.value;$in.value='';echoPrompt(line);if(readCb){const cb=readCb;readCb=null;setPrompt();cb.r(line);return}if(!busy)submit(line);return}
if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();hi=Math.max(0,Math.min(sh.hist.length,hi+(e.key==='ArrowUp'?-1:1)));$in.value=sh.hist[hi]??'';return}
if(e.key==='Tab'){e.preventDefault();complete()}});
$t.addEventListener('click',()=>{if(!getSelection().toString())$in.focus()});
print('bash, running entirely in your browser. Files persist in this browser.\nType help to see what is available. Try: bash demo.sh, or sudo apt update. The Real Linux tab is described in README.md.\n\n');
setPrompt();
