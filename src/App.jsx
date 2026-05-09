import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  BASE_DIVISOR, parseDate, fromIso, fmtMin, saleHint, isValidSalePrice,
  computeAnalytics,
} from "./lib/analytics.js";

// ── API helpers ─────────────────────────────────────────────────────
const API_BASE = import.meta.env.VITE_API_URL || '';
const API = `${API_BASE}/api`;

function getToken() { return sessionStorage.getItem('admin_token') || ''; }
function authHeaders() {
  const t = getToken();
  const h = { 'Content-Type': 'application/json' };
  if (t) h['Authorization'] = `Bearer ${t}`;
  return h;
}

const api = {
  async getQuests() { const r = await fetch(`${API}/quests`); return r.json(); },
  async addQuest(data) { const r = await fetch(`${API}/quests`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(data) }); if (r.status === 401) throw new Error('Sessao expirada'); return r.json(); },
  async updateQuest(id, data) { const r = await fetch(`${API}/quests/${id}`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(data) }); if (r.status === 401) throw new Error('Sessao expirada'); return r.json(); },
  async deleteQuest(id) { const r = await fetch(`${API}/quests/${id}`, { method: 'DELETE', headers: authHeaders() }); if (r.status === 401) throw new Error('Sessao expirada'); return r.json(); },
  async updateDropSale(dropId, data) { const r = await fetch(`${API}/drops/${dropId}/sale`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(data) }); if (r.status === 401) throw new Error('Sessao expirada'); return r.json(); },
  async getConfig() { const r = await fetch(`${API}/config`); return r.json(); },
  async saveConfig(data) { const r = await fetch(`${API}/config`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(data) }); if (r.status === 401) throw new Error('Sessao expirada'); return r.json(); },
  async login(password) { const r = await fetch(`${API}/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) }); return r; },
  async changePassword(currentPassword, newPassword) { const r = await fetch(`${API}/change-password`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ currentPassword, newPassword }) }); return r; },
  async me() { const r = await fetch(`${API}/me`, { headers: authHeaders() }); return r.ok; },
};

// All items that can come from Bag You Desire + Sanguine Set + Promotion Scroll
const DEFAULT_ITEMS = {
  // Soul Weapons
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
  // Soul Armor/Equipment
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
};

const DEFAULT_BOSSES = [
  "Goshnar's Megalomania","Goshnar's Hatred","Goshnar's Greed",
  "Goshnar's Spite","Goshnar's Malice","Goshnar's Cruelty"
];
const DEFAULT_FIXOS = ["Maycon","Jorge","Du","Jão","Mario"];
const DEFAULT_TEAM_A = ["Conopcas","Verfix","Obonitao Lindão","Mad Tian"];
const DEFAULT_TEAM_B = ["Lark Zepin","Abel Shaene","Brabubagore","Sokon Eltanke"];
const DEFAULT_TEAM_C = [];

// Cor padrao por id de time (legado A/B/C). Times novos vem com a cor
// definida em teams_data[i].color. Se nao tem, cai no DEFAULT_TEAM_COLOR.
const TEAM_COLORS_LEGADO = { A: '#58a6ff', B: '#da3633', C: '#d29922' };
const DEFAULT_TEAM_COLOR = '#8b949e';

// Garante que sempre existe uma lista de times — se cfg.teamsData estiver
// vazio (estado pre-migration ou primeiro load), monta a partir do
// teamA/teamB/teamC + fixos legados.
function deriveTeams(cfg) {
  const td = Array.isArray(cfg.teamsData) ? cfg.teamsData : [];
  if (td.length > 0) return td;
  const fixosLegado = cfg.fixos && cfg.fixos.length > 0 ? cfg.fixos : DEFAULT_FIXOS;
  const mkBonecos = arr => (arr || []).map(c => ({ char: c, dono: '' }));
  return [
    { id: 'A', name: 'Time A', color: '#58a6ff', fixos: [...fixosLegado], bonecos: mkBonecos(cfg.teamA) },
    { id: 'B', name: 'Time B', color: '#da3633', fixos: [...fixosLegado], bonecos: mkBonecos(cfg.teamB) },
    ...(cfg.teamC && cfg.teamC.length > 0
      ? [{ id: 'C', name: 'Time C', color: '#d29922', fixos: [...fixosLegado], bonecos: mkBonecos(cfg.teamC) }]
      : []),
  ];
}

// Lookup de um time pelo id, com fallback de nome/cor.
function findTeam(teams, id) {
  return teams.find(t => t.id === id) || null;
}

function teamColor(teams, id) {
  const t = findTeam(teams, id);
  if (t && t.color) return t.color;
  return TEAM_COLORS_LEGADO[id] || DEFAULT_TEAM_COLOR;
}

function teamLabel(teams, id) {
  const t = findTeam(teams, id);
  if (t && t.name) return t.name;
  return id ? `Time ${id}` : '—';
}

function Img({name,items,removedItems}){
  const [err,setErr]=useState(false);
  // Item removido nunca mostra imagem — nem via items custom nem via DEFAULT_ITEMS.
  const isRemoved=Array.isArray(removedItems)&&removedItems.includes(name);
  const url=isRemoved?null:((items||{})[name]||DEFAULT_ITEMS[name]);
  if(!url||err) return <span style={{display:"inline-block",width:28,height:28,lineHeight:"28px",textAlign:"center",background:"#21262d",borderRadius:4,fontSize:10,color:"#8b949e",verticalAlign:"middle"}}>🗡️</span>;
  return <img src={url} alt={name} style={{width:32,height:32,imageRendering:"pixelated",verticalAlign:"middle"}} onError={()=>setErr(true)}/>;
}

// parseDate, fromIso, fmtMin, parseSold, saleHint, BASE_DIVISOR e
// computeAnalytics estão importados de ./lib/analytics.js

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
  // quests é a fonte de verdade; cada quest tem .drops (array)
  const [quests,setQuests]=useState([]);
  const [cfg,setCfg]=useState({
    bosses:[...DEFAULT_BOSSES],fixos:[...DEFAULT_FIXOS],bonecos:[],
    items:{},teamA:[...DEFAULT_TEAM_A],teamB:[...DEFAULT_TEAM_B],teamC:[...DEFAULT_TEAM_C],
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
  const ef={pagante:"",suplentes:[],loot:"",servicePrice:"",tempo:"",dropDate:"",team:"",drops:[],ausentes:[],bonecosPilotados:[]};
  const emptyDrop={item:"",boss:"",char:"",dropador:""};
  const [nf,setNf]=useState(ef);
  const [dropBuf,setDropBuf]=useState(emptyDrop);
  const [editQuestIdx,setEditDropIdx]=useState(null);
  const [editId,setEditId]=useState(null);
  const [salePrice,setSalePrice]=useState("");
  const [saleDate,setSaleDate]=useState("");
  const [newBoss,setNewBoss]=useState("");
  const [newFixo,setNewFixo]=useState("");
  const [newBoneco,setNewBoneco]=useState("");
  const [newItemName,setNewItemName]=useState("");
  const [newItemUrl,setNewItemUrl]=useState("");
  const [currentPass,setCurrentPass]=useState("");
  const [newPass,setNewPass]=useState("");
  const [newPassC,setNewPassC]=useState("");
  const [confirmDel,setConfirmDel]=useState(null);
  const [editQuestId,setEditQuestId]=useState(null);
  const [showDropModal,setShowDropModal]=useState(false);
  const [toast,setToast]=useState(null);
  const toastTimerRef=useRef(null);
  const debounceRef=useRef(null);

  const showToast=useCallback((msg,type='error')=>{
    if(toastTimerRef.current)clearTimeout(toastTimerRef.current);
    setToast({msg,type});
    toastTimerRef.current=setTimeout(()=>setToast(null),4000);
  },[]);

  // ── Load data from API ──────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      const [questsData, cfgData] = await Promise.all([api.getQuests(), api.getConfig()]);
      setQuests(Array.isArray(questsData) ? questsData : []);
      if (cfgData && Object.keys(cfgData).length > 0) {
        setCfg(prev => ({ ...prev, ...cfgData }));
      }
    } catch (e) {
      console.error('Error loading data:', e);
      showToast('Falha ao carregar dados. Verifique sua conexão.','error');
    }
    // Restaura isAdmin se ja existe um token valido (sobrevive ao reload).
    if (sessionStorage.getItem('admin_token')) {
      try {
        const ok = await api.me();
        if (ok) setIsAdmin(true);
        else sessionStorage.removeItem('admin_token');
      } catch {
        sessionStorage.removeItem('admin_token');
      }
    }
    setLoading(false);
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  // ── Save helpers (API calls) ────────────────────────────────────
  // saveC(next): aplica imediato (UI responsiva), tenta gravar e
  // rollbacka pro estado anterior se falhar.
  const saveC = async (next) => {
    let prev;
    setCfg(curr => { prev = curr; return next; });
    const { password, ...payload } = next;
    try {
      await api.saveConfig(payload);
    } catch (e) {
      console.error('saveConfig falhou:', e);
      if (prev) setCfg(prev); // rollback
      showToast(`Falha ao salvar: ${e.message || 'erro de rede'}`,'error');
    }
  };

  // Auto-save com debounce: dispara SO quando o usuario digita em uma
  // cotacao (chama via onChangeCotacao). Nao dispara no load inicial ou
  // HMR. Lê o cfg via setCfg callback pra pegar valor atualizado.
  const onChangeCotacao = useCallback((key, val) => {
    setCfg(p => ({...p, [key]: val}));
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setCfg(curr => {
        const { password, ...payload } = curr;
        api.saveConfig(payload).catch(e => {
          console.error('debounce saveConfig falhou:', e);
          showToast('Falha ao salvar cotação','error');
        });
        return curr;
      });
    }, 500);
  }, [showToast]);

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
  const teamC=useMemo(()=>cfg.teamC||DEFAULT_TEAM_C,[cfg.teamC]);
  // teams: fonte de verdade nova. Sempre uma lista valida — usa teamsData
  // se existe, senao deriva do teamA/B/C + fixos legados.
  const teams=useMemo(()=>deriveTeams(cfg),[cfg]);

  // Auto-backfill: se cfg.teamsData veio do banco mas tem times sem
  // fixos preenchidos (cenario apos a migration 003 quando cfg.fixos
  // estava vazio), aplica DEFAULT_FIXOS e persiste. Roda 1x quando o
  // admin loga e detecta o estado.
  const backfillRunRef = useRef(false);
  useEffect(()=>{
    if (!isAdmin || backfillRunRef.current) return;
    if (!Array.isArray(cfg.teamsData) || cfg.teamsData.length === 0) return;
    const needs = cfg.teamsData.some(t => !t.fixos || t.fixos.length === 0);
    if (!needs) return;
    backfillRunRef.current = true;
    const fixed = cfg.teamsData.map(t => ({
      ...t,
      fixos: (t.fixos && t.fixos.length > 0) ? t.fixos : [...DEFAULT_FIXOS],
    }));
    saveC({ ...cfg, teamsData: fixed });
    showToast('Fixos padrão aplicados aos times. Edite os fixos do Time C se precisar.', 'info');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[isAdmin, cfg.teamsData]);

  const tcKK=useMemo(()=>parseFloat(String(cfg.tcPriceKK||"39").replace(",","."))||39,[cfg.tcPriceKK]);
  const tcReal=useMemo(()=>parseFloat(String(cfg.tcPriceReal||"53").replace(",","."))||53,[cfg.tcPriceReal]);
  const tcQty=useMemo(()=>parseFloat(String(cfg.tcQty||"250").replace(",","."))||250,[cfg.tcQty]);

  const addSup=()=>setNf(p=>({...p,suplentes:[...p.suplentes,{nome:"",lugarDe:""}]}));
  const rmSup=i=>setNf(p=>({...p,suplentes:p.suplentes.filter((_,x)=>x!==i)}));
  const upSup=(i,k,v)=>setNf(p=>({...p,suplentes:p.suplentes.map((s,x)=>x===i?{...s,[k]:v}:s)}));

  // Funções do modal de drop
  const openDropModal=()=>{
    // Autopreenche o boss com o do drop anterior, se houver
    const lastBoss=nf.drops.length>0?nf.drops[nf.drops.length-1].boss||"":"";
    setDropBuf({...emptyDrop,boss:lastBoss});
    setEditDropIdx(null);setShowDropModal(true);
  };
  const editDropAt=(idx)=>{setDropBuf({...nf.drops[idx]});setEditDropIdx(idx);setShowDropModal(true);};
  const saveDropModal=()=>{
    if(!dropBuf.item) return alert("Selecione um item!");
    if(editQuestIdx!==null){
      setNf(p=>({...p,drops:p.drops.map((d,i)=>i===editQuestIdx?{...dropBuf}:d)}));
    } else {
      setNf(p=>({...p,drops:[...(p.drops||[]),{...dropBuf}]}));
    }
    setShowDropModal(false);setEditDropIdx(null);setDropBuf({...emptyDrop});
  };
  const cancelDropModal=()=>{setShowDropModal(false);setEditDropIdx(null);setDropBuf({...emptyDrop});};
  const removeDropAt=(idx)=>setNf(p=>({...p,drops:p.drops.filter((_,i)=>i!==idx)}));

  // Submit: cria 1 quest com seus drops, ou edita uma quest existente.
  const saveQuest = async () => {
    const dropList = nf.drops || [];
    const suplentes = nf.suplentes.filter(s=>s.nome);
    if(dropList.length>0 && !nf.dropDate) return alert("Preencha a data da quest!");
    const dropDateFmt = nf.dropDate ? fromIso(nf.dropDate) : "";

    const payload = {
      dropDate: dropDateFmt,
      pagante: nf.pagante || "",
      team: nf.team || "",
      suplentes,
      loot: nf.loot || "",
      servicePrice: nf.servicePrice || "",
      tempo: nf.tempo || "",
      ausentes: nf.ausentes || [],
      // bonecosPilotados sao linhas com algum campo preenchido
      bonecosPilotados: (nf.bonecosPilotados || [])
        .filter(b => b.char || b.dono || b.piloto)
        .map(b => ({ char: b.char || "", dono: b.dono || "", piloto: b.piloto || "" })),
      drops: dropList.map(d => ({
        id: d.id, // pode ser undefined (drop novo) ou string (drop existente)
        item: d.item || "",
        boss: d.boss || "",
        char: d.char || "",
        dropador: d.dropador || "",
        soldPrice: d.soldPrice || "",
        soldDate: d.soldDate || ""
      }))
    };

    if(editQuestId){
      await api.updateQuest(editQuestId, payload);
      setEditQuestId(null);
    } else {
      await api.addQuest(payload);
    }
    setNf({...ef});
    await load();
  };

  const startEditQuest = id => {
    const q = quests.find(x => x.id === id); if(!q) return;
    const dd = q.dropDate; let isoDate = "";
    if(dd){const[day,mon,yr]=dd.split("/");isoDate=`${yr}-${mon}-${day}`;}
    setNf({
      pagante: q.pagante || "",
      suplentes: q.suplentes || [],
      loot: q.loot || "",
      servicePrice: q.servicePrice || "",
      tempo: q.tempo || "",
      dropDate: isoDate,
      team: q.team || "",
      ausentes: q.ausentes || [],
      bonecosPilotados: q.bonecosPilotados || [],
      drops: (q.drops || []).map(d => ({
        id: d.id,
        item: d.item || "",
        boss: d.boss || "",
        char: d.char || "",
        dropador: d.dropador || "",
        soldPrice: d.soldPrice || "",
        soldDate: d.soldDate || ""
      }))
    });
    setEditQuestId(id);
    setAdminSub("registro");
    window.scrollTo({top:0,behavior:"smooth"});
  };
  const cancelEdit = () => { setEditQuestId(null); setNf({...ef}); };

  // Marcar venda de UM drop específico
  const saveSale = async (dropId) => {
    // Bloqueia salvar venda sem unidade KK/TC explicita — evita interpretacao errada.
    if (salePrice && !isValidSalePrice(salePrice)) {
      showToast('Preço precisa ter unidade: ex 100kk ou 250tc', 'error');
      return;
    }
    await api.updateDropSale(dropId, { soldPrice: salePrice, soldDate: fromIso(saleDate) });
    setEditId(null); setSalePrice(""); setSaleDate("");
    await load();
  };

  const startDel = id => setConfirmDel(id);
  const doDel = async () => {
    if(confirmDel){
      await api.deleteQuest(confirmDel);
      setConfirmDel(null);
      await load();
    }
  };

  // ── Listas derivadas ─────────────────────────────────────────────
  // sortedQuests: quests ordenadas por data desc (para o Histórico)
  const sortedQuests = useMemo(() =>
    [...quests].sort((a,b) => {
      const da = parseDate(a.dropDate) || new Date(a.createdAt||0);
      const db = parseDate(b.dropDate) || new Date(b.createdAt||0);
      return db - da;
    }), [quests]);

  // flatRows: cada quest expandida em N linhas (1 por drop). Se a quest
  // não tem drops, ainda gera 1 linha "vazia" para mostrar a quest.
  // Cada linha carrega tanto os campos da quest quanto do drop.
  const flatRows = useMemo(() => {
    const rows = [];
    for(const q of sortedQuests){
      const ds = q.drops || [];
      if(ds.length === 0){
        rows.push({
          questId: q.id, dropId: null,
          questDate: q.dropDate, questTeam: q.team, questPagante: q.pagante,
          questSuplentes: q.suplentes, questLoot: q.loot,
          questServicePrice: q.servicePrice, questTempo: q.tempo,
          item: "", boss: "", char: "", dropador: "",
          soldPrice: "", soldDate: "",
          // chaves usadas pelos componentes (compat)
          dropDate: q.dropDate, team: q.team, pagante: q.pagante,
          suplentes: q.suplentes, loot: q.loot, servicePrice: q.servicePrice, tempo: q.tempo
        });
      } else {
        for(let i=0;i<ds.length;i++){
          const d = ds[i];
          const isFirst = i===0;
          rows.push({
            questId: q.id, dropId: d.id,
            questDate: q.dropDate, questTeam: q.team, questPagante: q.pagante,
            questSuplentes: q.suplentes, questLoot: q.loot,
            questServicePrice: q.servicePrice, questTempo: q.tempo,
            item: d.item, boss: d.boss, char: d.char, dropador: d.dropador,
            soldPrice: d.soldPrice, soldDate: d.soldDate,
            // Loot/Service/Tempo aparecem só na PRIMEIRA linha da quest pra
            // manter o histórico legível (são quest-level, não per-drop).
            dropDate: q.dropDate, team: q.team, pagante: q.pagante,
            suplentes: q.suplentes,
            loot: isFirst ? q.loot : "",
            servicePrice: isFirst ? q.servicePrice : "",
            tempo: isFirst ? q.tempo : ""
          });
        }
      }
    }
    return rows;
  }, [sortedQuests]);

  const filtered = useMemo(() => flatRows.filter(d => {
    if(fItem && d.item !== fItem) return false;
    if(fChar){
      const qq = fChar.toLowerCase();
      if(!(d.char||"").toLowerCase().includes(qq) && !(d.dropador||"").toLowerCase().includes(qq)) return false;
    }
    if(fDate){
      const dt = parseDate(d.dropDate);
      if(dt){
        const iso = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}-${String(dt.getDate()).padStart(2,"0")}`;
        if(iso !== fDate) return false;
      }
    }
    return true;
  }), [flatRows, fItem, fChar, fDate]);

  // unsold/sold: per drop (item válido + presença/ausência de soldPrice)
  const unsold = useMemo(() => flatRows.filter(d => d.item && !d.soldPrice), [flatRows]);
  const sold = useMemo(() => flatRows.filter(d => d.item && !!d.soldPrice), [flatRows]);

  const getTeam=useCallback(cn=>{
    const c=(cn||"").toLowerCase();
    if(teamA.some(x=>x.toLowerCase()===c))return "A";
    if(teamB.some(x=>x.toLowerCase()===c))return "B";
    if(teamC.some(x=>x.toLowerCase()===c))return "C";
    return null;
  },[teamA,teamB,teamC]);

  const analytics=useMemo(
    ()=>computeAnalytics({quests:sortedQuests,aMonth,tcKK,tcReal,tcQty,getTeam}),
    [sortedQuests,aMonth,getTeam,tcKK,tcReal,tcQty]
  );

  const doLogin = async () => {
    const r = await api.login(passInput);
    if(r.ok){
      const data = await r.json();
      if(data.token) sessionStorage.setItem('admin_token', data.token);
      setIsAdmin(true); setShowLogin(false); setPassInput("");
    }
    else alert("Senha incorreta!");
  };

  const changePw = async () => {
    if(!currentPass) return alert("Informe a senha atual");
    if(!newPass||newPass.length<4) return alert("Nova senha precisa ter no mínimo 4 caracteres");
    if(newPass!==newPassC) return alert("Senhas não conferem");
    try {
      const r = await api.changePassword(currentPass, newPass);
      if(r.ok){
        setCurrentPass(""); setNewPass(""); setNewPassC("");
        alert("Senha alterada com sucesso!");
      } else {
        const data = await r.json().catch(()=>({}));
        alert(data.error || "Erro ao trocar senha");
      }
    } catch(e) {
      alert("Erro de rede ao trocar senha");
    }
  };

  // Mutators de teams_data — cada um deriva o estado atual e chama saveC.
  const mutateTeams = useCallback(async (updater) => {
    const next = updater(deriveTeams(cfg));
    await saveC({ ...cfg, teamsData: next });
  }, [cfg]);
  const genTeamId = () => 'T' + Date.now().toString(36).slice(-4);
  const addTeam = () => mutateTeams(ts => [...ts, {
    id: genTeamId(), name: `Time ${ts.length + 1}`, color: '#8b949e',
    fixos: [...DEFAULT_FIXOS], bonecos: [],
  }]);
  const removeTeam = (id) => mutateTeams(ts => ts.filter(t => t.id !== id));
  const updateTeamField = (id, key, val) => mutateTeams(ts => ts.map(t => t.id === id ? { ...t, [key]: val } : t));
  const addFixoToTeam = (id, nome) => mutateTeams(ts => ts.map(t => t.id === id
    ? { ...t, fixos: [...new Set([...(t.fixos || []), nome])] } : t));
  const rmFixoFromTeam = (id, nome) => mutateTeams(ts => ts.map(t => t.id === id
    ? { ...t, fixos: (t.fixos || []).filter(f => f !== nome) } : t));
  const addBonecoToTeam = (id) => mutateTeams(ts => ts.map(t => t.id === id
    ? { ...t, bonecos: [...(t.bonecos || []), { char: '', dono: '' }] } : t));
  const rmBonecoFromTeam = (id, idx) => mutateTeams(ts => ts.map(t => t.id === id
    ? { ...t, bonecos: (t.bonecos || []).filter((_, i) => i !== idx) } : t));
  const updateBoneco = (id, idx, patch) => mutateTeams(ts => ts.map(t => t.id === id
    ? { ...t, bonecos: (t.bonecos || []).map((b, i) => i === idx ? { ...b, ...patch } : b) } : t));

  const addBossF=async()=>{const v=newBoss.trim();if(!v)return;setNewBoss("");await saveC({...cfg,bosses:[...new Set([...(cfg.bosses||[]),v])],removedBosses:(cfg.removedBosses||[]).filter(x=>x!==v)});};
  const rmBossF=b=>saveC({...cfg,removedBosses:[...new Set([...(cfg.removedBosses||[]),b])]});
  const addFixoF=async()=>{const v=newFixo.trim();if(!v)return;setNewFixo("");await saveC({...cfg,fixos:[...new Set([...(cfg.fixos||[]),v])],removedFixos:(cfg.removedFixos||[]).filter(x=>x!==v)});};
  const rmFixoF=f=>saveC({...cfg,removedFixos:[...new Set([...(cfg.removedFixos||[]),f])]});
  const addBonecoF=async()=>{const v=newBoneco.trim();if(!v)return;setNewBoneco("");await saveC({...cfg,bonecos:[...new Set([...(cfg.bonecos||[]),v])]});};
  const rmBonecoF=b=>saveC({...cfg,bonecos:(cfg.bonecos||[]).filter(x=>x!==b)});
  const addItemF=async()=>{const v=newItemName.trim();if(!v)return;const url=newItemUrl.trim()||"";setNewItemName("");setNewItemUrl("");await saveC({...cfg,items:{...(cfg.items||{}),[v]:url},removedItems:(cfg.removedItems||[]).filter(x=>x!==v)});};
  const rmItemF=name=>saveC({...cfg,removedItems:[...new Set([...(cfg.removedItems||[]),name])]});

  const supDisp=sups=>{if(!sups?.length)return "—";return sups.map(s=>`${s.nome}${s.lugarDe?` (→${s.lugarDe})`:""}`).join(", ");};

  if(loading)return <div style={S.loading}>⏳ Carregando...</div>;

  const TABS=[{id:"historico",label:"📜 Histórico"},{id:"itens",label:"💰 Itens"},...(isAdmin?[{id:"admin",label:"⚙️ Admin"},{id:"analise",label:"📊 Análise"}]:[])];

  return (
    <div style={S.root}>
      {toast&&<div style={{...S.toastBase,...(toast.type==='error'?S.toastError:S.toastInfo)}}>{toast.msg}</div>}
      <header style={S.header}>
        <div style={S.hi}>
          <h1 style={S.logo}>⚔️ Soulwar Tracker</h1>
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            <div style={S.tcBox}><span style={S.tcLb}>R$</span>
              {isAdmin?<input value={cfg.tcPriceReal||""} onChange={e=>onChangeCotacao('tcPriceReal',e.target.value)} style={S.tcInp}/>:<span style={S.tcV}>{cfg.tcPriceReal||"—"}</span>}
              <span style={S.tcS}>/{cfg.tcQty||250}tc</span>
            </div>
            <div style={S.tcBox}><span style={S.tcLb}>TC</span>
              {isAdmin?<input value={cfg.tcPriceKK||""} onChange={e=>onChangeCotacao('tcPriceKK',e.target.value)} style={S.tcInp}/>:<span style={S.tcV}>{cfg.tcPriceKK||"—"}k</span>}
              <span style={S.tcS}>k/1tc</span>
            </div>
            {isAdmin?<button onClick={()=>{sessionStorage.removeItem('admin_token');setIsAdmin(false);setTab("historico");}} style={S.logoutBtn}>Sair</button>:<button onClick={()=>setShowLogin(!showLogin)} style={S.adminBtn}>🔒 Admin</button>}
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

      {showDropModal&&<div style={S.overlay}><div style={{...S.modal,maxWidth:480,width:"95%"}}>
        <h3 style={{margin:"0 0 16px",color:"#e6edf3",fontSize:16}}>📦 {editQuestIdx!==null?"Editar Drop":"Registrar Drop de Item"}</h3>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <label style={S.lbl}>Item *
            <input list="dl-items-modal" value={dropBuf.item} onChange={e=>setDropBuf({...dropBuf,item:e.target.value})} style={S.inp} placeholder="Digite para buscar..."/>
            <datalist id="dl-items-modal">{itemNames.map(i=><option key={i} value={i}/>)}</datalist>
          </label>
          {dropBuf.item&&allItems[dropBuf.item]&&<div style={S.prev}><Img name={dropBuf.item} items={allItems} removedItems={cfg.removedItems}/> {dropBuf.item}</div>}
          <label style={S.lbl}>Boss
            <input list="dl-boss-modal" value={dropBuf.boss} onChange={e=>setDropBuf({...dropBuf,boss:e.target.value})} style={S.inp} placeholder="Boss que dropou"/>
            <datalist id="dl-boss-modal">{allBosses.map(b=><option key={b} value={b}/>)}</datalist>
          </label>
          <label style={S.lbl}>Dropador<input value={dropBuf.dropador} onChange={e=>setDropBuf({...dropBuf,dropador:e.target.value})} style={S.inp} placeholder="Quem pilotou"/></label>
          <label style={S.lbl}>Boneco que dropou
            {allBonecos.length>0?<><select value={dropBuf.char} onChange={e=>setDropBuf({...dropBuf,char:e.target.value})} style={S.sel}><option value="">Selecione...</option>{allBonecos.map(b=><option key={b} value={b}>{b}</option>)}</select><input value={dropBuf.char} onChange={e=>setDropBuf({...dropBuf,char:e.target.value})} style={{...S.inp,marginTop:4}} placeholder="Ou digite..."/></>:<input value={dropBuf.char} onChange={e=>setDropBuf({...dropBuf,char:e.target.value})} style={S.inp} placeholder="Nome do boneco"/>}
          </label>
          <div style={{display:"flex",gap:8,marginTop:4}}>
            <button onClick={saveDropModal} style={{...S.addBtn,flex:1}}>✅ {editQuestIdx!==null?"Salvar Alteração":"Adicionar Drop"}</button>
            <button onClick={cancelDropModal} style={{...S.addBtn,background:"#30363d",flex:1,marginTop:0}}>Cancelar</button>
          </div>
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
          {(()=>{
            const qids=new Set();filtered.forEach(d=>qids.add(d.questId||d.id));
            const dropsCount=filtered.filter(d=>d.item).length;
            return <div style={S.cnt}>{qids.size} quest(s) · {dropsCount} drop(s)</div>;
          })()}
          <div style={S.tw}><table style={S.tbl}><thead><tr>
            <th style={S.th}>Item</th><th style={S.th}>Boss</th><th style={S.th}>Time</th><th style={S.th}>Boneco</th><th style={S.th}>Dropador</th><th style={S.th}>Pagante</th><th style={S.th}>Suplente(s)</th><th style={S.th}>Data</th>
            {isAdmin&&<><th style={S.th}>Loot</th><th style={S.th}>Service</th><th style={S.th}>Tempo</th></>}
            <th style={S.th}>Venda</th><th style={S.th}>Dt Venda</th>
          </tr></thead><tbody>
            {(()=>{
              // Agrupa registros por quest_id (mantem ordem do filtered)
              const seen={};const groups=[];
              for(const d of filtered){
                const k=d.questId||d.id;
                if(seen[k]===undefined){seen[k]=groups.length;groups.push([]);}
                groups[seen[k]].push(d);
              }
              const rows=[];
              groups.forEach((g,gi)=>{
                const isMulti=g.length>1;
                g.forEach((d,i)=>{
                  const isFirst=i===0;
                  const sep=gi>0&&isFirst?{borderTop:"2px solid #58a6ff"}:{};
                  // Quests com 2+ drops ficam azuis sempre (mesmo vendidos)
                  const base=isMulti?{background:"rgba(31,111,235,.14)"}:(d.soldPrice?S.rS:!d.item?S.rNoDrop:S.rN);
                  const rowKey=`${d.questId}-${d.dropId||'empty'}-${i}`;
                  rows.push(
                    <tr key={rowKey} style={{...base,...sep}}>
                      <td style={S.td}><Img name={d.item} items={allItems} removedItems={cfg.removedItems}/> <span style={{marginLeft:6}}>{d.item}</span></td>
                      <td style={S.td}>{d.boss||"—"}</td><td style={{...S.td,fontWeight:600,color:teamColor(teams,d.team)}}>{d.team?teamLabel(teams,d.team):"—"}</td><td style={S.td}>{d.char}</td><td style={S.td}>{d.dropador||"—"}</td><td style={S.td}>{d.pagante||"—"}</td>
                      <td style={{...S.td,whiteSpace:"normal",maxWidth:200}}>{supDisp(d.suplentes)}</td>
                      <td style={S.td}>{d.dropDate}</td>
                      {isAdmin&&<><td style={S.td}>{d.loot?`${d.loot}kk`:"—"}</td><td style={S.td}>{d.servicePrice?`${d.servicePrice}tc`:"—"}</td><td style={S.td}>{fmtMin(d.tempo)}</td></>}
                      <td style={S.td}>{d.soldPrice||"—"}</td><td style={S.td}>{d.soldDate||"—"}</td>
                    </tr>
                  );
                });
              });
              if(rows.length===0)rows.push(<tr key="empty"><td colSpan={isAdmin?13:10} style={S.empty}>Nenhum registro</td></tr>);
              return rows;
            })()}
          </tbody></table></div>
        </div>}

        {/* ITENS */}
        {tab==="itens"&&<div>
          <h2 style={S.h2}>💎 Não Vendidos ({unsold.length})</h2>
          <div style={S.tw}><table style={S.tbl}><thead><tr><th style={S.th}>Item</th><th style={S.th}>Boss</th><th style={S.th}>Boneco</th><th style={S.th}>Dropador</th><th style={S.th}>Data</th>{isAdmin&&<th style={S.th}>Ações</th>}</tr></thead><tbody>
            {unsold.map(d=><tr key={d.dropId} style={S.rN}>
              <td style={S.td}><Img name={d.item} items={allItems} removedItems={cfg.removedItems}/> <span style={{marginLeft:6}}>{d.item}</span></td>
              <td style={S.td}>{d.boss||"—"}</td><td style={S.td}>{d.char}</td><td style={S.td}>{d.dropador||"—"}</td><td style={S.td}>{d.dropDate}</td>
              {isAdmin&&<td style={S.td}>{editId===d.dropId?<div style={{display:"flex",flexDirection:"column",gap:4}}>
                <div style={{display:"flex",gap:4,alignItems:"center"}}>
                  <input placeholder="350kk / 250tc" value={salePrice} onChange={e=>setSalePrice(e.target.value)} style={S.sInp}/>
                  <input type="date" value={saleDate} onChange={e=>setSaleDate(e.target.value)} style={S.sInp}/>
                  <button onClick={()=>saveSale(d.dropId)} style={S.svBtn}>✓</button><button onClick={()=>setEditId(null)} style={S.cxBtn}>✕</button>
                </div>
                {(()=>{const h=saleHint(salePrice);return h?<div style={{fontSize:10,color:h.error?"#f85149":h.warn?"#feca57":"#58a6ff"}}>{h.text}</div>:null;})()}
              </div>:<button onClick={()=>{setEditId(d.dropId);setSalePrice("");setSaleDate("");}} style={S.sellBtn}>Vender</button>}</td>}
            </tr>)}
            {unsold.length===0&&<tr><td colSpan={isAdmin?6:5} style={S.empty}>Nenhum pendente</td></tr>}
          </tbody></table></div>
          <h2 style={{...S.h2,marginTop:32}}>✅ Vendidos ({sold.length})</h2>
          <div style={S.tw}><table style={S.tbl}><thead><tr><th style={S.th}>Item</th><th style={S.th}>Boneco</th><th style={S.th}>Data Drop</th><th style={S.th}>Preço</th><th style={S.th}>Data Venda</th>{isAdmin&&<th style={S.th}>Ações</th>}</tr></thead><tbody>
            {sold.map(d=><tr key={d.dropId} style={S.rS}>
              <td style={S.td}><Img name={d.item} items={allItems} removedItems={cfg.removedItems}/> <span style={{marginLeft:6}}>{d.item}</span></td>
              <td style={S.td}>{d.char}</td><td style={S.td}>{d.dropDate}</td>
              {editId===d.dropId&&isAdmin?<>
                <td style={S.td}><input value={salePrice} onChange={e=>setSalePrice(e.target.value)} placeholder="Preço" style={S.sInp}/>{(()=>{const h=saleHint(salePrice);return h?<div style={{fontSize:10,color:h.error?"#f85149":h.warn?"#feca57":"#58a6ff",marginTop:2}}>{h.text}</div>:null;})()}</td>
                <td style={S.td}><input type="date" value={saleDate} onChange={e=>setSaleDate(e.target.value)} style={S.sInp}/></td>
                <td style={S.td}><button onClick={()=>saveSale(d.dropId)} style={S.svBtn}>✓</button><button onClick={()=>setEditId(null)} style={S.cxBtn}>✕</button></td>
              </>:<>
                <td style={{...S.td,fontWeight:700,color:"#2ecc40"}}>{d.soldPrice}</td><td style={S.td}>{d.soldDate}</td>
                {isAdmin&&<td style={S.td}><button onClick={()=>{setEditId(d.dropId);setSalePrice(d.soldPrice||"");const dd=d.soldDate;if(dd){const[day,mon,yr]=dd.split("/");setSaleDate(`${yr}-${mon}-${day}`);}else setSaleDate("");}} style={S.editBtn} title="Editar venda">✏️</button></td>}
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
            {editQuestId&&<div style={{background:"rgba(31,111,235,.15)",border:"1px solid #1f6feb",borderRadius:8,padding:"10px 16px",marginBottom:16,fontSize:13,color:"#58a6ff",display:"flex",justifyContent:"space-between",alignItems:"center"}}><span>✏️ Editando registro — altere os campos e clique em "Salvar Edição"</span><button onClick={cancelEdit} style={{background:"transparent",border:"1px solid #58a6ff",color:"#58a6ff",borderRadius:4,padding:"4px 10px",cursor:"pointer",fontSize:12}}>Cancelar</button></div>}
            <div style={S.form}>
              <label style={S.lbl}>Pagante<input value={nf.pagante} onChange={e=>setNf({...nf,pagante:e.target.value})} style={S.inp}/></label>
              <label style={S.lbl}>Time<select value={nf.team} onChange={e=>{
                const newId=e.target.value;
                if(newId===nf.team)return;
                const t=findTeam(teams,newId);
                // Ao trocar de time: reseta presenca (todos presentes) e
                // pre-popula bonecosPilotados com os bonecos do time
                // (piloto inicia igual ao dono — usuario ajusta se for
                // emprestante).
                setNf(p=>({
                  ...p,
                  team:newId,
                  ausentes:[],
                  bonecosPilotados:t?(t.bonecos||[]).map(b=>({char:b.char||'',dono:b.dono||'',piloto:b.dono||''})):[],
                }));
              }} style={S.sel}>
                <option value="">Selecione o Time...</option>
                {teams.map(t=>{
                  const charsLabel=(t.bonecos||[]).map(b=>b.char).filter(Boolean).join(", ")||(t.fixos||[]).join(", ");
                  return <option key={t.id} value={t.id}>{t.name||`Time ${t.id}`}{charsLabel?` — ${charsLabel}`:""}</option>;
                })}
              </select></label>
              <label style={S.lbl}>Loot da Quest (KK)<input value={nf.loot} onChange={e=>setNf({...nf,loot:e.target.value})} style={S.inp} placeholder="6.1 = 6.1kk"/></label>
              <label style={S.lbl}>Preço Service (TC)<input value={nf.servicePrice} onChange={e=>setNf({...nf,servicePrice:e.target.value})} style={S.inp} placeholder="250, 500..."/></label>
              <label style={S.lbl}>Tempo da Quest (min)<input value={nf.tempo} onChange={e=>setNf({...nf,tempo:e.target.value})} style={S.inp} placeholder="60=1h"/>{nf.tempo&&<span style={{fontSize:11,color:"#58a6ff",marginTop:2}}>→ {fmtMin(nf.tempo)}</span>}</label>
              <label style={S.lbl}>Data da Quest<input type="date" value={nf.dropDate} onChange={e=>setNf({...nf,dropDate:e.target.value})} style={S.inp}/></label>
              <div style={{borderTop:"1px solid #30363d",paddingTop:12}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                  <span style={{fontSize:13,color:"#8b949e",fontWeight:500}}>Suplentes</span>
                  <button onClick={addSup} style={S.plusBtn}>+ Suplente</button>
                </div>
                {nf.suplentes.map((sup,i)=>{
                  // Lugar de = fixo do time selecionado quando ha um team escolhido,
                  // senao cai pra pool global (allFixos).
                  const teamSel=findTeam(teams,nf.team);
                  const opcoesLugarDe=teamSel?(teamSel.fixos||[]):allFixos;
                  return <div key={i} style={{display:"flex",gap:6,alignItems:"center",marginBottom:6,flexWrap:"wrap"}}>
                    <input value={sup.nome} onChange={e=>upSup(i,"nome",e.target.value)} placeholder="Nome do suplente" style={{...S.inp,flex:"1 1 120px"}}/>
                    <select value={sup.lugarDe||""} onChange={e=>upSup(i,"lugarDe",e.target.value)} style={{...S.sel,flex:"1 1 120px"}}>
                      <option value="">Lugar de quem?</option>
                      {opcoesLugarDe.map(f=><option key={f} value={f}>{f}</option>)}
                    </select>
                    <input value={sup.boneco||""} onChange={e=>upSup(i,"boneco",e.target.value)} placeholder="Boneco (opt)" style={{...S.inp,flex:"1 1 110px"}} list={`dl-bonecos-team-${nf.team}`}/>
                    <button onClick={()=>rmSup(i)} style={S.cxBtn}>✕</button>
                  </div>;
                })}
                <div style={{fontSize:11,color:"#484f58",marginTop:4}}>Suplentes substituem fixos faltantes ou ocupam vagas extras. Preencha "boneco" se o suplente pilotou um boneco específico.</div>
              </div>

              {/* PRESENCA — checkbox por fixo do time selecionado */}
              {(()=>{
                const team=findTeam(teams,nf.team);
                if(!team)return null;
                const fixosTime=team.fixos||[];
                if(fixosTime.length===0)return null;
                const ausentesSet=new Set(nf.ausentes||[]);
                const presentesCount=fixosTime.filter(f=>!ausentesSet.has(f)).length;
                return <div style={{borderTop:"1px solid #30363d",paddingTop:12}}>
                  <div style={{fontSize:13,color:"#8b949e",fontWeight:500,marginBottom:8}}>
                    👥 Presença na quest <span style={{color:"#2ecc40",fontWeight:600}}>({presentesCount}/{fixosTime.length})</span>
                  </div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                    {fixosTime.map(f=>{
                      const aus=ausentesSet.has(f);
                      return <label key={f} style={{display:"inline-flex",alignItems:"center",gap:6,padding:"5px 10px",background:aus?"rgba(218,54,51,.10)":"rgba(35,134,54,.10)",border:`1px solid ${aus?"#da3633":"#2ea043"}`,borderRadius:6,cursor:"pointer",fontSize:12}}>
                        <input type="checkbox" checked={!aus} onChange={e=>{
                          const wantAus=!e.target.checked;
                          setNf(p=>{
                            const a=new Set(p.ausentes||[]);
                            if(wantAus)a.add(f);else a.delete(f);
                            return {...p,ausentes:[...a]};
                          });
                        }} style={{margin:0}}/>
                        <span style={{textDecoration:aus?"line-through":"none",color:aus?"#8b949e":"#e6edf3"}}>{f}</span>
                      </label>;
                    })}
                  </div>
                  <div style={{fontSize:11,color:"#484f58",marginTop:4}}>Marcado = presente (recebe loot/service). Desmarcar = faltou.</div>
                </div>;
              })()}

              {/* BONECOS PILOTADOS — quem pilotou qual boneco na quest */}
              {nf.team&&<div style={{borderTop:"1px solid #30363d",paddingTop:12}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                  <span style={{fontSize:13,color:"#8b949e",fontWeight:500}}>📦 Bonecos pilotados {(nf.bonecosPilotados||[]).length>0&&<span style={{color:"#58a6ff"}}>({(nf.bonecosPilotados||[]).length})</span>}</span>
                  <button onClick={()=>setNf(p=>({...p,bonecosPilotados:[...(p.bonecosPilotados||[]),{char:'',dono:'',piloto:''}]}))} style={S.plusBtn}>+ Linha</button>
                </div>
                {(nf.bonecosPilotados||[]).map((b,i)=>{
                  const isDonoAusente=b.dono&&(nf.ausentes||[]).includes(b.dono);
                  const pilotoDifere=b.piloto&&b.dono&&b.piloto!==b.dono;
                  const ativaDivisorExtra=isDonoAusente&&pilotoDifere;
                  return <div key={i} style={{display:"flex",gap:6,alignItems:"center",marginBottom:6,flexWrap:"wrap",padding:ativaDivisorExtra?"6px 8px":"0",background:ativaDivisorExtra?"rgba(254,202,87,.08)":"transparent",borderRadius:ativaDivisorExtra?6:0,border:ativaDivisorExtra?"1px solid #feca57":"none"}}>
                    <input value={b.char||""} onChange={e=>setNf(p=>({...p,bonecosPilotados:p.bonecosPilotados.map((x,j)=>j===i?{...x,char:e.target.value}:x)}))} placeholder="Boneco" list={`dl-bonecos-team-${nf.team}`} style={{...S.inp,flex:"1 1 130px",fontSize:12}}/>
                    <input value={b.dono||""} onChange={e=>setNf(p=>({...p,bonecosPilotados:p.bonecosPilotados.map((x,j)=>j===i?{...x,dono:e.target.value}:x)}))} placeholder="Dono" list={`dl-fixos-team-${nf.team}`} style={{...S.inp,flex:"1 1 100px",fontSize:12}}/>
                    <input value={b.piloto||""} onChange={e=>setNf(p=>({...p,bonecosPilotados:p.bonecosPilotados.map((x,j)=>j===i?{...x,piloto:e.target.value}:x)}))} placeholder="Piloto" list={`dl-pilotos-team-${nf.team}`} style={{...S.inp,flex:"1 1 100px",fontSize:12}}/>
                    {ativaDivisorExtra&&<span title="Dono ausente + boneco pilotado por outro = +1 share nos drops" style={{fontSize:10,color:"#feca57",fontWeight:600}}>⚠️ +1 share</span>}
                    <button onClick={()=>setNf(p=>({...p,bonecosPilotados:p.bonecosPilotados.filter((_,j)=>j!==i)}))} style={S.cxBtn}>✕</button>
                  </div>;
                })}
                {/* datalists pra autocomplete dos campos acima */}
                {(()=>{
                  const team=findTeam(teams,nf.team);
                  const bonecosT=(team?.bonecos||[]).map(b=>b.char).filter(Boolean);
                  const fixosT=team?.fixos||[];
                  const pilotosT=[...new Set([...fixosT,...((nf.suplentes||[]).map(s=>s.nome).filter(Boolean))])];
                  return <>
                    <datalist id={`dl-bonecos-team-${nf.team}`}>{bonecosT.map(c=><option key={c} value={c}/>)}</datalist>
                    <datalist id={`dl-fixos-team-${nf.team}`}>{fixosT.map(f=><option key={f} value={f}/>)}</datalist>
                    <datalist id={`dl-pilotos-team-${nf.team}`}>{pilotosT.map(p=><option key={p} value={p}/>)}</datalist>
                  </>;
                })()}
                <div style={{fontSize:11,color:"#484f58",marginTop:4}}>
                  Boneco com dono ausente + piloto diferente = ativa divisor +1 nos drops.
                </div>
              </div>}

              <div style={{borderTop:"1px solid #30363d",paddingTop:12}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                  <span style={{fontSize:13,color:"#8b949e",fontWeight:500}}>Drops de Item {nf.drops.length>0&&<span style={{color:"#2ecc40"}}>({nf.drops.length})</span>}</span>
                  <button onClick={openDropModal} style={{...S.plusBtn,background:"#238636"}}>📦 + Adicionar Drop</button>
                </div>
                {nf.drops.length>0?(
                  <div style={{display:"flex",flexDirection:"column",gap:6}}>
                    {nf.drops.map((d,idx)=>(
                      <div key={idx} style={{background:"rgba(35,134,54,.15)",border:"1px solid #2ea043",borderRadius:8,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
                        <div style={{display:"flex",alignItems:"center",gap:10}}>
                          <Img name={d.item} items={allItems} removedItems={cfg.removedItems}/>
                          <div>
                            <div style={{fontSize:13,fontWeight:600,color:"#2ecc40"}}>{d.item}</div>
                            <div style={{fontSize:11,color:"#8b949e"}}>{[d.boss,d.char,d.dropador&&`👤 ${d.dropador}`].filter(Boolean).join(" · ")||"—"}</div>
                          </div>
                        </div>
                        <div style={{display:"flex",gap:6}}>
                          <button onClick={()=>editDropAt(idx)} style={{...S.plusBtn,background:"#1f6feb",fontSize:11}}>✏️ Editar</button>
                          <button onClick={()=>removeDropAt(idx)} style={{background:"#da3633",border:"none",color:"#fff",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontSize:11}}>✕ Remover</button>
                        </div>
                      </div>
                    ))}
                  </div>
                ):(
                  <div style={{background:"rgba(218,54,51,.08)",border:"1px dashed #484f58",borderRadius:8,padding:"12px 16px",textAlign:"center"}}>
                    <span style={{fontSize:13,color:"#484f58"}}>Nenhum drop nesta quest{!editQuestId&&" — clique em + Adicionar Drop para incluir um item"}</span>
                  </div>
                )}
              </div>
              <button onClick={saveQuest} style={{...S.addBtn,...(editQuestId?{background:"linear-gradient(135deg,#1f6feb,#388bfd)"}:{})}}>{editQuestId?"💾 Salvar Edição":"⚔️ Registrar Quest"}</button>
              {editQuestId&&<button onClick={cancelEdit} style={{...S.addBtn,background:"#30363d",marginTop:0}}>Cancelar Edição</button>}
            </div>
            <h2 style={{...S.h2,marginTop:40}}>📋 Quests ({sortedQuests.length})</h2>
            <div style={S.tw}><table style={S.tbl}><thead><tr>
              <th style={S.th}>Data</th><th style={S.th}>Time</th><th style={S.th}>Pagante</th><th style={S.th}>Sup</th><th style={S.th}>Loot</th><th style={S.th}>Svc</th><th style={S.th}>Tempo</th><th style={S.th}>Drops</th><th style={S.th}>Ações</th>
            </tr></thead><tbody>
              {sortedQuests.map(q=>{
                const ds = q.drops || [];
                const isMulti = ds.length > 1;
                const isEditing = editQuestId===q.id;
                const baseRow = isMulti ? {background:"rgba(31,111,235,.14)"} : S.rN;
                const editStyle = isEditing ? {background:"rgba(31,111,235,.20)",outline:"1px solid #1f6feb"} : {};
                return <tr key={q.id} style={{...baseRow,...editStyle}}>
                  <td style={S.td}>{q.dropDate||"—"}</td>
                  <td style={{...S.td,fontWeight:600,color:teamColor(teams,q.team)}}>{q.team?teamLabel(teams,q.team):"—"}</td>
                  <td style={S.td}>{q.pagante||"—"}</td>
                  <td style={{...S.td,whiteSpace:"normal",maxWidth:150,fontSize:11}}>{supDisp(q.suplentes)}</td>
                  <td style={S.td}>{q.loot?`${q.loot}kk`:"—"}</td>
                  <td style={S.td}>{q.servicePrice?`${q.servicePrice}tc`:"—"}</td>
                  <td style={S.td}>{fmtMin(q.tempo)}</td>
                  <td style={{...S.td,whiteSpace:"normal",maxWidth:280,fontSize:11}}>
                    {ds.length===0?<span style={{color:"#484f58"}}>—</span>:
                      <div style={{display:"flex",flexDirection:"column",gap:2}}>
                        {ds.map(d=><div key={d.id} style={{display:"flex",alignItems:"center",gap:4}}>
                          <Img name={d.item} items={allItems} removedItems={cfg.removedItems}/>
                          <span style={{fontSize:11}}>{d.item}{d.char?` · ${d.char}`:""}{d.soldPrice?` · ✅ ${d.soldPrice}`:""}</span>
                        </div>)}
                      </div>
                    }
                  </td>
                  <td style={S.td}><button onClick={()=>startEditQuest(q.id)} style={S.editBtn} title="Editar">✏️</button><button onClick={()=>startDel(q.id)} style={S.delBtn} title="Remover quest inteira">🗑️</button></td>
                </tr>;
              })}
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
              <div style={S.dbL}>{itemNames.map(i=><div key={i} style={S.dbI}><div style={{display:"flex",alignItems:"center",gap:4}}><Img name={i} items={allItems} removedItems={cfg.removedItems}/><span style={{marginLeft:4,fontSize:12}}>{i}</span></div><button onClick={()=>rmItemF(i)} style={S.dbD}>✕</button></div>)}</div>
            </div>
            {/* Card único de Times — substitui os 3 cards antigos Time A/B/C */}
            <div style={{...S.dbCard,flex:"1 1 100%",maxHeight:"none"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                <h3 style={S.dbT}>🛡️ Times ({teams.length})</h3>
                <button onClick={addTeam} style={{...S.plusBtn,background:"#238636"}}>+ Novo Time</button>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:14}}>
                {teams.map(t=>(
                  <div key={t.id} style={{border:`1px solid ${t.color||DEFAULT_TEAM_COLOR}`,borderRadius:8,padding:12}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10,flexWrap:"wrap"}}>
                      <div style={{width:14,height:14,borderRadius:"50%",background:t.color||DEFAULT_TEAM_COLOR,flexShrink:0}}/>
                      <input type="text" value={t.name||""} onChange={e=>updateTeamField(t.id,"name",e.target.value)}
                             style={{...S.inp,fontWeight:700,color:t.color||"#e6edf3",flex:"1 1 140px",minWidth:120}}/>
                      <input type="color" value={t.color||DEFAULT_TEAM_COLOR} onChange={e=>updateTeamField(t.id,"color",e.target.value)}
                             style={{width:32,height:32,border:"none",cursor:"pointer",background:"transparent",padding:0}} title="Cor do time"/>
                      <span style={{fontSize:10,color:"#484f58",fontFamily:"monospace"}}>id: {t.id}</span>
                      <button onClick={()=>{if(confirm(`Remover ${t.name}? Quests existentes mantém o id "${t.id}".`))removeTeam(t.id);}}
                              style={{...S.dbD,fontSize:14}} title="Remover time">🗑️</button>
                    </div>

                    {/* Fixos */}
                    <div style={{marginBottom:10}}>
                      <div style={{fontSize:11,color:"#8b949e",fontWeight:600,marginBottom:4}}>FIXOS ({(t.fixos||[]).length})</div>
                      <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                        {(t.fixos||[]).map(f=>(
                          <span key={f} style={{background:"#0d1117",border:"1px solid #30363d",borderRadius:4,padding:"3px 8px",fontSize:12,display:"inline-flex",alignItems:"center",gap:4}}>
                            {f}
                            <button onClick={()=>rmFixoFromTeam(t.id,f)} style={{background:"transparent",border:"none",color:"#da3633",cursor:"pointer",fontSize:11,padding:0,marginLeft:2}}>✕</button>
                          </span>
                        ))}
                        <input type="text" placeholder="+ adicionar fixo" list={`pool-fixos-${t.id}`}
                               onKeyDown={e=>{if(e.key==="Enter"&&e.target.value.trim()){addFixoToTeam(t.id,e.target.value.trim());e.target.value="";}}}
                               style={{...S.inp,fontSize:12,padding:"3px 8px",minWidth:140,flex:"0 1 180px"}}/>
                        <datalist id={`pool-fixos-${t.id}`}>{allFixos.map(f=><option key={f} value={f}/>)}</datalist>
                      </div>
                    </div>

                    {/* Bonecos com dono */}
                    <div>
                      <div style={{fontSize:11,color:"#8b949e",fontWeight:600,marginBottom:4}}>BONECOS ({(t.bonecos||[]).length})</div>
                      <div style={{display:"flex",flexDirection:"column",gap:4}}>
                        {(t.bonecos||[]).map((b,idx)=>(
                          <div key={idx} style={{display:"flex",gap:6,alignItems:"center"}}>
                            <input value={b.char||""} onChange={e=>updateBoneco(t.id,idx,{char:e.target.value})}
                                   placeholder="Nome do boneco" style={{...S.inp,fontSize:12,flex:"1 1 160px"}}/>
                            <input value={b.dono||""} onChange={e=>updateBoneco(t.id,idx,{dono:e.target.value})}
                                   placeholder="Dono (fixo, opcional)" list={`pool-fixos-${t.id}`}
                                   style={{...S.inp,fontSize:12,flex:"1 1 140px"}}/>
                            <button onClick={()=>rmBonecoFromTeam(t.id,idx)} style={S.dbD} title="Remover boneco">✕</button>
                          </div>
                        ))}
                        <button onClick={()=>addBonecoToTeam(t.id)} style={{...S.plusBtn,background:"#1f6feb",alignSelf:"flex-start",marginTop:4,fontSize:11}}>+ Adicionar Boneco</button>
                      </div>
                    </div>
                  </div>
                ))}
                {teams.length===0&&<div style={{color:"#484f58",fontSize:12,padding:8,textAlign:"center"}}>Nenhum time cadastrado.</div>}
              </div>
            </div>
          </div>}

          {adminSub==="senha"&&<div style={{...S.form,maxWidth:360}}>
            <h3 style={{margin:"0 0 8px",color:"#e6edf3"}}>🔑 Trocar Senha</h3>
            <label style={S.lbl}>Senha atual<input type="password" value={currentPass} onChange={e=>setCurrentPass(e.target.value)} style={S.inp} autoComplete="current-password"/></label>
            <label style={S.lbl}>Nova senha<input type="password" value={newPass} onChange={e=>setNewPass(e.target.value)} style={S.inp} autoComplete="new-password"/></label>
            <label style={S.lbl}>Confirmar nova senha<input type="password" value={newPassC} onChange={e=>setNewPassC(e.target.value)} style={S.inp} autoComplete="new-password"/></label>
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
          {analytics.unmatchedSales>0&&<div style={{background:"rgba(218,54,51,.12)",border:"1px solid #da3633",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:13,color:"#f85149"}}>
            ⚠️ {analytics.unmatchedSales} venda(s) não atribuída(s) a nenhum time —
            {analytics.unmatchedKK>0&&` ${analytics.unmatchedKK.toFixed(1)}kk`}
            {analytics.unmatchedKK>0&&analytics.unmatchedTC>0&&" + "}
            {analytics.unmatchedTC>0&&` ${analytics.unmatchedTC.toFixed(0)}tc`}
            {" "}(R${analytics.unmatchedRealVal.toFixed(2)}) <strong>fora do total por fixo</strong>.
            Confira se o boneco de cada drop está em algum time A/B/C ou se a quest tem um time atribuído.
          </div>}
          <div style={{display:"flex",flexWrap:"wrap",gap:10,marginBottom:24}}>
            <StatCard label="Total de Quest's" value={analytics.totalQuests} color="#58a6ff"/>
            <StatCard label="Total de Drops" value={analytics.totalDrops} color="#a29bfe"/>
            <StatCard label="Vendidos" value={analytics.totalSold} color="#2ecc40"/>
            <StatCard label="Total Loot" value={`${analytics.totalLoot.toFixed(1)}kk`} color="#feca57"/>
            <StatCard label="Total Service" value={`${analytics.totalSvcTC.toFixed(0)}tc`} color="#48dbfb"/>
            <StatCard label="Vendas KK" value={`${analytics.soldKK.toFixed(1)}kk`} color="#2ecc40"/>
            <StatCard label="Vendas TC" value={`${analytics.soldTC.toFixed(0)}tc`} color="#a29bfe"/>
            <StatCard label="Tempo Total" value={fmtMin(analytics.totalTempo)} sub={`${analytics.totalTempo}min`} color="#fd79a8"/>
          </div>

          <h2 style={{...S.h2,marginTop:8}}>💰 Valor Unitário por Fixo</h2>
          <div style={{fontSize:11,color:"#484f58",marginBottom:12}}>Base ÷{BASE_DIVISOR} (suplentes substituem fixos, divisor fixo). Cotação: 1tc = {cfg.tcPriceKK}k | R${cfg.tcPriceReal}/{cfg.tcQty}tc</div>
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
              <div style={{borderTop:"1px solid #30363d",marginTop:12,paddingTop:10,display:"flex",gap:14,flexWrap:"wrap"}}>
                <div><div style={S.miniLbl}>Loot da Quest</div><div style={{fontSize:16,fontWeight:700,color:"#feca57"}}>{analytics.lootQuestA.toFixed(1)}kk</div><div style={{fontSize:11,color:"#484f58"}}>R${analytics.lootQuestARealVal.toFixed(2)}</div></div>
                <div><div style={S.miniLbl}>Service Quest</div><div style={{fontSize:16,fontWeight:700,color:"#48dbfb"}}>{analytics.svcQuestA.toFixed(0)}tc</div><div style={{fontSize:11,color:"#484f58"}}>R${analytics.svcQuestARealVal.toFixed(2)}</div></div>
                <div style={{borderLeft:"1px solid #30363d",paddingLeft:12}}><div style={S.miniLbl}>Total Time A (R$)</div><div style={{fontSize:18,fontWeight:700,color:"#00b894"}}>R${(analytics.unitARealVal+analytics.lootQuestARealVal+analytics.svcQuestAShareReal).toFixed(2)}</div></div>
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
              <div style={{borderTop:"1px solid #30363d",marginTop:12,paddingTop:10,display:"flex",gap:14,flexWrap:"wrap"}}>
                <div><div style={S.miniLbl}>Loot da Quest</div><div style={{fontSize:16,fontWeight:700,color:"#feca57"}}>{analytics.lootQuestB.toFixed(1)}kk</div><div style={{fontSize:11,color:"#484f58"}}>R${analytics.lootQuestBRealVal.toFixed(2)}</div></div>
                <div><div style={S.miniLbl}>Service Quest</div><div style={{fontSize:16,fontWeight:700,color:"#48dbfb"}}>{analytics.svcQuestB.toFixed(0)}tc</div><div style={{fontSize:11,color:"#484f58"}}>R${analytics.svcQuestBRealVal.toFixed(2)}</div></div>
                <div style={{borderLeft:"1px solid #30363d",paddingLeft:12}}><div style={S.miniLbl}>Total Time B (R$)</div><div style={{fontSize:18,fontWeight:700,color:"#00b894"}}>R${(analytics.unitBRealVal+analytics.lootQuestBRealVal+analytics.svcQuestBShareReal).toFixed(2)}</div></div>
              </div>
              <div style={{fontSize:11,color:"#484f58",marginTop:6}}>{teamB.join(", ")}</div>
            </div>
            {teamC.length>0&&<div style={{background:"#161b22",border:"1px solid #d29922",borderRadius:10,padding:16,flex:"1 1 300px"}}>
              <div style={{fontSize:13,fontWeight:600,color:"#d29922",marginBottom:10}}>🅲 Time C — {analytics.tCn} venda(s)</div>
              <div style={{display:"flex",gap:14,flexWrap:"wrap"}}>
                <div><div style={S.miniLbl}>Total KK</div><div style={S.miniVal}>{analytics.tCkk.toFixed(1)}kk</div></div>
                <div><div style={S.miniLbl}>Total TC</div><div style={{...S.miniVal,color:"#a29bfe"}}>{analytics.tCtc.toFixed(0)}tc</div></div>
                <div style={{borderLeft:"1px solid #30363d",paddingLeft:12}}>
                  <div style={S.miniLbl}>Unit. KK</div><div style={{fontSize:18,fontWeight:700,color:"#2ecc40"}}>{analytics.uCkk.toFixed(1)}kk</div>
                </div>
                <div><div style={S.miniLbl}>Unit. TC</div><div style={{fontSize:18,fontWeight:700,color:"#48dbfb"}}>{analytics.uCtc.toFixed(1)}tc</div></div>
                <div><div style={S.miniLbl}>Unit. R$</div><div style={{fontSize:18,fontWeight:700,color:"#00b894"}}>R${analytics.unitCRealVal.toFixed(2)}</div></div>
              </div>
              <div style={{borderTop:"1px solid #30363d",marginTop:12,paddingTop:10,display:"flex",gap:14,flexWrap:"wrap"}}>
                <div><div style={S.miniLbl}>Loot da Quest</div><div style={{fontSize:16,fontWeight:700,color:"#feca57"}}>{analytics.lootQuestC.toFixed(1)}kk</div><div style={{fontSize:11,color:"#484f58"}}>R${analytics.lootQuestCRealVal.toFixed(2)}</div></div>
                <div><div style={S.miniLbl}>Service Quest</div><div style={{fontSize:16,fontWeight:700,color:"#48dbfb"}}>{analytics.svcQuestC.toFixed(0)}tc</div><div style={{fontSize:11,color:"#484f58"}}>R${analytics.svcQuestCRealVal.toFixed(2)}</div></div>
                <div style={{borderLeft:"1px solid #30363d",paddingLeft:12}}><div style={S.miniLbl}>Total Time C (R$)</div><div style={{fontSize:18,fontWeight:700,color:"#00b894"}}>R${(analytics.unitCRealVal+analytics.lootQuestCRealVal+analytics.svcQuestCShareReal).toFixed(2)}</div></div>
              </div>
              <div style={{fontSize:11,color:"#484f58",marginTop:6}}>{teamC.join(", ")}</div>
            </div>}
            <div style={{background:"#161b22",border:"2px solid #2ecc40",borderRadius:10,padding:16,flex:"1 1 220px"}}>
              <div style={{fontSize:13,fontWeight:600,color:"#2ecc40",marginBottom:10}}>🏆 Total por Fixo</div>
              <div style={{display:"flex",gap:20,flexWrap:"wrap"}}>
                <div><div style={S.miniLbl}>KK</div><div style={{fontSize:24,fontWeight:700,color:"#2ecc40"}}>{analytics.totalUnitKK.toFixed(1)}kk</div></div>
                <div><div style={S.miniLbl}>TC</div><div style={{fontSize:24,fontWeight:700,color:"#48dbfb"}}>{analytics.totalUnitTC.toFixed(1)}tc</div></div>
                <div><div style={S.miniLbl}>R$ (vendas)</div><div style={{fontSize:24,fontWeight:700,color:"#00b894"}}>R${analytics.totalUnitReal.toFixed(2)}</div></div>
              </div>
              <div style={{borderTop:"1px solid #30363d",marginTop:12,paddingTop:10,display:"flex",gap:20,flexWrap:"wrap"}}>
                <div><div style={S.miniLbl}>Loot Quest Total</div><div style={{fontSize:18,fontWeight:700,color:"#feca57"}}>{(analytics.lootQuestA+analytics.lootQuestB+analytics.lootQuestC).toFixed(1)}kk</div><div style={{fontSize:11,color:"#484f58"}}>R${(analytics.lootQuestARealVal+analytics.lootQuestBRealVal+analytics.lootQuestCRealVal).toFixed(2)}</div></div>
                <div><div style={S.miniLbl}>Service Total</div><div style={{fontSize:18,fontWeight:700,color:"#48dbfb"}}>{analytics.totalSvcAll.toFixed(0)}tc</div></div>
              </div>
              <div style={{borderTop:"2px solid #2ecc40",marginTop:12,paddingTop:10}}>
                <div style={S.miniLbl}>🏆 Total Geral por Fixo (R$)</div>
                <div style={{fontSize:26,fontWeight:800,color:"#00b894"}}>R${analytics.grandTotalReal.toFixed(2)}</div>
              </div>
              <div style={{fontSize:11,color:"#484f58",marginTop:6}}>A+B{teamC.length>0?"+C":""} (KK→TC→R$)</div>
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
  rN:{background:"#0d1117"},rS:{background:"rgba(35,134,54,.08)"},rNoDrop:{background:"rgba(218,54,51,.07)"},
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
  toastBase:{position:"fixed",bottom:20,right:20,padding:"12px 18px",borderRadius:8,fontSize:13,fontWeight:600,zIndex:1000,boxShadow:"0 4px 14px rgba(0,0,0,.4)",maxWidth:360},
  toastError:{background:"#da3633",color:"#fff",border:"1px solid #f85149"},
  toastInfo:{background:"#1f6feb",color:"#fff",border:"1px solid #58a6ff"},
};
