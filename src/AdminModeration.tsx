import {useEffect,useState} from "react";
import {supabase} from "./lib/supabase";
import {Trash2,RefreshCw} from "lucide-react";
type Item={id:string;author_id:string;body:string;created_at:string};
type Kind="replies"|"community_posts"|"community_replies";
const config:Record<Kind,{table:string;fn:string;label:string}>={
 replies:{table:"post_replies",fn:"admin_delete_reply",label:"Reacties op posts"},
 community_posts:{table:"community_posts",fn:"admin_delete_community_post",label:"Communityberichten"},
 community_replies:{table:"community_replies",fn:"admin_delete_community_reply",label:"Communityreacties"}
};
export default function AdminModeration({kind,users}:{kind:Kind;users:Record<string,string>}){
 const [items,setItems]=useState<Item[]>([]),[search,setSearch]=useState(""),[error,setError]=useState(""),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false),[confirm,setConfirm]=useState<Item|null>(null);
 async function load(){if(!supabase)return;const {data,error:e}=await supabase.from(config[kind].table).select("id,author_id,body,created_at").order("created_at",{ascending:false}).limit(250);if(e)setError(e.message);else{setItems((data||[]) as Item[]);setError("")}}
 useEffect(()=>{setSearch("");setNotice("");void load()},[kind]);
 async function remove(){if(!supabase||!confirm)return;setBusy(true);setError("");const {error:e}=await supabase.rpc(config[kind].fn,kind==="replies"||kind==="community_replies"?{rid:confirm.id}:{pid:confirm.id});if(e)setError(e.message);else{setNotice("Verwijderd en gelogd");setConfirm(null);await load()}setBusy(false)}
 const filtered=items.filter(x=>(x.body+" "+(users[x.author_id]||"")+" "+x.author_id).toLowerCase().includes(search.toLowerCase()));
 return <section className="admin-card"><div className="admin-section-heading"><div><h2>{config[kind].label}</h2><p>Laatste 250 items · serverbeveiligde moderatie met auditlog.</p></div><button onClick={()=>void load()}><RefreshCw size={17}/> Vernieuwen</button></div><input className="admin-filter-input" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Zoek in inhoud of auteur…"/>{error&&<p className="admin-error">{error}</p>}{notice&&<p className="admin-ok">{notice}</p>}{filtered.map(item=><div className="admin-list-row" key={item.id}><div><small>@{users[item.author_id]||item.author_id.slice(0,8)} · {new Date(item.created_at).toLocaleString("nl-NL")}</small><p>{item.body}</p></div><button className="admin-danger" disabled={busy} onClick={()=>setConfirm(item)}><Trash2 size={16}/> Verwijderen</button></div>)}{filtered.length===0&&<p>Geen resultaten.</p>}{confirm&&<div className="admin-modal-overlay"><div className="admin-modal"><h2>Item verwijderen?</h2><p>Dit verwijdert de inhoud definitief en registreert de actie.</p><div><button onClick={()=>setConfirm(null)}>Annuleren</button><button className="admin-danger" disabled={busy} onClick={()=>void remove()}>Definitief verwijderen</button></div></div></div>}</section>
}
