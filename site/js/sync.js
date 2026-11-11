"use strict";
/* ------------------------------------------------------------ sync: the meal plan and your settings on every device */
// The diary, the journal and the food notes already travel to the server one entry at a time. The meal plan and a few
// settings used to stay on the device where you made them. Each of those is one value with the time it was last changed:
// a change goes out through the same encrypted mailbox, comes back inside the published data, and the newest copy wins.
// The plan is too big for one message, so it is compressed and sent in pieces that the server puts back together.
const SYNC_KEYS=["rd_plan","rd_plan_sel","rd_fuel","rd_remind","rd_insight","rd_trim"];
const SYNC_CHUNK=2200;
const syncTs=()=>lsJSON("rd_sync_ts",{});
let syncTimer=null;
function syncSet(k,v){
  LS.set(k,JSON.stringify(v));
  const now=Date.now(),t=syncTs(),d=lsJSON("rd_sync_dirty",{});
  t[k]=now;d[k]=now;LS.set("rd_sync_ts",JSON.stringify(t));LS.set("rd_sync_dirty",JSON.stringify(d));
  clearTimeout(syncTimer);syncTimer=setTimeout(syncPush,2500);        // a few quick taps travel as one change
}
// called with fresh data: take what is newer on the server; what exists only here is queued to go out
function syncPull(){
  const S=DATA.sync||{},t=syncTs(),d=lsJSON("rd_sync_dirty",{});let ch=false;
  for(const k of SYNC_KEYS){
    const s=S[k];
    if(s&&(s.ts||0)>(t[k]||0)){LS.set(k,JSON.stringify(s.v));t[k]=s.ts;delete d[k];ch=true;}        // newer on the server
    else if(s&&s.ts===t[k]){if(d[k]){delete d[k];ch=true;}}                                       // our change has arrived
    else if(!t[k]){if(LS.get(k)!=null){t[k]=d[k]=Date.now();ch=true;}}                            // made before syncing existed
    else if(d[k]<0&&new Date(DATA.generated_at).getTime()+d[k]>45*60000){d[k]=t[k];ch=true;}      // sent long ago, never arrived: again
  }
  if(ch){LS.set("rd_sync_ts",JSON.stringify(t));LS.set("rd_sync_dirty",JSON.stringify(d));}
}
async function gzipB64(str){
  if(!("CompressionStream" in window)) return null;
  const buf=await new Response(new Blob([str]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer();
  return b64.enc(new Uint8Array(buf));
}
let syncBusy=false;
async function syncPush(){
  if(syncBusy||!LS.get("rd_pass")) return; syncBusy=true;
  try{
    const dirty=lsJSON("rd_sync_dirty",{});
    for(const k of SYNC_KEYS){
      const ts=dirty[k]; if(!(ts>0)) continue;
      const raw=LS.get(k)??"null",z=await gzipB64(raw),body=z??raw,n=Math.max(1,Math.ceil(body.length/SYNC_CHUNK));
      for(let i=0;i<n;i++) await sendMail("kv",{key:k,ts,i,n,z:z?1:0,s:body.slice(i*SYNC_CHUNK,(i+1)*SYNC_CHUNK)});
      const d=lsJSON("rd_sync_dirty",{}); if(d[k]===ts) d[k]=-ts;   // sent: kept (negative) until the server shows it
      LS.set("rd_sync_dirty",JSON.stringify(d));
    }
  }catch(e){}                                                        // offline: it stays queued and goes out at the next launch
  syncBusy=false;
}
addEventListener("online",syncPush);
