/* Galatone 3D: lettura dati OpenStreetMap e paese di esempio. Usato dalla pagina e dallo script che prepara le mappe. */
"use strict";
/* ---------- stili ---------- */
// tipo: [larghezza m, colore, priorità, guidabile]
const RS={motorway:[12,"#3a3c40",7],trunk:[11,"#3d3f43",7],primary:[9,"#44464a",6],secondary:[8,"#46484c",5],
  tertiary:[7,"#4a4c50",4],unclassified:[6,"#505256",3],residential:[6,"#4f5155",3],living_street:[5,"#7d776d",3],
  service:[4,"#5a5b5e",2],pedestrian:[6,"#cdbd9b",2],track:[3.5,"#9a7650",1],footway:[2,"#c4b598",1],path:[1.6,"#a58f6b",1],
  cycleway:[2,"#7d5f4f",1],steps:[2,"#c4b598",1],road:[6,"#505256",3]};
const AREA={residential:["#d4c8b4",1],farmland:["#b07a52",0],orchard:["#9d8a5a",0],olive:["#93875a",0],vineyard:["#8e7a4c",0],
  grass:["#86a055",2],park:["#7f9c4c",2],garden:["#7f9c4c",2],pitch:["#6f9a48",3],industrial:["#bdb8b0",1],commercial:["#cbc2b4",1],
  retail:["#cbc2b4",1],cemetery:["#a3a487",2],farmyard:["#b69a74",1],meadow:["#9aa463",0],square:["#d8c9a6",4],playground:["#b9a37c",3]};
const BCOL=["#f3eee4","#ede5d5","#e9ddc5","#f6f2eb","#e4d4b3","#dccaa0","#efe7d9","#e7e2d8"];
const CHURCH="#d6bc86";

/* ---------- utilità ---------- */
const colCache={};
function rgb(h){if(!colCache[h]){const c=new THREE.Color(h);colCache[h]=[c.r,c.g,c.b];}return colCache[h];}
function hash(n){n=(n^61)^(n>>>16);n=n+(n<<3);n=n^(n>>>4);n=Math.imul(n,0x27d4eb2d);n=n^(n>>>15);return (n>>>0)/4294967296;}
function rng(seed){let s=seed>>>0;return()=>{s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
function decode(s){return s.replace(/&apos;/g,"'").replace(/&quot;/g,'"').replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&#39;/g,"'").replace(/&amp;/g,"&");}
function area2(p){let a=0;for(let i=0,n=p.length/2;i<n;i++){const j=(i+1)%n;a+=p[i*2]*p[j*2+1]-p[j*2]*p[i*2+1];}return a/2;}
function pip(x,z,p){let ins=false;for(let i=0,n=p.length/2,j=n-1;i<n;j=i++){const xi=p[i*2],zi=p[i*2+1],xj=p[j*2],zj=p[j*2+1];
  if(((zi>z)!==(zj>z))&&(x<(xj-xi)*(z-zi)/(zj-zi)+xi))ins=!ins;}return ins;}

class GB{
  constructor(){this.p=[];this.c=[];}
  tri(a,b,c,col,nx,ny,nz){
    const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];
    const n0=uy*vz-uz*vy,n1=uz*vx-ux*vz,n2=ux*vy-uy*vx;
    if(n0*nx+n1*ny+n2*nz<0){const t=b;b=c;c=t;}
    this.p.push(a[0],a[1],a[2],b[0],b[1],b[2],c[0],c[1],c[2]);
    for(let i=0;i<3;i++)this.c.push(col[0],col[1],col[2]);
  }
  mesh(mat){
    const g=new THREE.BufferGeometry();
    g.setAttribute("position",new THREE.Float32BufferAttribute(this.p,3));
    g.setAttribute("color",new THREE.Float32BufferAttribute(this.c,3));
    g.computeVertexNormals();
    return new THREE.Mesh(g,mat);
  }
}
function polyFlat(gb,p,y,col){
  const v=[];for(let i=0;i<p.length;i+=2)v.push(new THREE.Vector2(p[i],p[i+1]));
  if(v.length<3)return;
  let f;try{f=THREE.ShapeUtils.triangulateShape(v,[]);}catch(e){return;}
  for(const t of f){const a=v[t[0]],b=v[t[1]],c=v[t[2]];gb.tri([a.x,y,a.y],[b.x,y,b.y],[c.x,y,c.y],col,0,1,0);}
}

/* ---------- griglie spaziali ---------- */
class Grid{
  constructor(cell){this.cell=cell;this.m=new Map();}
  key(i,j){return i*73856093^j*19349663;}
  add(x1,z1,x2,z2,data){
    const c=this.cell,i0=Math.floor(Math.min(x1,x2)/c),i1=Math.floor(Math.max(x1,x2)/c),j0=Math.floor(Math.min(z1,z2)/c),j1=Math.floor(Math.max(z1,z2)/c);
    const s=[x1,z1,x2,z2,data];
    for(let i=i0;i<=i1;i++)for(let j=j0;j<=j1;j++){const k=this.key(i,j);let a=this.m.get(k);if(!a){a=[];this.m.set(k,a);}a.push(s);}
  }
  near(x,z,ring,out){
    const c=this.cell,ci=Math.floor(x/c),cj=Math.floor(z/c);out.length=0;
    for(let i=ci-ring;i<=ci+ring;i++)for(let j=cj-ring;j<=cj+ring;j++){const a=this.m.get(this.key(i,j));if(a)for(const s of a)out.push(s);}
    return out;
  }
}
function closest(px,pz,s){const dx=s[2]-s[0],dz=s[3]-s[1],l=dx*dx+dz*dz;let t=l>0?((px-s[0])*dx+(pz-s[1])*dz)/l:0;t=Math.max(0,Math.min(1,t));
  return [s[0]+dx*t,s[1]+dz*t,t];}

/* ---------- parser OpenStreetMap ---------- */
function parseOSM(text,name,center,partial){
  const nodes=new Map();
  const reN=/<node\b([^>]*)>/g;let m;
  while((m=reN.exec(text))){const a=m[1];const id=/\bid="(-?\d+)"/.exec(a),la=/\blat="([-\d.]+)"/.exec(a),lo=/\blon="([-\d.]+)"/.exec(a);
    if(id&&la&&lo)nodes.set(id[1],[+la[1],+lo[1]]);}
  if(!nodes.size){if(partial)return {name,real:true,roads:[],bld:[],areas:[]};throw new Error("Nel file non ci sono dati di mappa.");}
  const ways=[];const reW=/<way\b([^>]*)>([\s\S]*?)<\/way>/g;
  while((m=reW.exec(text))){const idm=/\bid="(\d+)"/.exec(m[1]);const body=m[2];const refs=[];const tags={};let r;
    const reNd=/<nd ref="(-?\d+)"/g;while((r=reNd.exec(body)))refs.push(r[1]);
    const reT=/<tag k="([^"]*)" v="([^"]*)"/g;while((r=reT.exec(body)))tags[decode(r[1])]=decode(r[2]);
    ways.push({id:idm?+idm[1]:ways.length,refs,tags});}
  // centro = media dei nodi delle strade
  let sl=0,so=0,cn=0;
  for(const w of ways)if(w.tags.highway)for(const r of w.refs){const n=nodes.get(r);if(n){sl+=n[0];so+=n[1];cn++;}}
  if(!cn)for(const n of nodes.values()){sl+=n[0];so+=n[1];cn++;}
  const lat0=center?center[0]:sl/cn,lon0=center?center[1]:so/cn,kx=111320*Math.cos(lat0*Math.PI/180),kz=110574;
  const proj=r=>{const n=nodes.get(r);return n?[(n[1]-lon0)*kx,-(n[0]-lat0)*kz]:null;};
  const flat=refs=>{const p=[];for(const r of refs){const q=proj(r);if(q)p.push(Math.round(q[0]*10)/10,Math.round(q[1]*10)/10);}return p;};
  const town={name:name||"Il mio paese",real:true,roads:[],bld:[],areas:[]};
  for(const w of ways){
    const t=w.tags,closed=w.refs.length>3&&w.refs[0]===w.refs[w.refs.length-1];
    if(t.highway){
      let ty=t.highway.replace(/_link$/,"");
      if(t.area==="yes"&&closed){town.areas.push({k:"square",p:flat(w.refs.slice(0,-1))});continue;}
      if(!RS[ty])continue;
      const p=flat(w.refs);if(p.length>=4)town.roads.push({t:ty,n:t.name||t.ref||"",p});
    }else if(t.building&&closed&&!t["building:part"]){
      const p=flat(w.refs.slice(0,-1));if(p.length<6)continue;
      let h=parseFloat(t.height);const lv=parseFloat(t["building:levels"]);
      const church=t.building==="church"||t.building==="cathedral"||t.building==="chapel"||t.amenity==="place_of_worship";
      if(!(h>0))h=lv>0?lv*3.3+0.8:church?15+hash(w.id)*6:t.building==="apartments"?10+hash(w.id)*4:
        (t.building==="garage"||t.building==="shed"||t.building==="roof")?3:4.2+hash(w.id)*4.5;
      town.bld.push({p,h:Math.round(h*10)/10,k:church?"church":"",id:w.id});
    }else if(closed&&(t.landuse||t.leisure)){
      let k=t.leisure&&AREA[t.leisure]?t.leisure:t.landuse;
      if(k==="orchard"&&/olive/.test(t.trees||""))k="olive";
      if(k==="village_green")k="grass";
      if(!AREA[k])continue;
      const p=flat(w.refs.slice(0,-1));if(p.length>=6)town.areas.push({k,p});
    }
  }
  if(!partial&&!town.roads.length)throw new Error("Nel file non ho trovato strade.");
  return town;
}

/* ---------- paese di esempio (inventato) ---------- */
function demoTown(){
  const R=rng(7),town={name:"Borgo Esempio",real:false,roads:[],bld:[],areas:[]};
  const S=70,RAD=430;
  const nH=["Via Roma","Via Garibaldi","Via Mazzini","Via Cavour","Via Dante","Via Verdi","Via Manzoni","Via Leopardi","Via Pascoli","Via Carducci","Via Marconi","Via Puccini","Via Volta"];
  const nV=["Via Trento","Via Trieste","Via Milano","Via Napoli","Via Lecce","Via Bari","Via Taranto","Via Brindisi","Via Gallipoli","Via Otranto","Via Nardò","Via Galatina","Via Maglie"];
  let hi=0,vi=0;
  for(let c=-6;c<=6;c++){
    const o=c*S,L=Math.sqrt(Math.max(0,RAD*RAD-o*o));if(L<40)continue;
    const main=c===0,ext=main?1600:L;
    const mk=(horiz)=>{const p=[];for(let s=-ext;s<=ext+1;s+=35){const w=main?0:(R()-.5)*2.4;p.push(horiz?s:o+w,horiz?o+w:s);}return p;};
    town.roads.push({t:main?"primary":"residential",n:main?"Corso Umberto I":nH[hi++%nH.length],p:mk(true)});
    town.roads.push({t:main?"secondary":"residential",n:main?"Via Vittorio Emanuele":nV[vi++%nV.length],p:mk(false)});
  }
  // tangenziale
  const ring=[];for(let a=0;a<=Math.PI*2+0.01;a+=Math.PI/24)ring.push(Math.cos(a)*(RAD+60),Math.sin(a)*(RAD+60));
  town.roads.push({t:"tertiary",n:"Circonvallazione",p:ring});
  // isolati
  for(let i=-7;i<7;i++)for(let j=-7;j<7;j++){
    const x0=i*S,z0=j*S,cx=x0+S/2,cz=z0+S/2;if(Math.hypot(cx,cz)>RAD-45)continue;
    if(i===0&&j===-1){ // piazza con chiesa
      town.areas.push({k:"square",p:[x0+4,z0+4,x0+S-4,z0+4,x0+S-4,z0+S-4,x0+4,z0+S-4]});
      town.bld.push({p:[cx-10,cz-6,cx+10,cz-6,cx+10,cz+22,cx-10,cz+22],h:17,k:"church",id:1});continue;}
    const a=x0+5.5,b=x0+S-5.5,c=z0+5.5,d=z0+S-5.5,D=10+R()*3;
    town.areas.push({k:"residential",p:[a,c,b,c,b,d,a,d]});
    const row=(u0,u1,fixed,horiz,inward)=>{let u=u0;while(u<u1-4){const w=Math.min(6+R()*5,u1-u);
      const h=R()<.2?3.6:5.5+R()*3.5,f2=fixed+inward*D;
      const p=horiz?[u,fixed,u+w,fixed,u+w,f2,u,f2]:[fixed,u,f2,u,f2,u+w,fixed,u+w];
      town.bld.push({p,h,k:"",id:(R()*1e9)|0});u+=w;}};
    row(a,b,c,true,1);row(a,b,d,true,-1);row(c+D,d-D,a,false,1);row(c+D,d-D,b,false,-1);
  }
  // campagna: uliveti e campi
  for(let k=0;k<26;k++){
    const ang=R()*Math.PI*2,r=620+R()*800,cx=Math.cos(ang)*r,cz=Math.sin(ang)*r,w=120+R()*160,h=100+R()*140;
    if(Math.abs(cx)<w/2+16||Math.abs(cz)<h/2+16)continue;
    town.areas.push({k:R()<.6?"olive":"farmland",p:[cx-w/2,cz-h/2,cx+w/2,cz-h/2,cx+w/2,cz+h/2,cx-w/2,cz+h/2]});
  }
  return town;
}


if(typeof module!=="undefined")module.exports={parseOSM,demoTown,RS,AREA};
