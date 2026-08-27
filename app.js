// NAVEE XT5 Unlock - standalone Web Bluetooth. All BLE stays local; no server, no tracking.
// Reverse-engineered from the official app (com.navee.ucaret, com.uz.navee.ble.*).
//
// Verified byte-for-byte against the decompiled app v2.1.6 (versionCode 110).
// (The repo previously referenced v2.1.5; keys, frame format and auth are unchanged in 2.1.6.)
//
// Protocol (confirmed from decompiled BleHandler / ByteUtil in v2.1.6):
//   GATT service 0000d0ff-3c17-d293-8e48-14fe2e4da212, WRITE 0000b002, NOTIFY 0000b003
//   Frame READ : 55 AA <flag> <cmd> <cksum> FE FD                       (BleHandler.j)
//   Frame WRITE: 55 AA <flag> <cmd> <len> <payload...> <cksum> FE FD    (BleHandler.k/l)
//   flag byte is 0x00 for all app reads/writes; cksum = (sum of every byte from 0x55
//   through the last payload byte) & 0xFF (BleHandler.d0).
//   RX  frame : 55 AA <flag> <cmd> <len> <ERRCODE> <data...> <cksum> FE FD
//     IMPORTANT: on receive, byte[5] is an ERROR/STATUS code (0 = ok). The data block the
//     app decodes starts at byte[6]. <len> counts errcode + data. (BleHandler.G, line ~260)
//   Auth = challenge/response (byte-exact, unchanged):
//     TX 0x30  55 AA 00 30 09 <keyIdx> <shareFlag> <s(userId)=8A + 48bitBE, 6B> 00 <cksum> FE FD
//     RX 0x30  scooter returns a 16-byte challenge (data block)
//     TX 0x31  55 AA 00 31 10 <AES-128-ECB-encrypt(challenge, keys[keyIdx])> <cksum> FE FD
//     RX 0x31  errcode 0 => authenticated
//   ByteUtil.j = AES/ECB/NoPadding, Cipher ENCRYPT (mode 1) -> the response IS an encryption.
//
// Speed levers (all verified in v2.1.6, sent via BleHandler.k/l from the app's own screens):
//   0x6B (107) custom speed limit  : 55 AA 00 6B 01 <val> ...   val = kmh & 0x7F, bit7 = limit-on
//                                    (SpeedLimitActivity -> sendCmd 107)
//   0x6E (110) max speed / mode    : 55 AA 00 6E 02 01 <val> ... subcmd 01 = set max speed = <val> kmh
//                                    (MaxSpeedActivity -> sendCmd 110 {1, val})
//   0x6A (106) startup speed       : 55 AA 00 6A 01 <val> ...   (StartupSpeedActivity -> sendCmd 106)
//   0x6F (111) scooter params      : subcmd 08 = region/country (persistent SKU), subcmd 06 = time
//                                    (BleHandlerDevicePort CountryConfig / BleHandler time sync)
//   For an XT5 (PID prefix 2782) the app itself offers max speed up to 32 km/h. Values beyond that
//   are not exercised by the app and depend on what the firmware accepts (hardware test).
const BUILD = 'v3';
const AUTO_UID = Math.floor(Math.random()*1e9)+1;   // account id is only a tag; a random one works
const SERVICE     = '0000d0ff-3c17-d293-8e48-14fe2e4da212';
const WRITE_CHAR  = '0000b002-0000-1000-8000-00805f9b34fb';
const NOTIFY_CHAR = '0000b003-0000-1000-8000-00805f9b34fb';

const CMD = {
  AUTH_INIT:0x30, AUTH_RESP:0x31,
  START_SPEED:0x6A, LIMIT_SPEED:0x6B, MAX_SPEED:0x6E,   // direct speed levers
  REGION:0x6F,                                          // scooter params (subcmd 08 = country)
  READ_PARAMS:0x70, REPORT:0x70,                        // read/report full vehicle param block
  READ_BATTERY:0x72,                                    // (was mislabelled READ_SN in the old build)
  READ_SN:0x74, SN_REPORT:0x74,                         // read/report car serial (region source)
};

// 5 built-in AES-128 keys (BleHandler.f19454l) - byte-for-byte identical in v2.1.6.
const KEYS = [
  [0xA0,0xA1,0xA2,0xA3,0xA4,0xA5,0xA6,0xA7,0xA8,0xA9,0xAA,0xAB,0xAC,0xAD,0xAE,0xAF],
  [0x44,0x6D,0x10,0x72,0x6D,0xBE,0x05,0xF6,0x62,0xDF,0xAA,0xF0,0x13,0x27,0x30,0x3F],
  [0xA2,0x85,0xCC,0xEC,0x81,0x4F,0xE9,0x61,0x74,0x29,0x95,0xE8,0xEB,0xA9,0x22,0x47],
  [0x3F,0xEE,0x80,0xFF,0x96,0xDF,0x5C,0xF5,0x42,0xEA,0xAC,0x93,0x28,0x1F,0xE5,0x29],
  [0x4E,0xB4,0xD4,0x64,0xD6,0xEF,0x53,0xED,0x6C,0xE9,0x45,0x58,0xDE,0x9A,0x5E,0xE3],
].map(a => new Uint8Array(a));

// Region -> SKU (BleHandler.a0), AreaCode derived read-only from serial[8:10]
function skuOf(area){ return ['IT','DE','NE'].includes(area) ? 'ITA' : ['US','CN','RU'].includes(area) ? 'USA' : 'EUR'; }

// ---------- helpers ----------
const $ = id => document.getElementById(id);
function log(m){ const el=$('log'); el.textContent += m + '\n'; el.scrollTop = el.scrollHeight; }
function hex(b){ return [...b].map(x=>x.toString(16).padStart(2,'0')).join(''); }
function hexs(b){ return [...b].map(x=>x.toString(16).padStart(2,'0')).join(' '); }
// data-state stays the canonical english key (CSS keys off it); the visible text is translated.
function setStatus(s){ const el=$('status'); if(!el) return; el.dataset.state=s; const k='st'+s.charAt(0).toUpperCase()+s.slice(1); el.textContent = (typeof t==='function' ? t(k) : '') || s; }
const sleep = ms => new Promise(r=>setTimeout(r,ms));

function ckSum(arr){ let s=0; for(const b of arr) s=(s+b)&0xff; return s; }
// READ frame: 55 AA 00 <cmd> <ck> FE FD (BleHandler.j)
function readFrame(cmd){ const body=[0x55,0xAA,0x00,cmd]; return new Uint8Array([...body, ckSum(body),0xFE,0xFD]); }
// WRITE frame: 55 AA 00 <cmd> <len> <payload...> <ck> FE FD (BleHandler.k single byte / l byte[])
function writeFrame(cmd,payload){ payload=payload||[]; const body=[0x55,0xAA,0x00,cmd,payload.length,...payload]; return new Uint8Array([...body, ckSum(body),0xFE,0xFD]); }

// s(userId,0x8A): 6 bytes = low 48-bit big-endian userId, top byte forced to 0x8A when zero (ByteUtil.s)
function s6(userId){
  const b=new Uint8Array(6); let v=BigInt(userId>>>0);
  for(let i=5;i>=0;i--){ b[i]=Number(v & 0xffn); v>>=8n; }
  b[0]=0x8A; return b;
}
// 0x30 auth-init: payload = [keyIdx, shareFlag, ...s6, 0x00]  (len = 9). shareFlag 0 for a random uid.
function authInitFrame(userId,keyIdx){ return writeFrame(CMD.AUTH_INIT, [keyIdx, 0x00, ...s6(userId), 0x00]); }

// AES-128-ECB of one 16-byte block (WebCrypto CBC with zero IV == ECB for the first block)
async function aesEcb16(key16, block16){
  const k = await crypto.subtle.importKey('raw', key16, {name:'AES-CBC'}, false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({name:'AES-CBC', iv:new Uint8Array(16)}, k, block16));
  return ct.slice(0,16);
}
async function authRespFrame(challenge16,keyIdx){ const ct=await aesEcb16(KEYS[keyIdx], challenge16); return writeFrame(CMD.AUTH_RESP, [...ct]); }

function parseHexFrame(s){
  const clean=(s||'').replace(/[^0-9a-fA-F]/g,''); if(clean.length<8||clean.length%2) return null;
  return new Uint8Array(clean.match(/../g).map(h=>parseInt(h,16)));
}

// ---------- BLE ----------
let device=null, writeCh=null, notifyCh=null, connected=false, authed=false, curKeyIdx=0;
let waiters=[];   // resolve on next report of a given cmd
function waitReport(cmd, ms=3000){
  return new Promise(res=>{ const w={cmd,res}; waiters.push(w); setTimeout(()=>{ waiters=waiters.filter(x=>x!==w); res(null); }, ms); });
}

async function sendFrame(bytes){
  if(!writeCh) throw new Error('not connected');
  log('TX '+hexs(bytes));
  try{ await writeCh.writeValueWithoutResponse(bytes); }catch{ await writeCh.writeValue(bytes); }
}

let rx=[];
function onNotify(ev){
  for(const b of new Uint8Array(ev.target.value.buffer)) rx.push(b);
  for(;;){
    const start=rx.findIndex((b,i)=>b===0x55&&rx[i+1]===0xAA);
    if(start<0){ rx=[]; break; }
    if(start>0) rx=rx.slice(start);
    const end=rx.findIndex((b,i)=>b===0xFE&&rx[i+1]===0xFD);
    if(end<0) break;
    handleFrame(new Uint8Array(rx.slice(0,end+2))); rx=rx.slice(end+2);
  }
}

// RX layout (verified): [0]55 [1]AA [2]flag [3]cmd [4]len [5]errcode [6..]data <ck> FE FD
// len counts errcode + data, so data = frame[6 .. 5+len].
function frameParts(f){
  const cmd=f[3], len=f[4], err=f[5];
  const data=f.slice(6, 5+len);
  return {cmd, len, err, data};
}

async function handleFrame(f){
  log('RX '+hexs(f));
  const {cmd, err, data} = frameParts(f);
  if(cmd===CMD.AUTH_INIT){                 // 0x30 from scooter
    if(err!==0){ log('auth error code '+err); setStatus('error'); return; }
    if(data.length>=16){                   // challenge present
      const challenge=data.slice(data.length-16);
      log('auth challenge received, responding (key '+curKeyIdx+')');
      await sendFrame(await authRespFrame(challenge, curKeyIdx));
    } else {                               // short ack = session already up
      authed=true; setStatus('connected'); refreshButtons(); log('authenticated (ack)');
    }
    return;
  }
  if(cmd===CMD.AUTH_RESP){                  // 0x31 result
    if(err===0){ authed=true; setStatus('connected'); refreshButtons(); log('authenticated'); }
    else log('auth response rejected, code '+err);
    return;
  }
  // fulfil any waiter for this cmd
  const w=waiters.find(x=>x.cmd===cmd); if(w){ waiters=waiters.filter(x=>x!==w); w.res(f); }
  if(cmd===CMD.REPORT) decodeParams(f);
  if(cmd===CMD.SN_REPORT) decodeSN(f);
}

// Full vehicle param report (cmd 0x70). Offsets are into the DATA block (byte[6]+), taken
// verbatim from DeviceCarInfo parsing in BleHandler.G case 112 (v2.1.6). Raw is logged too.
function decodeParams(f){
  const {err, data:p} = frameParts(f);
  if(err!==0){ log('param report error code '+err); return {}; }
  const at=i=> (i<p.length? p[i] : null);
  const o = {
    lock:        at(2),
    unit:        at(7),   // mileage unit (0 km / 1 mph)
    startSpeed:  at(19),
    limitSpeed:  at(20),
    maxSpeed:    at(25),
    driveMode:   at(26),
    breakSpeed:  at(35),
  };
  // the custom-limit byte carries the enable flag in bit7; show the plain value too
  const limitVal = o.limitSpeed==null ? null : (o.limitSpeed & 0x7f);
  if(o.maxSpeed!=null)  $('t-max').textContent   = o.maxSpeed;
  if(limitVal!=null)    $('t-limit').textContent = limitVal + (o.limitSpeed & 0x80 ? ' (on)' : ' (off)');
  log(`params: max=${o.maxSpeed} limit=${limitVal} start=${o.startSpeed} mode=${o.driveMode} lock=${o.lock} unit=${o.unit}`);
  log('raw param data: '+hexs(p));
  applyReportToSettings(p);
  return o;
}
function decodeSN(f){
  const {err, data:p} = frameParts(f);
  if(err!==0){ log('SN report error code '+err); return; }
  let sn=''; for(const c of p){ if(c>=0x20&&c<0x7f) sn+=String.fromCharCode(c); }
  sn=sn.trim();
  if(sn.length>=10){ const area=sn.substring(8,10); $('t-sn').textContent=sn; $('t-region').textContent=area; $('t-sku').textContent=skuOf(area); log('serial '+sn+' -> region '+area+' (SKU '+skuOf(area)+')'); }
  else log('SN report: '+hexs(f));
}

async function connect(){
  try{
    setStatus('connecting');
    // The app scans and matches by NAME (name.contains("NAVEE")); the scooter does not advertise
    // the 128-bit service UUID, so filtering by service would show an empty chooser. Filter by name
    // and declare the service as optional so we can use it after connecting.
    const showAll = $('showall') && $('showall').checked;
    const opts = showAll
      ? { acceptAllDevices:true, optionalServices:[SERVICE] }
      : { filters:[{namePrefix:'NAVEE'}], optionalServices:[SERVICE] };
    device=await navigator.bluetooth.requestDevice(opts);
    device.addEventListener('gattserverdisconnected', onDisconnect);
    const server=await device.gatt.connect();
    const svc=await server.getPrimaryService(SERVICE);
    writeCh=await svc.getCharacteristic(WRITE_CHAR);
    notifyCh=await svc.getCharacteristic(NOTIFY_CHAR);
    await notifyCh.startNotifications();
    notifyCh.addEventListener('characteristicvaluechanged', onNotify);
    connected=true; authed=false; setStatus('connected');
    log('connected to '+(device.name||device.id)); refreshButtons();
    await sleep(150); await authenticate();
  }catch(e){ setStatus('error'); log('connect failed: '+e.message); }
}

async function authenticate(){
  const hexIn=$('authhex-in').value.trim();
  let f;
  if(hexIn){ f=parseHexFrame(hexIn); if(!f){ log('invalid auth hex'); return; } curKeyIdx=f[5]??0; log('sending pasted auth frame (key '+curKeyIdx+')'); }
  else { const ov=parseInt($('uid-in').value,10); const uid=(Number.isFinite(ov)&&ov>0)?ov:AUTO_UID; curKeyIdx=Math.floor(Math.random()*KEYS.length); f=authInitFrame(uid,curKeyIdx); log('auth init (key '+curKeyIdx+')'); }
  await sendFrame(f);   // the 0x30 challenge reply is handled in handleFrame
}

async function readStatus(){
  if(!authed){ log('not authenticated yet'); return; }
  await sendFrame(readFrame(CMD.READ_SN));     // 0x74 -> serial/region (source of the SKU)
  await sleep(300);
  await sendFrame(readFrame(CMD.READ_PARAMS)); // 0x70 -> full param block incl. speeds
}

// ----- writers -----
async function writeCountry(val){
  if(!authed){ log('not authenticated'); return; }
  val=val&0xff;
  await sendFrame(writeFrame(CMD.REGION, [0x08, val]));   // 0x6F subcmd 08 = country/region
  log('country -> '+val+' (0x'+val.toString(16)+')');
}
// Direct custom speed limit (0x6B). enabled sets bit7 (limit active).
async function writeLimitSpeed(kmh, enabled){
  if(!authed){ log('not authenticated'); return; }
  const val=((kmh&0x7f) | (enabled?0x80:0)) & 0xff;
  await sendFrame(writeFrame(CMD.LIMIT_SPEED, [val]));
  log('limit speed -> '+(kmh&0x7f)+' km/h '+(enabled?'(on)':'(off)'));
}
// Direct max speed (0x6E, subcmd 01).
async function writeMaxSpeed(kmh){
  if(!authed){ log('not authenticated'); return; }
  await sendFrame(writeFrame(CMD.MAX_SPEED, [0x01, kmh&0xff]));
  log('max speed -> '+(kmh&0xff)+' km/h');
}
// Direct startup speed (0x6A). value 0 = zero-start, higher = push-to-start threshold.
async function writeStartSpeed(v){
  if(!authed){ log('not authenticated'); return; }
  await sendFrame(writeFrame(CMD.START_SPEED, [v&0xff]));
  log('start speed -> '+(v&0xff));
}
// Single-byte setting write, e.g. a 0/1 toggle: 55 AA 00 <cmd> 01 <v> ... (BleHandler.k)
async function writeToggle(cmd, v){
  if(!authed){ log('not authenticated'); return; }
  await sendFrame(writeFrame(cmd, [v&0xff]));
  log('set 0x'+cmd.toString(16)+' -> '+(v&0xff));
}
// Param sub-command write: 55 AA 00 <cmd> 02 <sub> <v> ... (BleHandler.l), e.g. 0x6F long-range.
async function writeSub(cmd, sub, v){
  if(!authed){ log('not authenticated'); return; }
  await sendFrame(writeFrame(cmd, [sub&0xff, v&0xff]));
  log('set 0x'+cmd.toString(16)+' sub '+sub+' -> '+(v&0xff));
}

// Scan: try candidate country values, read back maxSpeed after each. Finds the unrestricted value.
async function scan(){
  if(!authed){ log('not authenticated'); return; }
  log('scanning country values 0..25 (reading maxSpeed back)...');
  const best={val:null,max:-1};
  for(let v=0; v<=25; v++){
    await writeCountry(v); await sleep(400);
    const rep=await (async()=>{ const p=sendFrame(readFrame(CMD.READ_PARAMS)); const r=waitReport(CMD.REPORT,1500); await p; return r; })();
    const max = rep ? decodeParams(rep).maxSpeed : null;
    log(`  country ${v} -> maxSpeed ${max}`);
    if(max!=null && max>best.max) best={val:v,max};
    await sleep(200);
  }
  if(best.val!=null){ $('country-in').value = best.val; log(`best: country ${best.val} -> maxSpeed ${best.max} (filled into the field - press Unlock to apply)`); }
  else log('scan: no readable maxSpeed - check the raw report bytes in the log');
}

function onDisconnect(){ connected=false; authed=false; writeCh=notifyCh=null; rx=[]; setStatus('disconnected'); log('disconnected'); refreshButtons(); resetSettings(); }
function disconnect(){ if(device&&device.gatt.connected) device.gatt.disconnect(); }

function refreshButtons(){
  const on=connected;
  $('btn-read').disabled=!on; $('btn-unlock').disabled=!on; $('btn-scan').disabled=!on; $('country-in').disabled=!on;
  const sp=$('btn-setspeed'); if(sp){ sp.disabled=!on; $('btn-setlimit').disabled=!on; $('speed-in').disabled=!on; }
  SETTINGS.forEach(s=>{ const b=$(s.btn), sel=$(s.sel); if(b) b.disabled=!on; if(sel) sel.disabled=!on; });
}

// Extra settings: each row is a <select> plus a Set button. All opcodes/payloads are byte-exact
// from the app's own settings screens. `off` is the field's offset in the 0x70 param report; a row
// is only shown when the connected scooter actually reports that byte, so each model shows only the
// options it supports. `state` maps a reported byte to the select value.
const TOGGLE_STATE = v => (v ? 1 : 0);
const SETTINGS = [
  { key:'zero',   sel:'zero-in',   btn:'btn-zero',   off:19, send:v=>writeStartSpeed(v), state:v=>(v===0?0:3) },
  { key:'osc',    sel:'osc-in',    btn:'btn-osc',    off:39, send:v=>writeToggle(0x82,v), state:TOGGLE_STATE },
  { key:'tcs',    sel:'tcs-in',    btn:'btn-tcs',    off:11, send:v=>writeToggle(0x5F,v), state:TOGGLE_STATE },
  { key:'slope',  sel:'slope-in',  btn:'btn-slope',  off:37, send:v=>writeToggle(0x81,v), state:TOGGLE_STATE },
  { key:'cruise', sel:'cruise-in', btn:'btn-cruise', off:3,  send:v=>writeToggle(0x52,v), state:TOGGLE_STATE },
  { key:'lrange', sel:'lrange-in', btn:'btn-lrange', off:38, send:v=>writeSub(0x6F,7,v), state:TOGGLE_STATE },
  { key:'tail',   sel:'tail-in',   btn:'btn-tail',   off:4,  send:v=>writeToggle(0x54,v), state:TOGGLE_STATE },
  { key:'alight', sel:'alight-in', btn:'btn-alight', off:8,  send:v=>writeToggle(0x57,v), state:TOGGLE_STATE },
  { key:'tsound', sel:'tsound-in', btn:'btn-tsound', off:12, send:v=>writeToggle(0x60,v), state:TOGGLE_STATE },
  { key:'unit',   sel:'unit-in',   btn:'btn-unit',   off:7,  send:v=>writeToggle(0x55,v), state:v=>(v?1:0) },
  { key:'prox',   sel:'prox-in',   btn:'btn-prox',   off:13, send:v=>writeToggle(0x61,v), state:TOGGLE_STATE },
];
// Reveal only the settings the scooter reports (data block p from a 0x70 report) and prefill them.
function applyReportToSettings(p){
  let any=false;
  SETTINGS.forEach(s=>{
    const row=$('row-'+s.key); if(!row) return;
    if(s.off < p.length){ row.hidden=false; any=true; const sel=$(s.sel); if(sel) sel.value=String(s.state(p[s.off])); }
    else row.hidden=true;
  });
  const empty=$('more-empty'); if(empty) empty.hidden=any;
}
function resetSettings(){ SETTINGS.forEach(s=>{ const row=$('row-'+s.key); if(row) row.hidden=true; }); const e=$('more-empty'); if(e) e.hidden=false; }

function copyLog(){ const el=$('log'); if(!el) return; navigator.clipboard && navigator.clipboard.writeText(el.textContent); }
function clearLog(){ const el=$('log'); if(el) el.textContent=''; }

function wireControls(){
  $('btn-connect').addEventListener('click', connect);
  $('btn-disconnect').addEventListener('click', disconnect);
  $('btn-read').addEventListener('click', readStatus);
  $('btn-unlock').addEventListener('click', ()=> writeCountry(parseInt($('country-in').value||'0',10)||0));
  $('btn-scan').addEventListener('click', scan);
  $('btn-setspeed').addEventListener('click', ()=> writeMaxSpeed(parseInt($('speed-in').value||'0',10)||0));
  $('btn-setlimit').addEventListener('click', ()=> writeLimitSpeed(parseInt($('speed-in').value||'0',10)||0, true));
  SETTINGS.forEach(s=>{ const b=$(s.btn); if(b) b.addEventListener('click', ()=> s.send(parseInt($(s.sel).value||'0',10)||0)); });
  $('btn-copy-log').addEventListener('click', copyLog);
  $('btn-clear-log').addEventListener('click', clearLog);
}

// ---------- language ----------
let lang='de';
const table = () => (window.I18N && window.I18N[lang]) || {};
function t(key){ const v=table()[key]; return (typeof v==='string') ? v : ''; }
function applyLang(){
  document.documentElement.lang=lang;
  document.querySelectorAll('[data-t]').forEach(n=>{ const v=t(n.getAttribute('data-t')); if(/[<&]/.test(v)) n.innerHTML=v; else n.textContent=v; }); // scan-ok: v is our own i18n string, only the guide link carries markup
  document.querySelectorAll('[data-t-ph]').forEach(n=> n.setAttribute('placeholder', t(n.getAttribute('data-t-ph'))));
  const g=$('link-guide'); if(g) g.href=docFile('GUIDE');
  const li=$('link-license'); if(li) li.href=docFile('LICENSE');
  const pr=$('link-privacy'); if(pr) pr.href=docFile('PRIVACY');
  const tm=$('link-trademarks'); if(tm) tm.href=docFile('TRADEMARKS');
  const ls=$('langs'); if(ls) ls.setAttribute('aria-label', t('langGroup'));
  const bv=$('build-ver'); if(bv) bv.textContent=t('buildLabel')+' '+BUILD;
  document.querySelectorAll('#langs button').forEach(b=> b.setAttribute('aria-pressed', String(b.dataset.lang===lang)));
  const st=$('status'); if(st) setStatus(st.dataset.state||'disconnected');
  const th=$('btn-theme'); if(th){ const dark=document.documentElement.getAttribute('data-theme')!=='light'; th.setAttribute('aria-label', t(dark?'themeToLight':'themeToDark')); th.title=th.getAttribute('aria-label'); }
}
function initLang(){
  let saved=null; try{ saved=localStorage.getItem('navee.lang'); }catch(e){}
  if(saved==='de'||saved==='en') lang=saved;
  document.querySelectorAll('#langs button').forEach(b=> b.addEventListener('click', ()=>{ lang=b.dataset.lang; try{ localStorage.setItem('navee.lang',lang); }catch(e){} applyLang(); }));
}

// ---------- theme ----------
function applyTheme(dark){
  document.documentElement.setAttribute('data-theme', dark?'dark':'light');
  const b=$('btn-theme'); if(b){ b.textContent = dark?'☀':'☾'; b.setAttribute('aria-label', t(dark?'themeToLight':'themeToDark')); b.title=b.getAttribute('aria-label'); }
  try{ localStorage.setItem('navee.theme', dark?'dark':'light'); }catch(e){}
}
function initTheme(){
  let saved=null; try{ saved=localStorage.getItem('navee.theme'); }catch(e){}
  applyTheme(saved!=='light');
  const b=$('btn-theme'); if(b) b.addEventListener('click', ()=> applyTheme(document.documentElement.getAttribute('data-theme')==='light'));
}

// ---------- document viewer ----------
const DOC_TITLES = {
  'GUIDE.de.md':'footGuide','GUIDE.en.md':'footGuide',
  'PRIVACY.de.md':'footPrivacy','PRIVACY.md':'footPrivacy',
  'LICENSE.de.md':'footLicense','LICENSE.md':'footLicense',
  'TRADEMARKS.de.md':'footTrademarks','TRADEMARKS.md':'footTrademarks',
  'README.md':'footReadme',
};
const escHtml = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const slug = s => s.toLowerCase().trim().replace(/[^\w\sÀ-ɏ-]/g,'').replace(/ /g,'-');
function mdToHtml(src){
  const inline = s => escHtml(s)
    .replace(/`([^`]+)`/g,'<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g,(all,text,href)=>{
      if(DOC_TITLES[href]) return `<a href="${href}" data-docfile="${href}">${text}</a>`;
      if(href.startsWith('#')) return `<a href="${href}" data-anchor="${href.slice(1)}">${text}</a>`;
      return `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
    });
  const lines=String(src).replace(/\r\n?/g,'\n').split('\n');
  const out=[]; let listKind=null, li=null, para=[], inFence=false;
  const sink=()=> (li?li.parts:out);
  const flushPara=()=>{ if(para.length){ sink().push('<p>'+inline(para.join(' '))+'</p>'); para=[]; } };
  const closeNested=()=>{ if(li&&li.nested){ li.parts.push('</ul>'); li.nested=false; } };
  const closeLi=()=>{ if(!li) return; flushPara(); closeNested(); out.push('<li>'+li.parts.join('\n')+'</li>'); li=null; };
  const closeList=()=>{ closeLi(); if(listKind){ out.push('</'+listKind+'>'); listKind=null; } };
  const block=()=>{ flushPara(); closeList(); };
  const openList=kind=>{ flushPara(); if(listKind!==kind){ closeList(); out.push('<'+kind+'>'); listKind=kind; } else closeLi(); };
  const cells=l=> l.replace(/^\||\|$/g,'').split('|').map(c=>c.trim());
  for(let i=0;i<lines.length;i++){
    const l=lines[i], body=l.trim(), indented=/^ {2,}\S/.test(l);
    if(inFence){ if(body.startsWith('```')){ sink().push('</code></pre>'); inFence=false; } else sink().push(escHtml(l)); continue; }
    if(body.startsWith('```')){ if(li){ flushPara(); closeNested(); } else block(); sink().push('<pre><code>'); inFence=true; continue; }
    if(body===''){ if(li && /^ {2,}\S/.test(lines[i+1]||'')) flushPara(); else block(); continue; }
    if(/^(-{3,}|\*{3,}|_{3,})\s*$/.test(body)){ block(); out.push('<hr>'); continue; }
    if(body.startsWith('|') && /^\|[\s:|-]+\|?\s*$/.test((lines[i+1]||'').trim())){
      if(li){ flushPara(); closeNested(); } else block();
      sink().push('<div class="doc-table"><table><thead><tr>'+cells(body).map(c=>'<th>'+inline(c)+'</th>').join('')+'</tr></thead><tbody>');
      i++;
      while(i+1<lines.length && lines[i+1].trim().startsWith('|')) sink().push('<tr>'+cells(lines[++i].trim()).map(c=>'<td>'+inline(c)+'</td>').join('')+'</tr>');
      sink().push('</tbody></table></div>'); continue;
    }
    let m;
    if((m=body.match(/^(#{1,4})\s+(.*)$/))){ block(); const n=m[1].length; out.push(`<h${n} id="${slug(m[2])}">${inline(m[2])}</h${n}>`); continue; }
    if((m=body.match(/^>\s?(.*)$/))){ if(li){ flushPara(); closeNested(); } else block(); sink().push('<blockquote>'+inline(m[1])+'</blockquote>'); continue; }
    if(indented && li && (m=body.match(/^[-*]\s+(.*)$/))){ flushPara(); if(!li.nested){ li.parts.push('<ul class="nested">'); li.nested=true; } li.parts.push('<li>'+inline(m[1])+'</li>'); continue; }
    if((m=body.match(/^[-*]\s+(.*)$/)) && !indented){ openList('ul'); li={parts:[inline(m[1])],nested:false}; continue; }
    if((m=body.match(/^\d+\.\s+(.*)$/)) && !indented){ openList('ol'); li={parts:[inline(m[1])],nested:false}; continue; }
    if(li && !indented) closeList();
    if(li) closeNested();
    para.push(body);
  }
  if(inFence) sink().push('</code></pre>');
  block();
  return out.join('\n').replace(/<pre><code>\n/g,'<pre><code>');
}
const docCache={};
const docFile = name => name==='GUIDE' ? `GUIDE.${lang}.md` : name==='README' ? 'README.md' : (lang==='de' ? `${name}.de.md` : `${name}.md`);
function openDoc(name,anchor,titleKey){ openDocFile(docFile(name),anchor,titleKey); }
function openDocFile(file,anchor,titleKey){
  const dlg=$('doc'), body=$('doc-body'); if(!dlg||!body) return;
  const mark=(lang==='de' && !file.includes('.de.') && file!=='README.md') ? ' '+t('docEnglish') : '';
  $('doc-title').textContent=(t(titleKey||DOC_TITLES[file]||'')||file)+mark;
  if(typeof dlg.showModal==='function') dlg.showModal();
  const show=html=>{
    body.innerHTML=html; // scan-ok: html is our own markdown rendered by mdToHtml, which escapes every source char first
    const h1=body.querySelector('h1'); if(h1){ $('doc-title').textContent=h1.textContent.trim()+mark; h1.remove(); }
    body.scrollTop=0;
    if(anchor){ const tgt=body.querySelector('#'+(window.CSS&&CSS.escape?CSS.escape(anchor):anchor)); if(tgt) body.scrollTop=tgt.offsetTop-body.offsetTop; }
  };
  if(docCache[file]){ show(docCache[file]); return; }
  body.innerHTML='<p>'+escHtml(t('docLoading'))+'</p>'; // scan-ok: literal plus escHtml()
  fetch(file+'?v='+BUILD).then(r=>{ if(!r.ok) throw new Error(r.status+' '+r.statusText); return r.text(); })
    .then(txt=>{ docCache[file]=mdToHtml(txt); show(docCache[file]); })
    .catch(e=>{ body.innerHTML='<p>'+escHtml(t('docFail'))+'</p><pre>'+escHtml(file+': '+(e&&e.message?e.message:e))+'</pre>'; }); // scan-ok: literals plus escHtml()
}
function wireDocViewer(){
  document.addEventListener('click', e=>{
    if(!e.target.closest) return;
    const jump=e.target.closest('[data-anchor]');
    if(jump){ e.preventDefault(); const body=$('doc-body'); const tgt=body&&body.querySelector('#'+CSS.escape(jump.getAttribute('data-anchor'))); if(tgt) body.scrollTop=tgt.offsetTop-body.offsetTop; return; }
    const a=e.target.closest('[data-doc], [data-docfile]'); if(!a) return;
    e.preventDefault();
    const file=a.getAttribute('data-docfile'), titleKey=a.getAttribute('data-t')||'';
    if(file) openDocFile(file,'',titleKey); else openDoc(a.getAttribute('data-doc'),'',titleKey);
  });
  ['doc-x','doc-close'].forEach(id=>{ const b=$(id); if(b) b.addEventListener('click', ()=>{ const d=$('doc'); if(d) d.close(); }); });
}

// ---------- help modal ----------
const HELP = {
  speed:   ['s3Title', 'speedHelp'],
  more:    ['moreTitle', 'moreHelp'],
  country: ['s4Title', 'countryHelp'],
  account: ['accountTitle', 'accountHelp'],
  authhex: ['authhexTitle', 'authhexHelp'],
  disclaimer: ['footDisclaimer', 'disclaimerText'],
};
function openHelp(key){ const m=HELP[key]; if(!m) return; const dlg=$('help'); if(!dlg) return; $('help-title').textContent=t(m[0]); $('help-body').textContent=t(m[1]); if(typeof dlg.showModal==='function') dlg.showModal(); }
function closeHelp(){ const d=$('help'); if(d&&d.close) d.close(); }
function wireHelp(){
  document.querySelectorAll('.help-btn').forEach(b=> b.addEventListener('click', ()=> openHelp(b.getAttribute('data-help'))));
  ['help-x','help-close'].forEach(id=>{ const b=$(id); if(b) b.addEventListener('click', closeHelp); });
  const dis=$('link-disclaimer'); if(dis) dis.addEventListener('click', e=>{ e.preventDefault(); openHelp('disclaimer'); });
  document.addEventListener('click', e=>{ if(e.target.closest && e.target.closest('[data-open-disclaimer]')){ e.preventDefault(); openHelp('disclaimer'); } });
}

wireControls();
initLang();
initTheme();
wireDocViewer();
wireHelp();
applyLang();
log('NAVEE unlock '+BUILD);
if(!('bluetooth' in navigator)) log('Web Bluetooth not available - use Chrome (Android/desktop) or Bluefy (iOS).');
