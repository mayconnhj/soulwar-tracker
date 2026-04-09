import { useState, useEffect, useCallback, useMemo } from "react";

// ── API helpers ─────────────────────────────────────────────────────
const API_BASE = import.meta.env.VITE_API_URL || '';
const API = `${API_BASE}/api`;
const api = {
  async getDrops() { const r = await fetch(`${API}/drops`); return r.json(); },
  async addDrop(data) { const r = await fetch(`${API}/drops`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); return r.json(); },
  async updateDrop(id, data) { const r = await fetch(`${API}/drops/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); return r.json(); },
  async deleteDrop(id) { const r = await fetch(`${API}/drops/${id}`, { method: 'DELETE' }); return r.json(); },
  async getConfig() { const r = await fetch(`${API}/config`); return r.json(); },
  async saveConfig(data) { const r = await fetch(`${API}/config`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); return r.json(); },
  async login(password) { const r = await fetch(`${API}/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) }); return r; },
};

// All items that can come from Bag You Desire + Sanguine Set + Promotion Scroll
const DEFAULT_ITEMS = {
  "Soulcutter":"https://www.tibiawiki.com.br/images/8/80/Soulcutter.gif",
  "Soulshredder":"https://www.tibiawiki.com.br/images/2/23/Soulshredder.gif",
  "Soulbiter":"https://www.tibiawiki.com.br/images/4/42/Soulbiter.gif",
  "Souleater (Axe)":"https://www.tibiawiki.com.br/images/4/4a/Souleater_%28Axe%29.gif",
  "Soulcrusher":"https://www.tibiawiki.com.br/images/9/93/Soulcrusher.gif",
  "Soulmaimer":"https://www.tibiawiki.com.br/images/9/9f/Soulmaimer.gif",
  "Soulbleeder":"https://www.tibiawiki.com.br/images/d/d3/Soulbleeder.gif",
  "Soulpiercer":"https://www.tibiawiki.com.br/images/8/88/Soulpiercer.gif",
  "Soultainter":"https://www.tibiawiki.com.br/images/6/6d/Soultainter.gif",
  "Soulhexer":"https://www.tibiawiki.com.br/images/4/45/Soulhexer.gif",
  "Soulkamas":"https://www.tibiawiki.com.br/images/9/9a/Soulkamas.gif",
  "Soulshanks":"https://www.tibiawiki.com.br/images/d/d2/Soulshanks.gif",
  "Soulstrider":"https://www.tibiawiki.com.br/images/2/27/Soulstrider.gif",
  "Soulshell":"https://www.tibiawiki.com.br/images/f/fd/Soulshell.gif",
  "Soulmantle":"https://www.tibiawiki.com.br/images/c/cb/Soulmantle.gif",
  "Soulshroud":"https://www.tibiawiki.com.br/images/f/f0/Soulshroud.gif",
  "Soulgarb":"https://www.tibiawiki.com.br/images/2/23/Soulgarb.gif",
  "Soulbastion":"https://www.tibiawiki.com.br/images/b/bd/Soulbastion.gif",
  "Pair of Soulwalkers":"https://www.tibiawiki.com.br/images/3/33/Pair_of_Soulwalkers.gif",
  "Pair of Soulstalkers":"https://www.tibiawiki.com.br/images/c/cb/Pair_of_Soulstalkers.gif",
  "Soulsoles":"https://www.tibiawiki.com.br/images/a/ae/Soulsoles.gif",
  "Sanguine Boots":"",
  "Sanguine Trousers":"",
  "Sanguine Legs":"",
  "Sanguine Hatchet":"",
  "Sanguine Bow":"",
  "Sanguine Galoshes":"",
  "Sanguine Battleaxe":"",
  "Sanguine Blade":"",
  "Sanguine Bludgeon":"",
  "Sanguine Coil":"",
  "Sanguine Crossbow":"",
  "Sanguine Cudgel":"",
  "Sanguine Greaves":"",
  "Sanguine Razor":"",
  "Sanguine Club":"",
  "Bag You Desire":"",
  "9 Pts Revised Promotion Scroll":"",
};

const DEFAULT_BOSSES = [
  "Bakragore","Chagorz","Gorzindel","Irgix","Malofur Mangrinder",
  "Maxxenius","Murcion","Neferi","Timira","Urmahlullu","Vemiath",
  "The Brainstealer","The Pale Worm","The Unwelcome",
  "Goshnar's Megalomania","Goshnar's Hatred","Goshnar's Greed",
  "Goshnar's Spite","Goshnar's Malice","Goshnar's Cruelty"
];
const DEFAULT_FIXOS = ["Maycon","Jorge","Du","Jão","Mario"];
const DEFAULT_TEAM_A = ["Conopcas","Verfix","Obonitao Lindão","Mad Tian"];
const DEFAULT_TEAM_B = ["Lark Zepin","Abel Shaene","Brabubagore","Sokon Eltanke"];
const BASE_DIVISOR = 7;

function Img({name,items}){
  const [err,setErr]=useState(false);
  const url=(items||{})[name]||DEFAULT_ITEMS[name];
  if(!url||err) return <span style={{display:"inline-block",width:28,height:28,lineHeight:"28px",textAlign:"center",background:"#21262d",borderRadius:4,fontSize:10,color:"#8b949e",verticalAlign:"middle"}}>🗡️</span>;
  return <img src={url} alt={name} style={{width:32,height:32,imageRendering:"pixelated",verticalAlign:"middle"}} onError={()=>setErr(true)}/>;
}

function parseDate(d){if(!d)return null;const[dd,mm,yy]=d.split("/");return new Date(yy,mm-1,dd);}
function fromIso(iso){if(!iso)return "";const[yy,mm,dd]=iso.split("-");return `${dd}/${mm}/${yy}`;}
function fmtMin(m){if(!m&&m!==0)return "—";const v=parseInt(m);if(isNaN(v))return String(m);const h=Math.floor(v/60),r=v%60;if(h===0)return `${r}m`;if(r===0)return `${h}h`;return `${h}h${r}m`;}
function parseSold(p){if(!p)return{kk:0,tc:0};const s=String(p).toLowerCase().trim();if(s.includes("tc")){const n=parseFloat(s.replace(/[^0-9.,]/g,"").replace(",","."));return{kk:0,tc:isNaN(n)?0:n};}const n=parseFloat(s.replace(/[^0-9.,]/g,"").replace(",","."));return{kk:isNaN(n)?0:n,tc:0};}

function StatCard({label,value,sub,color}){
  return <div style={{background:"#161b22",border:"1px solid #30363d",borderRadius:10,padding:"14px 18px",minWidth:130,flex:"1 1 140px"}}>
    <div style={{fontSize:10,color:"#8b949e",textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>{label}</div>
    <div style={{fontSize:20,fontWeight:700,color:color||"#e6edf3"}}>{value}</div>
    {sub&&<div style={{fontSize:10,color:"#484f58",marginTop:2}}>{sub}</div>}
  </div>;
}
function MiniBar({data,lk,vk,color,mx}){
  const d=mx?data.slice(0,mx):data;const m=Math.max(...d.map(r=>r[vk]),1);
  return <div style={{display:"flex",flexDirection:"column",gap:4}}>{d.map((r,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:8}}>
    <div style={{width:130,fontSize:12,color:"#8b949e",textAlign:"right",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r[lk]}</div>
    <div style={{flex:1,background:"#21262d",borderRadius:4,height:20,position:"relative"}}>
      <div style={{width:`${(r[vk]/m)*100}%`,background:color||"#58a6ff",borderRadius:4,height:20,minWidth:2}}/>
      <span style={{position:"absolute",right:6,top:2,fontSize:11,color:"#e6edf3"}}>{Number.isInteger(r[vk])?r[vk]:r[vk].toFixed(1)}</span>
    </div>
  </div>)}</div>;
}

export default function App(){
  const [drops,setDrops]=useState([]);
  const [cfg,setCfg]=useState({
    password:"soulwar2026",bosses:[...DEFAULT_BOSSES],fixos:[...DEFAULT_FIXOS],bonecos:[],
    items:{},teamA:[...DEFAULT_TEAM_A],teamB:[...DEFAULT_TEAM_B],
    tcPriceReal:"53",tcPriceKK:"39",tcQty:"250",
    removedBosses:[],removedFixos:[],removedItems:[]
  });
  const [loading,setLoading]=useState(true);
  const [tab,setTab]=useState("historico");
  const [isAdmin,setIsAdmin]=useState(false);
  const [passInput,setPassInput]=useState("");
  const [showLogin,setShowLogin]=useState(false);
  const [adminSub,setAdminSub]=useState("registro");
  const [fItem,setFItem]=useState("");
  const [fChar,setFChar]=useState("");
  const [fDate,setFDate]=useState("");
  const [aMonth,setAMonth]=useState("");
  const ef={item:"",boss:"",char:"",pagante:"",dropDate:"",dropador:"",suplentes:[],loot:"",servicePrice:"",tempo:""};
  const [nf,setNf]=useState(ef);
  const [editId,setEditId]=useState(null);
  const [salePrice,setSalePrice]=useState("");
  const [saleDate,setSaleDate]=useState("");
  const [newBoss,setNewBoss]=useState("");
  const [newFixo,setNewFixo]=useState("");
  const [newBoneco,setNewBoneco]=useState("");
  const [newItemName,setNewItemName]=useState("");
  const [newItemUrl,setNewItemUrl]=useState("");
  const [newPass,setNewPass]=useState("");
  const [newPassC,setNewPassC]=useState("");
  const [confirmDel,setConfirmDel]=useState(null);
  const [editDropId,setEditDropId]=useState(null);

  // ── Load data from API ──────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      const [dropsData, cfgData] = await Promise.all([api.getDrops(), api.getConfig()]);
      // Map DB fields to frontend fields
      const mapped = dropsData.map(d => ({
        id: d.id,
        item: d.item,
        boss: d.boss,
        char: d.char,
        pagante: d.pagante,
        dropDate: d.drop_date,
        dropador: d.dropador,
        suplentes: d.suplentes || [],
        loot: d.loot,
        servicePrice: d.service_price,
        tempo: d.tempo,
        soldPrice: d.sold_price,
        soldDate: d.sold_date,
        createdAt: d.created_at
      }));
      setDrops(mapped);
      if (cfgData && Object.keys(cfgData).length > 0) {
        setCfg(prev => ({ ...prev, ...cfgData }));
      }
    } catch (e) {
      console.error('Error loading data:', e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Save helpers (API calls) ────────────────────────────────────
  const saveC = async (c) => {
    setCfg(c);
    try { await api.saveConfig(c); } catch (e) { console.error(e); }
  };

  const allItems=useMemo(()=>{
    const merged={...DEFAULT_ITEMS,...(cfg.items||{})};
    const rm=cfg.removedItems||[];
    const out={};Object.keys(merged).forEach(k=>{if(!rm.includes(k))out[k]=merged[k];});return out;
  },[cfg.items,cfg.removedItems]);
  const itemNames=useMemo(()=>Object.keys(allItems).sort(),[allItems]);
  const allBosses=useMemo(()=>{
    const rm=cfg.removedBosses||[];
    return [...new Set([...DEFAULT_BOSSES,...(cfg.bosses||[])])].filter(b=>!rm.includes(b)).sort();
  },[cfg.bosses,cfg.removedBosses]);
  const allFixos=useMemo(()=>{
    const rm=cfg.removedFixos||[];
    return [...new Set([...DEFAULT_FIXOS,...(cfg.fixos||[])])].filter(f=>!rm.includes(f)).sort();
  },[cfg.fixos,cfg.removedFixos]);
  const allBonecos=useMemo(()=>[...new Set(cfg.bonecos||[])].sort(),[cfg.bonecos]);
  const teamA=useMemo(()=>cfg.teamA||DEFAULT_TEAM_A,[cfg.teamA]);
  const teamB=useMemo(()=>cfg.teamB||DEFAULT_TEAM_B,[cfg.teamB]);

  const tcKK=useMemo(()=>parseFloat(String(cfg.tcPriceKK||"39").replace(",","."))||39,[cfg.tcPriceKK]);
  const tcReal=useMemo(()=>parseFloat(String(cfg.tcPriceReal||"53").replace(",","."))||53,[cfg.tcPriceReal]);
  const tcQty=useMemo(()=>parseFloat(String(cfg.tcQty||"250").replace(",","."))||250,[cfg.tcQty]);

  const addSup=()=>setNf(p=>({...p,suplentes:[...p.suplentes,{nome:"",lugarDe:""}]}));
  const rmSup=i=>setNf(p=>({...p,suplentes:p.suplentes.filter((_,x)=>x!==i)}));
  const upSup=(i,k,v)=>setNf(p=>({...p,suplentes:p.suplentes.map((s,x)=>x===i?{...s,[k]:v}:s)}));

  const addDrop = async () => {
    if(!nf.item||!nf.char||!nf.dropDate) return alert("Preencha item, boneco e data!");
    const dropDateFmt = fromIso(nf.dropDate);
    const suplentes = nf.suplentes.filter(s=>s.nome);

    if(editDropId){
      await api.updateDrop(editDropId, {
        item: nf.item, boss: nf.boss, char: nf.char, pagante: nf.pagante,
        dropDate: dropDateFmt, dropador: nf.dropador, suplentes,
        loot: nf.loot, servicePrice: nf.servicePrice, tempo: nf.tempo
      });
      setEditDropId(null);
    } else {
      await api.addDrop({
        item: nf.item, boss: nf.boss, char: nf.char, pagante: nf.pagante,
        dropDate: dropDateFmt, dropador: nf.dropador, suplentes,
        loot: nf.loot, servicePrice: nf.servicePrice, tempo: nf.tempo
      });
    }
    setNf({...ef});
    await load(); // Refresh from DB
  };

  const startEditDrop=id=>{
    const d=drops.find(x=>x.id===id);if(!d)return;
    const dd=d.dropDate;let isoDate="";
    if(dd){const[day,mon,yr]=dd.split("/");isoDate=`${yr}-${mon}-${day}`;}
    setNf({item:d.item||"",boss:d.boss||"",char:d.char||"",pagante:d.pagante||"",dropDate:isoDate,dropador:d.dropador||"",suplentes:d.suplentes||[],loot:d.loot||"",servicePrice:d.servicePrice||"",tempo:d.tempo||""});
    setEditDropId(id);
    setAdminSub("registro");
    window.scrollTo({top:0,behavior:"smooth"});
  };
  const cancelEdit=()=>{setEditDropId(null);setNf({...ef});};

  const saveSale = async (id) => {
    await api.updateDrop(id, { soldPrice: salePrice, soldDate: fromIso(saleDate) });
    setEditId(null); setSalePrice(""); setSaleDate("");
    await load();
  };

  const startDel=id=>setConfirmDel(id);
  const doDel = async () => {
    if(confirmDel){
      await api.deleteDrop(confirmDel);
      setConfirmDel(null);
      await load();
    }
  };

  const sorted=useMemo(()=>[...drops].sort((a,b)=>{const da=parseDate(a.dropDate),db=parseDate(b.dropDate);if(!da||!db)return 0;return db-da;}),[drops]);
  const filtered=useMemo(()=>sorted.filter(d=>{
    if(fItem&&d.item!==fItem)return false;
    if(fChar){const q=fChar.toLowerCase();if(!d.char.toLowerCase().includes(q)&&!(d.dropador||"").toLowerCase().includes(q))return false;}
    if(fDate){const dt=parseDate(d.dropDate);if(dt){const iso=`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}-${String(dt.getDate()).padStart(2,"0")}`;if(iso!==fDate)return false;}}
    return true;
  }),[sorted,fItem,fChar,fDate]);
  const unsold=useMemo(()=>sorted.filter(d=>!d.soldPrice),[sorted]);
  const sold=useMemo(()=>sorted.filter(d=>!!d.soldPrice),[sorted]);

  const getTeam=useCallback(cn=>{
    const c=(cn||"").toLowerCase();
    if(teamA.some(x=>x.toLowerCase()===c))return "A";
    if(teamB.some(x=>x.toLowerCase()===c))return "B";
    return null;
  },[teamA,teamB]);

  const analytics=useMemo(()=>{
    const _kkToReal=kk=>{const tcFromKK=(kk*1000)/tcKK;return(tcFromKK/tcQty)*tcReal;};
    const _tcToReal=tc=>(tc/tcQty)*tcReal;

    let data=sorted;
    if(aMonth)data=data.filter(d=>{const dt=parseDate(d.dropDate);if(!dt)return false;return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}`===aMonth;});

    let totalLoot=0,totalSvcTC=0,soldKK=0,soldTC=0,totalTempo=0;
    data.forEach(d=>{
      if(d.loot){const v=parseFloat(String(d.loot).replace(",","."));if(!isNaN(v))totalLoot+=v;}
      if(d.servicePrice){const v=parseFloat(String(d.servicePrice).replace(",","."));if(!isNaN(v))totalSvcTC+=v;}
      if(d.tempo){const v=parseInt(d.tempo);if(!isNaN(v))totalTempo+=v;}
    });

    const soldData=data.filter(d=>d.soldPrice);
    soldData.forEach(d=>{const{kk,tc}=parseSold(d.soldPrice);soldKK+=kk;soldTC+=tc;});

    const ic={};data.forEach(d=>{ic[d.item]=(ic[d.item]||0)+1;});
    const itemRank=Object.entries(ic).map(([k,v])=>({name:k,count:v})).sort((a,b)=>b.count-a.count);
    const cc={};data.forEach(d=>{if(d.char)cc[d.char]=(cc[d.char]||0)+1;});
    const charRank=Object.entries(cc).map(([k,v])=>({name:k,count:v})).sort((a,b)=>b.count-a.count);
    const dc={};data.forEach(d=>{if(d.dropador)dc[d.dropador]=(dc[d.dropador]||0)+1;});
    const dropadorRank=Object.entries(dc).map(([k,v])=>({name:k,count:v})).sort((a,b)=>b.count-a.count);

    let tAkk=0,tAtc=0,tAn=0,uAkk=0,uAtc=0;
    let tBkk=0,tBtc=0,tBn=0,uBkk=0,uBtc=0;

    soldData.forEach(d=>{
      const team=getTeam(d.char);
      if(!team)return;
      const{kk,tc}=parseSold(d.soldPrice);
      const supCount=(d.suplentes||[]).filter(s=>s.nome).length;
      const div=BASE_DIVISOR+supCount;

      if(team==="A"){
        tAkk+=kk;tAtc+=tc;tAn++;
        uAkk+=kk/div;uAtc+=tc/div;
      } else {
        tBkk+=kk;tBtc+=tc;tBn++;
        uBkk+=kk/div;uBtc+=tc/div;
      }
    });

    const totalUnitKK=uAkk+uBkk;
    const totalUnitTC=uAtc+uBtc;
    const unitARealVal=_kkToReal(uAkk)+_tcToReal(uAtc);
    const unitBRealVal=_kkToReal(uBkk)+_tcToReal(uBtc);
    const totalUnitReal=unitARealVal+unitBRealVal;

    return {totalLoot,totalSvcTC,soldKK,soldTC,itemRank,charRank,dropadorRank,
      totalDrops:data.length,totalSold:soldData.length,totalTempo,
      tAkk,tAtc,tAn,uAkk,uAtc,tBkk,tBtc,tBn,uBkk,uBtc,
      totalUnitKK,totalUnitTC,totalUnitReal,unitARealVal,unitBRealVal};
  },[sorted,aMonth,getTeam,tcKK,tcReal,tcQty]);

  const doLogin = async () => {
    const r = await api.login(passInput);
    if(r.ok){ setIsAdmin(true); setShowLogin(false); setPassInput(""); }
    else alert("Senha incorreta!");
  };

  const changePw = async () => {
    if(!newPass||newPass.length<4) return alert("Mín 4 caracteres");
    if(newPass!==newPassC) return alert("Senhas não conferem");
    await saveC({...cfg, password: newPass});
    setNewPass(""); setNewPassC("");
    alert("Senha alterada!");
  };

  const addBossF=()=>{if(newBoss.trim()){saveC({...cfg,bosses:[...new Set([...(cfg.bosses||[]),newBoss.trim()])],removedBosses:(cfg.removedBosses||[]).filter(x=>x!==newBoss.trim())});setNewBoss("");}};
  const rmBossF=b=>saveC({...cfg,removedBosses:[...new Set([...(cfg.removedBosses||[]),b])]});
  const addFixoF=()=>{if(newFixo.trim()){saveC({...cfg,fixos:[...new Set([...(cfg.fixos||[]),newFixo.trim()])],removedFixos:(cfg.removedFixos||[]).filter(x=>x!==newFixo.trim())});setNewFixo("");}};
  const rmFixoF=f=>saveC({...cfg,removedFixos:[...new Set([...(cfg.removedFixos||[]),f])]});
  const addBonecoF=()=>{if(newBoneco.trim()){saveC({...cfg,bonecos:[...new Set([...(cfg.bonecos||[]),newBoneco.trim()])]});setNewBoneco("");}};
  const rmBonecoF=b=>saveC({...cfg,bonecos:(cfg.bonecos||[]).filter(x=>x!==b)});
  const addItemF=()=>{if(newItemName.trim()){saveC({...cfg,items:{...(cfg.items||{}),[newItemName.trim()]:newItemUrl.trim()||""},removedItems:(cfg.removedItems||[]).filter(x=>x!==newItemName.trim())});setNewItemName("");setNewItemUrl("");}};
  const rmItemF=name=>saveC({...cfg,removedItems:[...new Set([...(cfg.removedItems||[]),name])]});

  const supDisp=sups=>{if(!sups?.length)return "—";return sups.map(s=>`${s.nome}${s.lugarDe?` (→${s.lugarDe})`:""}`).join(", ");};

  if(loading)return <div style={S.loading}>⏳ Carregando...</div>;

  const TABS=[{id:"historico",label:"📜 Histórico"},{id:"itens",label:"💰 Itens"},...(isAdmin?[{id:"admin",label:"⚙️ Admin"},{id:"analise",label:"📊 Análise"}]:[])];

  return (
    <div style={S.root}>
      <header style={S.header}>
        <div style={S.hi}>
          <h1 style={S.logo}>⚔️ Soulwar Tracker</h1>
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            <div style={S.tcBox}><span style={S.tcLb}>R$</span>
              {isAdmin?<input value={cfg.tcPriceReal||""} onChange={e=>saveC({...cfg,tcPriceReal:e.target.value})} style={S.tcInp}/>:<span style={S.tcV}>{cfg.tcPriceReal||"—"}</span>}
              <span style={S.tcS}>/{cfg.tcQty||250}tc</span>
            </div>
            <div style={S.tcBox}><span style={S.tcLb}>TC</span>
              {isAdmin?<input value={cfg.tcPriceKK||""} onChange={e=>saveC({...cfg,tcPriceKK:e.target.value})} style={S.tcInp}/>:<span style={S.tcV}>{cfg.tcPriceKK||"—"}k</span>}
              <span style={S.tcS}>/1tc</span>
            </div>
            {isAdmin?<button onClick={()=>{setIsAdmin(false);setTab("historico");}} style={S.logoutBtn}>Sair</button>:<button onClick={()=>setShowLogin(!showLogin)} style={S.adminBtn}>🔒 Admin</button>}
          </div>
        </div>
        {showLogin&&!isAdmin&&<div style={S.loginBar}><input type="password" placeholder="Senha..." value={passInput} onChange={e=>setPassInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&doLogin()} style={S.loginInp}/><button onClick={doLogin} style={S.loginGo}>Entrar</button></div>}
        <nav style={S.nav}>{TABS.map(t=><button key={t.id} onClick={()=>setTab(t.id)} style={{...S.navBtn,...(tab===t.id?S.navAct:{})}}>{t.label}</button>)}</nav>
      </header>

      {confirmDel&&<div style={S.overlay}><div style={S.modal}>
        <div style={{fontSize:15,marginBottom:12}}>Remover este registro?</div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <button onClick={()=>setConfirmDel(null)} style={S.cxBtn2}>Cancelar</button>
          <button onClick={doDel} style={S.delConfBtn}>Remover</button>
        </div>
      </div></div>}

      <main style={S.main}>

        {/* HISTÓRICO */}
        {tab==="historico"&&<div>
          <div style={S.filters}>
            <select value={fItem} onChange={e=>setFItem(e.target.value)} style={S.sel}><option value="">Todos itens</option>{itemNames.map(i=><option key={i} value={i}>{i}</option>)}</select>
            <input placeholder="Personagem / dropador..." value={fChar} onChange={e=>setFChar(e.target.value)} style={{...S.inp,flex:1,minWidth:150}}/>
            <input type="date" value={fDate} onChange={e=>setFDate(e.target.value)} style={S.inp}/>
            <button onClick={()=>{setFItem("");setFChar("");setFDate("");}} style={S.clearBtn}>Limpar</button>
          </div>
          <div style={S.cnt}>{filtered.length} registro(s)</div>
          <div style={S.tw}><table style={S.tbl}><thead><tr>
            <th style={S.th}>Item</th><th style={S.th}>Boss</th><th style={S.th}>Boneco</th><th style={S.th}>Dropador</th><th style={S.th}>Pagante</th><th style={S.th}>Suplente(s)</th><th style={S.th}>Data</th>
            {isAdmin&&<><th style={S.th}>Loot</th><th style={S.th}>Service</th><th style={S.th}>Tempo</th></>}
            <th style={S.th}>Venda</th><th style={S.th}>Dt Venda</th>
          </tr></thead><tbody>
            {filtered.map(d=><tr key={d.id} style={d.soldPrice?S.rS:S.rN}>
              <td style={S.td}><Img name={d.item} items={allItems}/> <span style={{marginLeft:6}}>{d.item}</span></td>
              <td style={S.td}>{d.boss||"—"}</td><td style={S.td}>{d.char}</td><td style={S.td}>{d.dropador||"—"}</td><td style={S.td}>{d.pagante||"—"}</td>
              <td style={{...S.td,whiteSpace:"normal",maxWidth:200}}>{supDisp(d.suplentes)}</td>
              <td style={S.td}>{d.dropDate}</td>
              {isAdmin&&<><td style={S.td}>{d.loot?`${d.loot}kk`:"—"}</td><td style={S.td}>{d.servicePrice?`${d.servicePrice}tc`:"—"}</td><td style={S.td}>{fmtMin(d.tempo)}</td></>}
              <td style={S.td}>{d.soldPrice||"—"}</td><td style={S.td}>{d.soldDate||"—"}</td>
            </tr>)}
            {filtered.length===0&&<tr><td colSpan={isAdmin?12:9} style={S.empty}>Nenhum registro</td></tr>}
          </tbody></table></div>
        </div>}

        {/* ITENS */}
        {tab==="itens"&&<div>
          <h2 style={S.h2}>💎 Não Vendidos ({unsold.length})</h2>
          <div style={S.tw}><table style={S.tbl}><thead><tr><th style={S.th}>Item</th><th style={S.th}>Boss</th><th style={S.th}>Boneco</th><th style={S.th}>Dropador</th><th style={S.th}>Data</th>{isAdmin&&<th style={S.th}>Ações</th>}</tr></thead><tbody>
            {unsold.map(d=><tr key={d.id} style={S.rN}>
              <td style={S.td}><Img name={d.item} items={allItems}/> <span style={{marginLeft:6}}>{d.item}</span></td>
              <td style={S.td}>{d.boss||"—"}</td><td style={S.td}>{d.char}</td><td style={S.td}>{d.dropador||"—"}</td><td style={S.td}>{d.dropDate}</td>
              {isAdmin&&<td style={S.td}>{editId===d.id?<div style={{display:"flex",gap:4,alignItems:"center"}}>
                <input placeholder="350kk / 250tc" value={salePrice} onChange={e=>setSalePrice(e.target.value)} style={S.sInp}/>
                <input type="date" value={saleDate} onChange={e=>setSaleDate(e.target.value)} style={S.sInp}/>
                <button onClick={()=>saveSale(d.id)} style={S.svBtn}>✓</button><button onClick={()=>setEditId(null)} style={S.cxBtn}>✕</button>
              </div>:<button onClick={()=>{setEditId(d.id);setSalePrice("");setSaleDate("");}} style={S.sellBtn}>Vender</button>}</td>}
            </tr>)}
            {unsold.length===0&&<tr><td colSpan={isAdmin?6:5} style={S.empty}>Nenhum pendente</td></tr>}
          </tbody></table></div>
          <h2 style={{...S.h2,marginTop:32}}>✅ Vendidos ({sold.length})</h2>
          <div style={S.tw}><table style={S.tbl}><thead><tr><th style={S.th}>Item</th><th style={S.th}>Boneco</th><th style={S.th}>Data Drop</th><th style={S.th}>Preço</th><th style={S.th}>Data Venda</th>{isAdmin&&<th style={S.th}>Ações</th>}</tr></thead><tbody>
            {sold.map(d=><tr key={d.id} style={S.rS}>
              <td style={S.td}><Img name={d.item} items={allItems}/> <span style={{marginLeft:6}}>{d.item}</span></td>
              <td style={S.td}>{d.char}</td><td style={S.td}>{d.dropDate}</td>
              {editId===d.id&&isAdmin?<>
                <td style={S.td}><input value={salePrice} onChange={e=>setSalePrice(e.target.value)} placeholder="Preço" style={S.sInp}/></td>
                <td style={S.td}><input type="date" value={saleDate} onChange={e=>setSaleDate(e.target.value)} style={S.sInp}/></td>
                <td style={S.td}><button onClick={()=>saveSale(d.id)} style={S.svBtn}>✓</button><button onClick={()=>setEditId(null)} style={S.cxBtn}>✕</button></td>
              </>:<>
                <td style={{...S.td,fontWeight:700,color:"#2ecc40"}}>{d.soldPrice}</td><td style={S.td}>{d.soldDate}</td>
                {isAdmin&&<td style={S.td}><button onClick={()=>{setEditId(d.id);setSalePrice(d.soldPrice||"");const dd=d.soldDate;if(dd){const[day,mon,yr]=dd.split("/");setSaleDate(`${yr}-${mon}-${day}`);}else setSaleDate("");}} style={S.editBtn} title="Editar venda">✏️</button></td>}
              </>}
            </tr>)}
            {sold.length===0&&<tr><td colSpan={isAdmin?6:5} style={S.empty}>Nenhuma venda</td></tr>}
          </tbody></table></div>
        </div>}

        {/* ADMIN */}
        {tab==="admin"&&isAdmin&&<div>
          <div style={S.subNav}>
            {[["registro","➕ Registrar"],["banco","🗄️ Banco de Dados"],["senha","🔑 Senha"]].map(([id,lb])=>
              <button key={id} onClick={()=>setAdminSub(id)} style={{...S.subBtn,...(adminSub===id?S.subAct:{})}}>{lb}</button>)}
          </div>

          {adminSub==="registro"&&<div>
            {editDropId&&<div style={{background:"rgba(31,111,235,.15)",border:"1px solid #1f6feb",borderRadius:8,padding:"10px 16px",marginBottom:16,fontSize:13,color:"#58a6ff",display:"flex",justifyContent:"space-between",alignItems:"center"}}><span>✏️ Editando registro — altere os campos e clique em "Salvar Edição"</span><button onClick={cancelEdit} style={{background:"transparent",border:"1px solid #58a6ff",color:"#58a6ff",borderRadius:4,padding:"4px 10px",cursor:"pointer",fontSize:12}}>Cancelar</button></div>}
            <div style={S.form}>
              <label style={S.lbl}>Item *<select value={nf.item} onChange={e=>setNf({...nf,item:e.target.value})} style={S.sel}><option value="">Selecione...</option>{itemNames.map(i=><option key={i} value={i}>{i}</option>)}</select></label>
              {nf.item&&<div style={S.prev}><Img name={nf.item} items={allItems}/> {nf.item}</div>}
              <label style={S.lbl}>Boss<select value={nf.boss} onChange={e=>setNf({...nf,boss:e.target.value})} style={S.sel}><option value="">Selecione...</option>{allBosses.map(b=><option key={b} value={b}>{b}</option>)}</select></label>
              <label style={S.lbl}>Boneco *
                {allBonecos.length>0?<><select value={nf.char} onChange={e=>setNf({...nf,char:e.target.value})} style={S.sel}><option value="">Selecione...</option>{allBonecos.map(b=><option key={b} value={b}>{b}</option>)}</select><input value={nf.char} onChange={e=>setNf({...nf,char:e.target.value})} style={{...S.inp,marginTop:4}} placeholder="Ou digite..."/></>:<input value={nf.char} onChange={e=>setNf({...nf,char:e.target.value})} style={S.inp} placeholder="Nome do boneco"/>}
              </label>
              <label style={S.lbl}>Dropador<input value={nf.dropador} onChange={e=>setNf({...nf,dropador:e.target.value})} style={S.inp} placeholder="Quem pilotou"/></label>
              <label style={S.lbl}>Pagante<input value={nf.pagante} onChange={e=>setNf({...nf,pagante:e.target.value})} style={S.inp}/></label>
              <div style={{borderTop:"1px solid #30363d",paddingTop:12}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                  <span style={{fontSize:13,color:"#8b949e",fontWeight:500}}>Suplentes</span>
                  <button onClick={addSup} style={S.plusBtn}>+ Suplente</button>
                </div>
                {nf.suplentes.map((sup,i)=><div key={i} style={{display:"flex",gap:6,alignItems:"center",marginBottom:6}}>
                  <input value={sup.nome} onChange={e=>upSup(i,"nome",e.target.value)} placeholder="Nome" style={{...S.inp,flex:1}}/>
                  <select value={sup.lugarDe} onChange={e=>upSup(i,"lugarDe",e.target.value)} style={{...S.sel,flex:1}}><option value="">Lugar de quem?</option>{allFixos.map(f=><option key={f} value={f}>{f}</option>)}</select>
                  <button onClick={()=>rmSup(i)} style={S.cxBtn}>✕</button>
                </div>)}
              </div>
              <label style={S.lbl}>Data do Drop *<input type="date" value={nf.dropDate} onChange={e=>setNf({...nf,dropDate:e.target.value})} style={S.inp}/></label>
              <label style={S.lbl}>Loot (KK)<input value={nf.loot} onChange={e=>setNf({...nf,loot:e.target.value})} style={S.inp} placeholder="6.1 = 6.1kk"/></label>
              <label style={S.lbl}>Preço Service (TC)<input value={nf.servicePrice} onChange={e=>setNf({...nf,servicePrice:e.target.value})} style={S.inp} placeholder="250, 500..."/></label>
              <label style={S.lbl}>Tempo (min)<input value={nf.tempo} onChange={e=>setNf({...nf,tempo:e.target.value})} style={S.inp} placeholder="60=1h"/>{nf.tempo&&<span style={{fontSize:11,color:"#58a6ff"}}>→ {fmtMin(nf.tempo)}</span>}</label>
              <button onClick={addDrop} style={{...S.addBtn,...(editDropId?{background:"linear-gradient(135deg,#1f6feb,#388bfd)"}:{})}}>{editDropId?"💾 Salvar Edição":"⚔️ Registrar Drop"}</button>
              {editDropId&&<button onClick={cancelEdit} style={{...S.addBtn,background:"#30363d",marginTop:0}}>Cancelar Edição</button>}
            </div>
            <h2 style={{...S.h2,marginTop:40}}>📋 Registros ({drops.length})</h2>
            <div style={S.tw}><table style={S.tbl}><thead><tr>
              <th style={S.th}>Item</th><th style={S.th}>Boss</th><th style={S.th}>Boneco</th><th style={S.th}>Dropador</th><th style={S.th}>Pagante</th><th style={S.th}>Sup</th><th style={S.th}>Data</th><th style={S.th}>Loot</th><th style={S.th}>Svc</th><th style={S.th}>Tempo</th><th style={S.th}>Venda</th><th style={S.th}>Ações</th>
            </tr></thead><tbody>
              {sorted.map(d=><tr key={d.id} style={{...(d.soldPrice?S.rS:S.rN),...(editDropId===d.id?{background:"rgba(31,111,235,.12)",outline:"1px solid #1f6feb"}:{})}}>
                <td style={S.td}><Img name={d.item} items={allItems}/> {d.item}</td><td style={S.td}>{d.boss||"—"}</td><td style={S.td}>{d.char}</td><td style={S.td}>{d.dropador||"—"}</td><td style={S.td}>{d.pagante||"—"}</td>
                <td style={{...S.td,whiteSpace:"normal",maxWidth:150,fontSize:11}}>{supDisp(d.suplentes)}</td>
                <td style={S.td}>{d.dropDate}</td><td style={S.td}>{d.loot?`${d.loot}kk`:"—"}</td><td style={S.td}>{d.servicePrice?`${d.servicePrice}tc`:"—"}</td><td style={S.td}>{fmtMin(d.tempo)}</td><td style={S.td}>{d.soldPrice||"—"}</td>
                <td style={S.td}><button onClick={()=>startEditDrop(d.id)} style={S.editBtn} title="Editar">✏️</button><button onClick={()=>startDel(d.id)} style={S.delBtn} title="Remover">🗑️</button></td>
              </tr>)}
            </tbody></table></div>
          </div>}

          {adminSub==="banco"&&<div style={{display:"flex",flexWrap:"wrap",gap:20}}>
            {[
              {title:"🐉 Bosses",list:allBosses,nv:newBoss,setNv:setNewBoss,add:addBossF,rm:rmBossF},
              {title:"👥 Fixos",list:allFixos,nv:newFixo,setNv:setNewFixo,add:addFixoF,rm:rmFixoF},
              {title:"🎮 Bonecos",list:allBonecos,nv:newBoneco,setNv:setNewBoneco,add:addBonecoF,rm:rmBonecoF},
            ].map(({title,list,nv,setNv,add,rm})=><div key={title} style={S.dbCard}><h3 style={S.dbT}>{title} ({list.length})</h3>
              <div style={S.dbA}><input value={nv} onChange={e=>setNv(e.target.value)} placeholder="Adicionar..." style={{...S.inp,flex:1}} onKeyDown={e=>e.key==="Enter"&&add()}/><button onClick={add} style={S.plusBtn}>+</button></div>
              <div style={S.dbL}>{list.map(b=><div key={b} style={S.dbI}><span>{b}</span><button onClick={()=>rm(b)} style={S.dbD}>✕</button></div>)}{list.length===0&&<div style={{color:"#484f58",fontSize:12,padding:8}}>Vazio</div>}</div>
            </div>)}
            <div style={S.dbCard}><h3 style={S.dbT}>🗡️ Itens ({itemNames.length})</h3>
              <div style={S.dbA}><input value={newItemName} onChange={e=>setNewItemName(e.target.value)} placeholder="Nome" style={{...S.inp,flex:1}}/><input value={newItemUrl} onChange={e=>setNewItemUrl(e.target.value)} placeholder="URL img (opt)" style={{...S.inp,flex:1}}/><button onClick={addItemF} style={S.plusBtn}>+</button></div>
              <div style={S.dbL}>{itemNames.map(i=><div key={i} style={S.dbI}><div style={{display:"flex",alignItems:"center",gap:4}}><Img name={i} items={allItems}/><span style={{marginLeft:4,fontSize:12}}>{i}</span></div><button onClick={()=>rmItemF(i)} style={S.dbD}>✕</button></div>)}</div>
            </div>
            {[{title:"🅰️ Time A",list:teamA,key:"teamA"},{title:"🅱️ Time B",list:teamB,key:"teamB"}].map(({title,list,key})=><div key={key} style={S.dbCard}><h3 style={S.dbT}>{title} ({list.length})</h3>
              <div style={S.dbA}><input placeholder="Add boneco..." id={`_${key}`} style={{...S.inp,flex:1}} onKeyDown={e=>{if(e.key==="Enter"&&e.target.value.trim()){saveC({...cfg,[key]:[...list,e.target.value.trim()]});e.target.value="";}}} /><button onClick={()=>{const el=document.getElementById(`_${key}`);if(el?.value.trim()){saveC({...cfg,[key]:[...list,el.value.trim()]});el.value="";}}} style={S.plusBtn}>+</button></div>
              <div style={S.dbL}>{list.map((c,i)=><div key={i} style={S.dbI}><span>{c}</span><button onClick={()=>saveC({...cfg,[key]:list.filter((_,x)=>x!==i)})} style={S.dbD}>✕</button></div>)}</div>
            </div>)}
          </div>}

          {adminSub==="senha"&&<div style={{...S.form,maxWidth:360}}>
            <h3 style={{margin:"0 0 8px",color:"#e6edf3"}}>🔑 Trocar Senha</h3>
            <label style={S.lbl}>Nova senha<input type="password" value={newPass} onChange={e=>setNewPass(e.target.value)} style={S.inp}/></label>
            <label style={S.lbl}>Confirmar<input type="password" value={newPassC} onChange={e=>setNewPassC(e.target.value)} style={S.inp}/></label>
            <button onClick={changePw} style={S.addBtn}>Alterar Senha</button>
          </div>}
        </div>}

        {/* ANÁLISE */}
        {tab==="analise"&&isAdmin&&<div>
          <div style={{marginBottom:16,display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:13,color:"#8b949e"}}>Mês:</span>
            <input type="month" value={aMonth} onChange={e=>setAMonth(e.target.value)} style={S.inp}/>
            {aMonth&&<button onClick={()=>setAMonth("")} style={S.clearBtn}>Todos</button>}
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:10,marginBottom:24}}>
            <StatCard label="Total Drops" value={analytics.totalDrops} color="#58a6ff"/>
            <StatCard label="Vendidos" value={analytics.totalSold} color="#2ecc40"/>
            <StatCard label="Total Loot" value={`${analytics.totalLoot.toFixed(1)}kk`} color="#feca57"/>
            <StatCard label="Total Service" value={`${analytics.totalSvcTC.toFixed(0)}tc`} color="#48dbfb"/>
            <StatCard label="Vendas KK" value={`${analytics.soldKK.toFixed(1)}kk`} color="#2ecc40"/>
            <StatCard label="Vendas TC" value={`${analytics.soldTC.toFixed(0)}tc`} color="#a29bfe"/>
            <StatCard label="Tempo Total" value={fmtMin(analytics.totalTempo)} sub={`${analytics.totalTempo}min`} color="#fd79a8"/>
          </div>

          <h2 style={{...S.h2,marginTop:8}}>💰 Valor Unitário por Fixo</h2>
          <div style={{fontSize:11,color:"#484f58",marginBottom:12}}>Base ÷{BASE_DIVISOR} + suplentes. Cotação: 1tc = {cfg.tcPriceKK}k | R${cfg.tcPriceReal}/{cfg.tcQty}tc</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:12,marginBottom:24}}>
            <div style={{background:"#161b22",border:"1px solid #1f6feb",borderRadius:10,padding:16,flex:"1 1 300px"}}>
              <div style={{fontSize:13,fontWeight:600,color:"#58a6ff",marginBottom:10}}>🅰️ Time A — {analytics.tAn} venda(s)</div>
              <div style={{display:"flex",gap:14,flexWrap:"wrap"}}>
                <div><div style={S.miniLbl}>Total KK</div><div style={S.miniVal}>{analytics.tAkk.toFixed(1)}kk</div></div>
                <div><div style={S.miniLbl}>Total TC</div><div style={{...S.miniVal,color:"#a29bfe"}}>{analytics.tAtc.toFixed(0)}tc</div></div>
                <div style={{borderLeft:"1px solid #30363d",paddingLeft:12}}>
                  <div style={S.miniLbl}>Unit. KK</div><div style={{fontSize:18,fontWeight:700,color:"#2ecc40"}}>{analytics.uAkk.toFixed(1)}kk</div>
                </div>
                <div><div style={S.miniLbl}>Unit. TC</div><div style={{fontSize:18,fontWeight:700,color:"#48dbfb"}}>{analytics.uAtc.toFixed(1)}tc</div></div>
                <div><div style={S.miniLbl}>Unit. R$</div><div style={{fontSize:18,fontWeight:700,color:"#00b894"}}>R${analytics.unitARealVal.toFixed(2)}</div></div>
              </div>
              <div style={{fontSize:11,color:"#484f58",marginTop:6}}>{teamA.join(", ")}</div>
            </div>
            <div style={{background:"#161b22",border:"1px solid #da3633",borderRadius:10,padding:16,flex:"1 1 300px"}}>
              <div style={{fontSize:13,fontWeight:600,color:"#da3633",marginBottom:10}}>🅱️ Time B — {analytics.tBn} venda(s)</div>
              <div style={{display:"flex",gap:14,flexWrap:"wrap"}}>
                <div><div style={S.miniLbl}>Total KK</div><div style={S.miniVal}>{analytics.tBkk.toFixed(1)}kk</div></div>
                <div><div style={S.miniLbl}>Total TC</div><div style={{...S.miniVal,color:"#a29bfe"}}>{analytics.tBtc.toFixed(0)}tc</div></div>
                <div style={{borderLeft:"1px solid #30363d",paddingLeft:12}}>
                  <div style={S.miniLbl}>Unit. KK</div><div style={{fontSize:18,fontWeight:700,color:"#2ecc40"}}>{analytics.uBkk.toFixed(1)}kk</div>
                </div>
                <div><div style={S.miniLbl}>Unit. TC</div><div style={{fontSize:18,fontWeight:700,color:"#48dbfb"}}>{analytics.uBtc.toFixed(1)}tc</div></div>
                <div><div style={S.miniLbl}>Unit. R$</div><div style={{fontSize:18,fontWeight:700,color:"#00b894"}}>R${analytics.unitBRealVal.toFixed(2)}</div></div>
              </div>
              <div style={{fontSize:11,color:"#484f58",marginTop:6}}>{teamB.join(", ")}</div>
            </div>
            <div style={{background:"#161b22",border:"2px solid #2ecc40",borderRadius:10,padding:16,flex:"1 1 220px"}}>
              <div style={{fontSize:13,fontWeight:600,color:"#2ecc40",marginBottom:10}}>🏆 Total por Fixo</div>
              <div style={{display:"flex",gap:20,flexWrap:"wrap"}}>
                <div><div style={S.miniLbl}>KK</div><div style={{fontSize:24,fontWeight:700,color:"#2ecc40"}}>{analytics.totalUnitKK.toFixed(1)}kk</div></div>
                <div><div style={S.miniLbl}>TC</div><div style={{fontSize:24,fontWeight:700,color:"#48dbfb"}}>{analytics.totalUnitTC.toFixed(1)}tc</div></div>
                <div><div style={S.miniLbl}>R$</div><div style={{fontSize:24,fontWeight:700,color:"#00b894"}}>R${analytics.totalUnitReal.toFixed(2)}</div></div>
              </div>
              <div style={{fontSize:11,color:"#484f58",marginTop:6}}>A+B (KK→TC→R$)</div>
            </div>
          </div>

          <div style={{display:"flex",flexWrap:"wrap",gap:20}}>
            <div style={S.chCard}><h3 style={S.chT}>🗡️ Itens Mais Dropados</h3><MiniBar data={analytics.itemRank} lk="name" vk="count" color="#58a6ff" mx={10}/>{analytics.itemRank.length===0&&<div style={S.empty}>Sem dados</div>}</div>
            <div style={S.chCard}><h3 style={S.chT}>🎮 Bonecos</h3><MiniBar data={analytics.charRank} lk="name" vk="count" color="#feca57" mx={10}/>{analytics.charRank.length===0&&<div style={S.empty}>Sem dados</div>}</div>
            <div style={S.chCard}><h3 style={S.chT}>👤 Dropadores</h3><MiniBar data={analytics.dropadorRank} lk="name" vk="count" color="#2ecc40" mx={10}/>{analytics.dropadorRank.length===0&&<div style={S.empty}>Sem dados</div>}</div>
          </div>
        </div>}

      </main>
      <footer style={S.footer}>Soulwar Tracker — Dados salvos em banco de dados SQLite</footer>
    </div>
  );
}

const S={
  root:{fontFamily:"'Segoe UI',Tahoma,sans-serif",background:"#0d1117",color:"#e6edf3",minHeight:"100vh",display:"flex",flexDirection:"column"},
  loading:{padding:60,textAlign:"center",color:"#8b949e",fontSize:18},
  header:{background:"linear-gradient(135deg,#1a0a2e,#16213e,#0a1628)",borderBottom:"2px solid #30363d",position:"sticky",top:0,zIndex:10},
  hi:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 16px",flexWrap:"wrap",gap:8},
  logo:{margin:0,fontSize:20,background:"linear-gradient(90deg,#ff6b6b,#feca57,#48dbfb)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"},
  tcBox:{display:"flex",alignItems:"center",gap:3,background:"#161b22",border:"1px solid #30363d",borderRadius:6,padding:"4px 8px"},
  tcLb:{fontSize:11,fontWeight:700,color:"#8b949e",minWidth:18},
  tcV:{fontSize:14,fontWeight:600,color:"#feca57"},
  tcS:{fontSize:10,color:"#484f58"},
  tcInp:{width:50,padding:"2px 4px",background:"#0d1117",border:"1px solid #484f58",color:"#feca57",borderRadius:3,fontSize:13,textAlign:"center"},
  adminBtn:{background:"#30363d",border:"1px solid #484f58",color:"#e6edf3",padding:"6px 12px",borderRadius:6,cursor:"pointer",fontSize:12},
  logoutBtn:{background:"#da3633",border:"none",color:"#fff",padding:"6px 12px",borderRadius:6,cursor:"pointer",fontSize:12},
  loginBar:{display:"flex",gap:8,padding:"8px 16px",background:"#161b22"},
  loginInp:{flex:1,padding:"6px 10px",background:"#0d1117",border:"1px solid #30363d",color:"#e6edf3",borderRadius:6,fontSize:14},
  loginGo:{background:"#238636",border:"none",color:"#fff",padding:"6px 16px",borderRadius:6,cursor:"pointer",fontWeight:600},
  nav:{display:"flex",gap:0,borderTop:"1px solid #21262d"},
  navBtn:{flex:1,padding:"10px 0",background:"transparent",border:"none",color:"#8b949e",cursor:"pointer",fontSize:13,fontWeight:500,borderBottom:"2px solid transparent",transition:"all .2s"},
  navAct:{color:"#58a6ff",borderBottomColor:"#58a6ff",background:"rgba(88,166,255,.06)"},
  subNav:{display:"flex",gap:6,marginBottom:20,flexWrap:"wrap"},
  subBtn:{padding:"8px 16px",background:"#161b22",border:"1px solid #30363d",color:"#8b949e",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:500},
  subAct:{color:"#58a6ff",borderColor:"#58a6ff",background:"rgba(88,166,255,.1)"},
  main:{flex:1,padding:16,maxWidth:1400,margin:"0 auto",width:"100%",boxSizing:"border-box"},
  filters:{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12},
  sel:{padding:"7px 10px",background:"#161b22",border:"1px solid #30363d",color:"#e6edf3",borderRadius:6,fontSize:13,minWidth:140},
  inp:{padding:"7px 10px",background:"#161b22",border:"1px solid #30363d",color:"#e6edf3",borderRadius:6,fontSize:13,minWidth:120},
  clearBtn:{padding:"7px 14px",background:"#30363d",border:"none",color:"#e6edf3",borderRadius:6,cursor:"pointer",fontSize:13},
  cnt:{color:"#8b949e",fontSize:13,marginBottom:8},
  tw:{overflowX:"auto",borderRadius:8,border:"1px solid #30363d"},
  tbl:{width:"100%",borderCollapse:"collapse",fontSize:13},
  th:{padding:"10px 12px",background:"#161b22",borderBottom:"1px solid #30363d",textAlign:"left",color:"#8b949e",fontWeight:600,fontSize:11,textTransform:"uppercase",letterSpacing:".5px",whiteSpace:"nowrap"},
  td:{padding:"8px 12px",borderBottom:"1px solid #21262d",whiteSpace:"nowrap"},
  rN:{background:"#0d1117"},rS:{background:"rgba(35,134,54,.08)"},
  empty:{padding:30,textAlign:"center",color:"#484f58"},
  h2:{fontSize:18,margin:"0 0 16px",color:"#e6edf3"},
  form:{display:"flex",flexDirection:"column",gap:12,maxWidth:500,background:"#161b22",padding:20,borderRadius:10,border:"1px solid #30363d"},
  lbl:{display:"flex",flexDirection:"column",gap:4,fontSize:13,color:"#8b949e",fontWeight:500},
  prev:{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:"#1a1f29",borderRadius:6,fontSize:14,color:"#e6edf3"},
  addBtn:{padding:"10px 20px",background:"linear-gradient(135deg,#238636,#2ea043)",border:"none",color:"#fff",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:15,marginTop:4},
  plusBtn:{background:"#1f6feb",border:"none",color:"#fff",borderRadius:6,padding:"6px 12px",cursor:"pointer",fontSize:12,fontWeight:600,whiteSpace:"nowrap"},
  sInp:{padding:"4px 6px",background:"#0d1117",border:"1px solid #30363d",color:"#e6edf3",borderRadius:4,fontSize:12,width:110},
  svBtn:{background:"#238636",border:"none",color:"#fff",borderRadius:4,padding:"4px 8px",cursor:"pointer"},
  cxBtn:{background:"#484f58",border:"none",color:"#fff",borderRadius:4,padding:"4px 8px",cursor:"pointer"},
  sellBtn:{background:"#1f6feb",border:"none",color:"#fff",borderRadius:4,padding:"4px 10px",cursor:"pointer",fontSize:12},
  delBtn:{background:"transparent",border:"none",color:"#da3633",cursor:"pointer",fontSize:16,padding:"2px 6px"},
  editBtn:{background:"transparent",border:"none",color:"#58a6ff",cursor:"pointer",fontSize:16,padding:"2px 6px"},
  overlay:{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100},
  modal:{background:"#161b22",border:"1px solid #30363d",borderRadius:12,padding:24,maxWidth:360,width:"90%"},
  cxBtn2:{background:"#30363d",border:"none",color:"#e6edf3",borderRadius:6,padding:"8px 16px",cursor:"pointer",fontSize:13},
  delConfBtn:{background:"#da3633",border:"none",color:"#fff",borderRadius:6,padding:"8px 16px",cursor:"pointer",fontSize:13,fontWeight:600},
  dbCard:{flex:"1 1 260px",background:"#161b22",border:"1px solid #30363d",borderRadius:10,padding:16,maxHeight:400,display:"flex",flexDirection:"column"},
  dbT:{margin:"0 0 10px",fontSize:15,color:"#e6edf3"},
  dbA:{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap"},
  dbL:{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:2},
  dbI:{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"5px 8px",background:"#0d1117",borderRadius:4,fontSize:13},
  dbD:{background:"transparent",border:"none",color:"#da3633",cursor:"pointer",fontSize:13,padding:"2px 6px"},
  chCard:{flex:"1 1 340px",background:"#161b22",border:"1px solid #30363d",borderRadius:10,padding:16},
  chT:{margin:"0 0 12px",fontSize:15,color:"#e6edf3"},
  miniLbl:{fontSize:11,color:"#8b949e"},
  miniVal:{fontSize:16,fontWeight:700,color:"#feca57"},
  footer:{padding:16,textAlign:"center",color:"#484f58",fontSize:12,borderTop:"1px solid #21262d"},
};
