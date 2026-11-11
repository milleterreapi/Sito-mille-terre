// Scarica da OpenStreetMap i paesi elencati in towns.json e li salva pronti in data/.
// Lo esegue GitHub Actions (.github/workflows/mappe-3d.yml).
const fs=require("fs"),path=require("path");
const {parseOSM}=require("../osm.js");
const ROOT=path.join(__dirname,"..");
const MIRRORS=["https://overpass-api.de/api/interpreter","https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter","https://overpass.private.coffee/api/interpreter"];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function overpass(q){
  let last="";
  for(let round=0;round<3;round++)for(const m of MIRRORS){
    try{
      const ac=new AbortController(),to=setTimeout(()=>ac.abort(),200000);
      const r=await fetch(m,{method:"POST",body:"data="+encodeURIComponent(q),signal:ac.signal,
        headers:{"Content-Type":"application/x-www-form-urlencoded","User-Agent":"galatone-3d (apicolturamilleterre.com)"}});
      clearTimeout(to);
      const t=await r.text();
      if(r.ok&&/<osm/.test(t)&&!/runtime error/.test(t))return t;
      last=m+" -> "+r.status;
    }catch(e){last=m+" -> "+e.message;}
    console.log("  riprovo:",last);await sleep(8000*(round+1));
  }
  throw new Error(last);
}
function bbox(t){if(t.bb)return t.bb;const [lat,lon]=t.c,km=t.km||2;const dl=km/110.574,dn=km/(111.32*Math.cos(lat*Math.PI/180));
  return [lat-dl,lon-dn,lat+dl,lon+dn].map(v=>Math.round(v*10000)/10000);}
(async()=>{
  const towns=JSON.parse(fs.readFileSync(path.join(ROOT,"towns.json"),"utf8"));
  const only=(process.env.TOWNS||"").split(",").map(s=>s.trim()).filter(Boolean);
  fs.mkdirSync(path.join(ROOT,"data"),{recursive:true});
  let failed=0;
  for(const t of towns){
    if(only.length&&!only.includes(t.slug))continue;
    const bb=bbox(t),b=bb.join(","),center=[(bb[0]+bb[2])/2,(bb[1]+bb[3])/2];
    console.log("==",t.name,b);
    try{
      const roads=parseOSM(await overpass(`[out:xml][timeout:180];way["highway"](${b});out body qt;>;out skel qt;`),t.name,center,false);
      const bl=parseOSM(await overpass(`[out:xml][timeout:180];way["building"](${b});out body qt;>;out skel qt;`),t.name,center,true);
      const ar=parseOSM(await overpass(`[out:xml][timeout:180];(way["landuse"](${b});way["leisure"](${b}););out body qt;>;out skel qt;`),t.name,center,true);
      const town={name:t.name,real:true,bb,roads:roads.roads,bld:bl.bld,areas:roads.areas.concat(ar.areas)};
      fs.writeFileSync(path.join(ROOT,"data",t.slug+".json"),JSON.stringify(town));
      console.log(`   ok: ${town.roads.length} strade, ${town.bld.length} edifici, ${town.areas.length} aree`);
    }catch(e){failed++;console.log("   NON riuscito:",e.message);}
    await sleep(5000);
  }
  const list=towns.filter(t=>fs.existsSync(path.join(ROOT,"data",t.slug+".json"))).map(t=>({slug:t.slug,name:t.name}));
  fs.writeFileSync(path.join(ROOT,"data","index.json"),JSON.stringify(list));
  console.log("Paesi pronti:",list.map(t=>t.name).join(", "));
  if(!list.length)process.exit(1);
})();
