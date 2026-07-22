// NAVEE XT5 Unlock - standalone Web Bluetooth. All BLE stays local; no server, no tracking.
// Reverse-engineered from the official app (com.navee.ucaret v2.1.5, com.uz.navee.ble.*).
//
// Protocol (confirmed from decompiled BleHandler / ByteUtil):
//   GATT service 0000d0ff-3c17-d293-8e48-14fe2e4da212, WRITE 0000b002, NOTIFY 0000b003
//   Frame READ : 55 AA 00 <cmd> <cksum> FE FD
//   Frame WRITE: 55 AA 00 <cmd> <len> <payload...> <cksum> FE FD
//   cksum = (sum of every byte from 0x55 through the last payload byte) & 0xFF
//   Auth = challenge/response:
//     TX 0x30  55 AA 00 30 09 <keyIdx> 00 <s(userId)=8A + 48bitBE, 6B> 00 <cksum> FE FD
//     RX 0x30  scooter returns a 16-byte challenge
//     TX 0x31  55 AA 00 31 10 <AES-128-ECB(challenge, keys[keyIdx])> <cksum> FE FD
//   Region write (persistent unlock): 55 AA 00 6F 02 08 <country> <cksum> FE FD
//     <country> = latlngCountryValue (server-issued int) - supply via field or Scan.
const BUILD = 'v1';
const AUTO_UID = Math.floor(Math.random()*1e9)+1;   // account id is only a tag; a random one works
const SERVICE     = '0000d0ff-3c17-d293-8e48-14fe2e4da212';
const WRITE_CHAR  = '0000b002-0000-1000-8000-00805f9b34fb';
const NOTIFY_CHAR = '0000b003-0000-1000-8000-00805f9b34fb';

const CMD = { AUTH_INIT:0x30, AUTH_RESP:0x31, REGION:0x6F, READ_PARAMS:0x70, READ_SN:0x72, REPORT:0x70, SN_REPORT:0x74 };

// 5 built-in AES-128 keys (BleHandler.f19371l)
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
function setStatus(s){ const el=$('status'); el.textContent=s; el.dataset.state=s; }
const sleep = ms => new Promise(r=>setTimeout(r,ms));

function ckSum(arr){ let s=0; for(const b of arr) s=(s+b)&0xff; return s; }
function readFrame(cmd){ const body=[0x55,0xAA,0x00,cmd]; return new Uint8Array([...body, ckSum(body),0xFE,0xFD]); }
function writeFrame(cmd,payload){ payload=payload||[]; const body=[0x55,0xAA,0x00,cmd,payload.length,...payload]; return new Uint8Array([...body, ckSum(body),0xFE,0xFD]); }

// s(userId,0x8A): 6 bytes = 48-bit big-endian userId with top byte forced to 0x8A (ByteUtil.s)
function s6(userId){
  const b=new Uint8Array(6); let v=BigInt(userId>>>0);
  for(let i=5;i>=0;i--){ b[i]=Number(v & 0xffn); v>>=8n; }
  b[0]=0x8A; return b;
}
// 0x30 auth-init: payload = [keyIdx, 0x00, ...s6, 0x00]
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

async function handleFrame(f){
  log('RX '+hexs(f));
  const cmd=f[3], len=f[4], payload=f.slice(5,5+len);
  if(cmd===CMD.AUTH_INIT){                 // challenge from scooter
    if(payload.length>=16){
      const challenge=payload.slice(payload.length-16);
      log('auth challenge received, responding (key '+curKeyIdx+')');
      await sendFrame(await authRespFrame(challenge, curKeyIdx));
      authed=true; setStatus('connected'); refreshButtons(); log('authenticated');
    } else { authed=true; refreshButtons(); }  // short ack
    return;
  }
  // fulfil any waiter for this cmd
  const w=waiters.find(x=>x.cmd===cmd); if(w){ waiters=waiters.filter(x=>x!==w); w.res(f); }
  if(cmd===CMD.REPORT) decodeParams(f);
  if(cmd===CMD.SN_REPORT) decodeSN(f);
}

// param report (cmd 0x70): offsets into the data block (payload). Raw is logged so offsets are verifiable.
function decodeParams(f){
  const p=f.slice(5, 5+f[4]);
  const at=i=> (i<p.length? p[i] : null);
  const startSpeed=at(19), limitSpeed=at(20), maxSpeed=at(25), lock=at(2), unit=at(7);
  if(maxSpeed!=null) $('t-max').textContent=maxSpeed;
  if(limitSpeed!=null) $('t-limit').textContent=limitSpeed;
  log(`params: max=${maxSpeed} limit=${limitSpeed} start=${startSpeed} lock=${lock} unit=${unit}`);
  return {maxSpeed, limitSpeed};
}
function decodeSN(f){
  const p=f.slice(5, 5+f[4]);
  let sn=''; for(const c of p){ if(c>=0x20&&c<0x7f) sn+=String.fromCharCode(c); }
  sn=sn.trim();
  if(sn.length>=10){ const area=sn.substring(8,10); $('t-sn').textContent=sn; $('t-region').textContent=area; $('t-sku').textContent=skuOf(area); log('serial '+sn+' -> region '+area+' (SKU '+skuOf(area)+')'); }
  else log('SN report: '+hex(f));
}

async function connect(){
  try{
    setStatus('connecting');
    device=await navigator.bluetooth.requestDevice({ filters:[{services:[SERVICE]}], optionalServices:[SERVICE] });
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
  await sendFrame(readFrame(CMD.READ_SN));    // -> 0x74 serial/region
  await sleep(300);
  await sendFrame(readFrame(CMD.READ_PARAMS)); // -> 0x70 speeds
}

async function writeCountry(val){
  if(!authed){ log('not authenticated'); return; }
  val=val&0xff;
  await sendFrame(writeFrame(CMD.REGION, [0x08, val]));
  log('country -> '+val+' (0x'+val.toString(16)+')');
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

function onDisconnect(){ connected=false; authed=false; writeCh=notifyCh=null; rx=[]; setStatus('disconnected'); log('disconnected'); refreshButtons(); }
function disconnect(){ if(device&&device.gatt.connected) device.gatt.disconnect(); }

function refreshButtons(){
  const on=connected;
  $('btn-read').disabled=!on; $('btn-unlock').disabled=!on; $('btn-scan').disabled=!on; $('country-in').disabled=!on;
}

$('btn-connect').addEventListener('click', connect);
$('btn-disconnect').addEventListener('click', disconnect);
$('btn-read').addEventListener('click', readStatus);
$('btn-unlock').addEventListener('click', ()=> writeCountry(parseInt($('country-in').value||'0',10)||0));
$('btn-scan').addEventListener('click', scan);
log('NAVEE unlock build '+BUILD);
log('Auth + region-write are byte-exact from the app. The country VALUE and the report offsets are verified live on the scooter (Read status + Scan).');
if(!('bluetooth' in navigator)) log('Web Bluetooth not available - use Chrome (Android/desktop) or Bluefy (iOS).');
