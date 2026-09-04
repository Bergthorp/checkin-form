/**
 * Shared review harness: the toolbar + fake-data driver appended to a copy of
 * the real form. Imported by serve-demos.mjs so the live and staging pages are
 * rendered by identical code and any difference between them is a real product
 * difference.
 */
import fs from 'node:fs';

/** Roster built by build-units.mjs; falls back to the old hand-picked file. */
export const unitsJson = () =>
  fs.existsSync('units.json')
    ? fs.readFileSync('units.json', 'utf8')
    : fs.readFileSync('/tmp/picked.json', 'utf8');

export const harness = (label, banner, buildings, unitsJson, note = "") => `
<!-- ============================================================
     REVIEW HARNESS — appended to a copy of the form. Everything
     above this comment is the product; this block only feeds it
     data and adds the toolbar.
     ============================================================ -->
<style>
  #dbar { position:fixed; left:0; right:0; bottom:0; z-index:9999; background:#1c2024; color:#fff;
          font-family:var(--font); padding:8px 12px 10px; }
  #dbar .row { display:flex; flex-wrap:wrap; gap:6px; align-items:center; justify-content:center; }
  #dbar .row + .row { margin-top:6px; border-top:1px solid #343a40; padding-top:7px; }
  #dbar b { font-size:10px; letter-spacing:.09em; text-transform:uppercase; color:#8b949b; margin-right:4px; }
  #dbar button { background:#343a40; color:#fff; border:none; border-radius:99px; padding:7px 13px;
                 font-family:var(--font); font-size:12.5px; font-weight:600; cursor:pointer; }
  #dbar button.on { background:#6cc0b4; color:#10312d; }
  #dbar .note { font-size:11px; color:#8b949b; }
  #dbar button.bldg { background:#2b3136; }
  #dbar button.bldg.on { background:#e8b25e; color:#2b1e07; }
  #dUnits { max-height:96px; overflow-y:auto; }
  #dbar .count { font-size:11px; color:#8b949b; margin-left:6px; }
  #dflag { position:fixed; top:0; left:0; right:0; z-index:9999; text-align:center;
           font-family:var(--font); font-size:11.5px; font-weight:800; letter-spacing:.08em;
           text-transform:uppercase; padding:5px; color:#fff; background:${banner}; }
  body { padding-top:26px !important; padding-bottom:230px !important; }
</style>
<div id="dflag">${label}${note ? " · " + note : ""}</div>
<div id="dbar">
  <div class="row" id="dBldgs"><b>Building</b></div>
  <div class="row" id="dUnits"><b>Unit</b></div>
  <div class="row">
    <b>When</b>
    <button data-w="near">Under 24h</button>
    <button data-w="far">3+ days before</button>
    <b style="margin-left:10px">Car</b>
    <button data-p="none">Plate missing</button>
    <button data-p="have">Plate given</button>
    <span class="note" id="dNote"></span>
  </div>
</div>
<script>
/* Real rows from the production database. */
const DEMO_UNITS = ${unitsJson};

/* Mirrors lib/checkin/arrival-access.ts — kept in step so the page can't
   disagree with the server about who gets what. */
const DEMO_BUILDINGS = [
${buildings}
];
const dBuilding = n => { const s=(n||'').toLowerCase().replace(/[^a-z ]/g,''); return DEMO_BUILDINGS.find(b=>b.match.some(m=>s.includes(m)))||null; };
function dParse(n){
  const withBlock=/^\\s*([A-Za-z]?\\d{2,4})\\s+B\\s?(\\d{1,2})\\b/.exec(n||'');
  if(withBlock) return {apartment:withBlock[1].toUpperCase(), building:withBlock[2]};
  const bare=/^\\s*([A-Za-z]?\\d{3,4})\\s+\\S/.exec(n||'');
  return bare?{apartment:bare[1].toUpperCase(), building:null}:null;
}
const dZones = { 'gate-tower': { '1':'Yellow', '2':'Green', '3':'Blue' } };
function dLevel(raw){ raw=String(raw||''); const m=/\\b(?:podium|basement|level|b)\\s*-?\\s*([1-9])\\b/i.exec(raw);
  if(!m) return null; if(/\\b(?:podium|basement|level|b)\\s*-?\\s*\\d{3,}/i.test(raw)) return null; return m[1]; }
function dDedupe(bay){ const p=String(bay||'').split(/\\s*(?:&|\\band\\b|,|\\+)\\s*/i).map(x=>x.trim()).filter(Boolean);
  if(p.length<2) return bay; const seen=new Set(); const u=p.filter(x=>{const k=x.toLowerCase(); if(seen.has(k))return false; seen.add(k); return true;});
  return u.length===p.length ? bay : u.join(' and '); }
function dKind(raw){ raw=String(raw||'');
  if(/podium/i.test(raw)) return 'podium';
  if(/basement|\\bb\\s*-?\\s*[1-9]\\b/i.test(raw)) return 'basement';
  return 'level'; }
function dBay(raw){ raw=String(raw||'').trim();
  return raw.replace(/^\\s*(?:podium|basement|level|b)\\s*-?\\s*[1-9]\\b[\\s\\-:.,]*/i, '')
            .replace(/^(?:bay|spot|parking)\\s*(?:no\\.?|number|#)?[\\s\\-:.]*/i, '').trim() || raw; }
const dFloor = a => !/^\\d+$/.test(a) ? null : a.length===3 ? a.slice(0,1) : a.length===4 ? a.slice(0,2) : null;
function dSplit(raw){ const m=/^([0-9]+)\\s*([^0-9\\s].*)?$/.exec((raw||'').trim()); return m?{code:m[1],symbol:(m[2]||'').trim()||null}:{code:(raw||'').trim(),symbol:null}; }
function dAccess(u, near){
  const b = dBuilding(u.listing_name); if(!b) return null;
  // The blur is a 26h window (owner, 2026-08-26). "3+ days before" is outside
  // it, so the masked screen is what production really renders there.
  if(!near) return { unlocked:false, building:b.community, area:b.area, apartment:null, floor:null,
                     doorCode:null, parkingSpot:null, mapUrl:b.communityMap, entry:b.entry, desk:b.desk,
                     codeSymbol:null, guestParking:b.guestParking, platePrompt:b.platePrompt,
                     parkingNote:b.parkingNote||null, blockNo:null, blockWord:null, garage:null,
                     parkingMap:b.parkingMap||null, parkingMapCap:b.parkingMapCap||null, garageEntry:b.garageEntry||'card', arrivalAssist:!!b.arrivalAssist,
                     deskAction:b.deskAction||'booking-id', smartlockTurn:b.smartlockTurn||null, parkFirst:b.parkFirst!==false,
                     cardSpot:b.cardSpot||'coffee-table' };
  const p = dParse(u.listing_name); if(!p) return null;
  const entry = (b.entryByUnit&&b.entryByUnit[p.apartment])||b.entry;
  // "unlocked" units carry no door code by design — don't hide their screen.
  const { code, symbol } = entry==='unlocked' ? {code:null,symbol:null} : dSplit(u.door_code);
  if(entry!=='unlocked' && !code) return null;
  const tower = b.towerFrom ? b.towerFrom(u.listing_name) : null;
  return { unlocked:true, building:b.label(tower||p.building), area:b.area, apartment:p.apartment, floor:dFloor(p.apartment),
           doorCode:code, parkingSpot:b.guestParking?(u.park||null):null, mapUrl:u.map||null,
           entry, desk:b.desk, codeSymbol:symbol, guestParking:b.guestParking,
           platePrompt:b.platePrompt, parkingNote:b.parkingNote||null,
           blockNo:b.blockWord?(tower||p.building):null, blockWord:b.blockWord||null,
           garage: (dZones[b.id] && (tower||p.building) && dZones[b.id][tower||p.building])
             ? { level:(b.garageLevelByUnit&&b.garageLevelByUnit[p.apartment]||'').slice(1)||dLevel(u.park),
                 levelKind:(b.garageLevelByUnit&&b.garageLevelByUnit[p.apartment])
                   ? ({P:'podium',B:'basement',L:'level'}[(b.garageLevelByUnit[p.apartment][0]||'').toUpperCase()]||'level') : dKind(u.park),
                 bay:dDedupe(dBay(u.park)), zone:dZones[b.id][tower||p.building], elevator:(tower||p.building) } : null,
           parkingMap:(b.parkingMapByUnit&&b.parkingMapByUnit[p.apartment])||(b.parkingMapByTower&&(tower||p.building)&&b.parkingMapByTower[tower||p.building])||b.parkingMap||null, parkingMapCap:b.parkingMapCap||null,
           garageEntry:(b.garageEntryByUnit&&b.garageEntryByUnit[p.apartment])||b.garageEntry||'card', arrivalAssist:!!b.arrivalAssist,
           deskAction:b.deskAction||'booking-id', smartlockTurn:b.smartlockTurn||null, parkFirst:b.parkFirst!==false,
           cardSpot:(b.cardSpotByUnit&&b.cardSpotByUnit[p.apartment])||b.cardSpot||'coffee-table' };
}

let dUnit = DEMO_UNITS[0], dNear = true, dPlate = false;
function demoRender(){
  const d = new Date(Date.now() + (dNear ? 20*3600e3 : 5*24*3600e3));
  CHECKIN.live = true;
  CHECKIN.checkinDate = d.toISOString().slice(0,10);
  CHECKIN.mapLink = dUnit.map || null;
  CHECKIN.listingLink = 'https://www.desertkey.ae/listings/332661?ref=checkin';
  CHECKIN.emirateLc = (dUnit.emirate||'').toLowerCase();
  CHECKIN.access = dAccess(dUnit, dNear);
  state.arrTime='19:00'; state.depTime='11:00';
  state.parking='yes'; state.plate = dPlate ? 'AUH 74215' : '';
  state.guests=[{photos:[]},{photos:[]}]; state.sofaBed='no';
  document.getElementById('formView').style.display='none';
  const ev=document.getElementById('extrasView'); if(ev) ev.hidden=true;
  document.getElementById('doneView').style.display='block';
  refreshDoneView();
  document.querySelectorAll('#dUnits button').forEach(b=>b.classList.toggle('on', b.dataset.u===dUnit.listing_name));
  document.querySelectorAll('#dBldgs button').forEach(b=>b.classList.toggle('on', b.dataset.b===dBldg));
  document.querySelectorAll('#dbar [data-w]').forEach(b=>b.classList.toggle('on',(b.dataset.w==='near')===dNear));
  document.querySelectorAll('#dbar [data-p]').forEach(b=>b.classList.toggle('on',(b.dataset.p==='have')===dPlate));
  const a = CHECKIN.access;
  document.getElementById('dNote').textContent =
    !a ? 'old screen — not enabled for this building'
       : (a.unlocked ? 'instructions \\u00b7 ' + a.entry : 'details locked until 24h \\u00b7 ' + a.entry);
  window.scrollTo(0,0);
}
/* Pick a building first, then step through only that building's apartments —
   with 23 Gate Tower units a single flat row of chips is unusable. */
const dCommunity = u => { const b=dBuilding(u.listing_name); return b?b.community:'Not enabled yet'; };
const dApt = u => u.listing_name.replace(/\\s*[-:,].*$/,'').trim();
let dBldg = dCommunity(DEMO_UNITS[0]);

function dUnitsFor(name){ return DEMO_UNITS.filter(u=>dCommunity(u)===name); }
function dPaintUnits(){
  const row=document.getElementById('dUnits');
  row.querySelectorAll('button, .count').forEach(b=>b.remove());
  const list=dUnitsFor(dBldg);
  list.forEach(u=>{
    const b=document.createElement('button');
    b.textContent=dApt(u);
    b.dataset.u=u.listing_name;
    b.title=u.listing_name + (u.park?' \\u00b7 parking '+u.park:'');
    b.onclick=()=>{ dUnit=u; demoRender(); };
    row.appendChild(b);
  });
  const c=document.createElement('span');
  c.className='count'; c.textContent=list.length+' unit'+(list.length===1?'':'s');
  row.appendChild(c);
}

(function(){
  const brow=document.getElementById('dBldgs');
  [...new Set(DEMO_UNITS.map(dCommunity))].forEach(name=>{
    const b=document.createElement('button');
    b.className='bldg'; b.textContent=name; b.dataset.b=name;
    b.onclick=()=>{ dBldg=name; dUnit=dUnitsFor(name)[0]; dPaintUnits(); demoRender(); };
    brow.appendChild(b);
  });
  document.querySelectorAll('#dbar [data-w]').forEach(b=>b.onclick=()=>{ dNear=b.dataset.w==='near'; demoRender(); });
  document.querySelectorAll('#dbar [data-p]').forEach(b=>b.onclick=()=>{ dPlate=b.dataset.p==='have'; demoRender(); });
  // Headless screenshots can't click chips: ?u=<name substring>&w=far&p=have
  const q=new URLSearchParams(location.search);
  const uq=(q.get('u')||'').toLowerCase();
  if(uq){ const hit=DEMO_UNITS.find(x=>x.listing_name.toLowerCase().includes(uq)); if(hit) dUnit=hit; }
  const bq=(q.get('b')||'').toLowerCase();
  if(bq){ const hit=[...new Set(DEMO_UNITS.map(dCommunity))].find(n=>n.toLowerCase().includes(bq));
          if(hit){ dBldg=hit; if(!uq) dUnit=dUnitsFor(hit)[0]; } }
  if(uq) dBldg=dCommunity(dUnit);
  dPaintUnits();
  if(q.get('w')==='far') dNear=false;
  if(q.get('p')==='have') dPlate=true;
  const go=()=>{ try{ demoRender(); }catch(e){ setTimeout(go,150); } };
  setTimeout(go,300);
})();
</script>
</body>`;


export const WATERS = `  { id:'waters-edge', match:['waters edge','water edge'], community:'Water\u2019s Edge', area:'Yas Island, Abu Dhabi',
    label:b=>b?'Water\u2019s Edge \u2013 Building '+b:'Water\u2019s Edge', entry:'lockbox', desk:'security', guestParking:true, platePrompt:true, blockWord:'Building',
    communityMap:'https://www.google.com/maps/search/?api=1&query=Water%27s+Edge+Yas+Island+Abu+Dhabi' },`;
export const PARAMOUNT = `  { id:'paramount', match:['paramount'], community:'Paramount Tower Hotel & Residences', area:'Business Bay, Dubai',
    label:()=> 'Paramount Tower Hotel & Residences', entry:'smartlock', desk:'reception', guestParking:true, platePrompt:false, parkingNote:'steep',
    communityMap:'https://maps.app.goo.gl/norY5Lt4hDuqGsz58' },`;
export const GATE = `  { id:'gate-tower', match:['gate tower'], community:'Gate Tower', area:'Al Reem Island, Abu Dhabi',
    label:b=>b?'Gate Tower '+b:'Gate Tower', entry:'lockbox', desk:'security', guestParking:true, platePrompt:true, blockWord:'Tower',
    towerFrom:n=>(/gate\\s+tower\\s+(\\d{1,2})\\b/i.exec(n)||[])[1]||null,
    parkingMapByTower:{'1':'/gate-parking-map-1.jpg','2':'/gate-parking-map-2.jpg','3':'/gate-parking-map-3.jpg'},
    garageLevelByUnit:{'1506':'B3','1714':'B2','1804':'B3','2004':'B1','2513':'B2','2714':'B2','2802':'L3','3109':'B3','3303':'B1','3808':'B1','4207':'B2','4804':'B3','5411':'L3','5505':'B2','5511':'B3','5806':'B3','5901':'B3','6105':'B2','6205':'B2'},
    parkingMapByUnit:{'2802':'/gate-parking-map-east-1.jpg','5906':'/gate-parking-map-east-1.jpg','6011':'/gate-parking-map-east-1.jpg','5411':'/gate-parking-map-east-3.jpg'},
    cardSpot:'apartment',
    communityMap:'https://www.google.com/maps/search/?api=1&query=Gate+Towers+Al+Reem+Island+Abu+Dhabi' },`;
export const FATTAN = `  { id:'al-fattan', match:['al fattan','marine tower'], community:'Al Fattan Marine Towers', area:'Jumeirah Beach Residence, Dubai',
    label:()=> 'Al Fattan Marine Towers', entry:'smartlock', desk:'reception', guestParking:true, platePrompt:true,
    garageEntry:'plate', parkingNote:'platefee',
    parkingMap:'/al-fattan-parking-map.jpg', parkingMapCap:'two',
    communityMap:'https://maps.app.goo.gl/3oyHZrKygm2gtW8Z7' },`;


// "Check-in Details: 1313 Seven Palm": smart lock, code + hash, knob
// counterclockwise, passports registered with security at the entrance.
// No plate is ever asked for, so no plate nag.

// "Check-in Details" (406): same smart-lock wording as Seven Palm. Two towers
// share the name — "Downtown Views II" must not be labelled "Downtown Views".

// "Additional Information" (315): lockbox next to the door, ID to building
// security, plate required for garage entry. Saadiyat — NOT Al Reem.

// "Additional Information" (207): lockbox next to the door, booking + ID to
// security. One building, so no block/tower wording.


/* ---- Transcribed from each building's own Conduit note, 2026-08-25 ----
   Mirrors lib/checkin/arrival-access.ts. Where a note is silent (how the
   barrier opens, whether an access card exists) these say nothing. */

export const SEVEN_PALM = `  { id:'seven-palm', parkFirst:false, match:['seven palm'], community:'Seven Palm Hotel & Apartments', area:'Palm Jumeirah, Dubai',
    label:()=> 'Seven Palm Hotel & Apartments', entry:'smartlock', desk:'security', deskAction:'passports',
    arrivalAssist:true, smartlockTurn:'counterclockwise', cardSpot:'none',
    guestParking:true, platePrompt:false, garageEntry:'none',
    communityMap:'https://maps.app.goo.gl/qCwQV8mgJnodMg1W6' },`;

export const DOWNTOWN = `  { id:'downtown-views', parkFirst:false, match:['downtown view'], community:'Downtown Views', area:'Downtown Dubai',
    label:b=> b==='II' ? 'Downtown Views II' : 'Downtown Views',
    towerFrom:n=>/downtown\\s+views\\s+ii\\b/i.test(n)?'II':null,
    entry:'smartlock', desk:'security', deskAction:'passports',
    arrivalAssist:true, smartlockTurn:'counterclockwise', cardSpot:'none',
    guestParking:true, platePrompt:false, garageEntry:'none',
    cardSpotByUnit:{'3907':'coffee-table'}, garageEntryByUnit:{'3907':'card'},
    communityMap:'https://maps.app.goo.gl/N3ro2ksNbKdvVF6H9' },`;

export const PARK_VIEW = `  { id:'park-view', parkFirst:false, match:['park view'], community:'Park View', area:'Saadiyat Island, Abu Dhabi',
    label:()=> 'Park View', entry:'lockbox', desk:'security', cardSpot:'none',
    guestParking:true, platePrompt:true, garageEntry:'plate',
    communityMap:'https://maps.app.goo.gl/iAZmRmxazc64Y1AZ9' },`;

export const RADIANT = `  { id:'radiant', parkFirst:false, match:['radiant'], community:'Radiant Boulevard', area:'Al Reem Island, Abu Dhabi',
    label:()=> 'Radiant Boulevard', entry:'lockbox', desk:'security', cardSpot:'none',
    guestParking:true, platePrompt:true, garageEntry:'plate',
    parkingMap:'/radiant-parking-entrance.jpg',
    communityMap:'https://maps.app.goo.gl/iAZmRmxazc64Y1AZ9' },`;

export const ACT = `  { id:'act-towers', match:['act'], community:'ACT 1 / ACT 2', area:'Downtown Dubai',
    label:()=> 'ACT 1 / ACT 2 \u2014 Tower 2', entry:'smartlock', desk:'security', deskAction:'passports',
    arrivalAssist:true, smartlockTurn:'counterclockwise', cardSpot:'none', parkFirst:false,
    guestParking:true, platePrompt:false, garageEntry:'none',
    communityMap:'https://maps.app.goo.gl/qvhLwvs1PedVoyUP6' },`;

export const TURQUOISE = `  { id:'turquoise', match:['turquoise'], community:'Turquoise 8', area:'Mamsha, Saadiyat Island, Abu Dhabi',
    label:()=> 'Turquoise 8', entry:'unlocked', desk:'security', cardSpot:'coffee-table',
    guestParking:true, platePrompt:false, garageEntry:'card',
    communityMap:'https://maps.app.goo.gl/7Quso2FWEwtus3G76' },`;

export const AJWAN = `  { id:'ajwan', match:['ajwan'], community:'Ajwan Tower C', area:'Mamsha, Saadiyat Island, Abu Dhabi',
    label:()=> 'Ajwan Tower C', entry:'lockbox', desk:'security', cardSpot:'coffee-table',
    guestParking:true, platePrompt:false, garageEntry:'card',
    communityMap:'https://maps.app.goo.gl/PjVppCoxc88CxgXo8' },`;
