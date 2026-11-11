// Ritaglia i paesi di towns.json dal file OpenStreetMap del Sud Italia (Geofabrik)
// e li salva pronti in data/. Lo esegue GitHub Actions (.github/workflows/mappe-3d.yml).
// Uso: node build-maps.js <file.osm.pbf>
const fs=require("fs"),path=require("path"),os=require("os"),{execFileSync}=require("child_process");
const {parseOSM}=require("../osm.js");
const ROOT=path.join(__dirname,"..");
const PBF=process.argv[2];
if(!PBF||!fs.existsSync(PBF)){console.error("Manca il file .osm.pbf");process.exit(1);}
function bbox(t){if(t.bb)return t.bb;const [lat,lon]=t.c,km=t.km||2;const dl=km/110.574,dn=km/(111.32*Math.cos(lat*Math.PI/180));
  return [lat-dl,lon-dn,lat+dl,lon+dn].map(v=>Math.round(v*10000)/10000);}
const towns=JSON.parse(fs.readFileSync(path.join(ROOT,"towns.json"),"utf8"));
const only=(process.env.TOWNS||"").split(",").map(s=>s.trim()).filter(Boolean);
fs.mkdirSync(path.join(ROOT,"data"),{recursive:true});
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),"g3d-"));
for(const t of towns){
  if(only.length&&!only.includes(t.slug))continue;
  const bb=bbox(t),center=[(bb[0]+bb[2])/2,(bb[1]+bb[3])/2],out=path.join(tmp,t.slug+".osm");
  console.log("==",t.name,bb.join(","));
  try{
    execFileSync("osmium",["extract","-b",`${bb[1]},${bb[0]},${bb[3]},${bb[2]}`,"-s","complete_ways",PBF,
      "-o",out,"-f","osm,add_metadata=false","--overwrite"],{stdio:"inherit"});
    const town=parseOSM(fs.readFileSync(out,"utf8"),t.name,center,false);
    town.bb=bb;
    fs.writeFileSync(path.join(ROOT,"data",t.slug+".json"),JSON.stringify(town));
    console.log(`   ok: ${town.roads.length} strade, ${town.bld.length} edifici, ${town.areas.length} aree`);
  }catch(e){console.log("   NON riuscito:",e.message);}
}
const list=towns.filter(t=>fs.existsSync(path.join(ROOT,"data",t.slug+".json"))).map(t=>({slug:t.slug,name:t.name}));
fs.writeFileSync(path.join(ROOT,"data","index.json"),JSON.stringify(list));
console.log("Paesi pronti:",list.map(t=>t.name).join(", "));
if(!list.length)process.exit(1);
