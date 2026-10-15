import {useEffect,useState} from "react";
import {supabase} from "./lib/supabase";
import {Megaphone,X} from "lucide-react";
import "./announcements.css";
type Announcement={id:string;title:string;body:string;tone:string;created_at:string};
const SEEN_KEY="mingle-announcements-seen-v2";
function readSeen():string[]{try{const parsed=JSON.parse(localStorage.getItem(SEEN_KEY)||"[]");return Array.isArray(parsed)?parsed.filter((id):id is string=>typeof id==="string"):[]}catch{return []}}
function markSeen(ids:string[]){if(!ids.length)return;try{localStorage.setItem(SEEN_KEY,JSON.stringify([...new Set([...readSeen(),...ids])].slice(-500)))}catch{/* Storage disabled */}}
export function AnnouncementPopup(){
 const [items,setItems]=useState<Announcement[]>([]);
 const [seen,setSeen]=useState<string[]>(readSeen);
 useEffect(()=>{if(!supabase)return;let live=true;async function refresh(){
  const {data}=await supabase!.from("platform_announcements").select("id,title,body,tone,created_at").eq("active",true).order("created_at",{ascending:false}).limit(20);
  if(!live||!data)return;
  const announcements=data as Announcement[];
  // On a fresh page load, existing announcements are considered seen.
  // Only announcements published while the page is open may pop up.
  if(!initialized){initialized=true;const existing=announcements.map(x=>x.id);markSeen(existing);setSeen(readSeen());return}
  setItems(announcements);
 }
 let initialized=false;
 void refresh();
 const channel=supabase.channel("mingle-announcements").on("postgres_changes",{event:"INSERT",schema:"public",table:"platform_announcements"},()=>void refresh()).subscribe();
 const interval=setInterval(()=>void refresh(),30000);
 return()=>{live=false;clearInterval(interval);void supabase!.removeChannel(channel)}
 },[]);
 const current=items.find(item=>!seen.includes(item.id));
 useEffect(()=>{if(!current)return;markSeen([current.id]);setSeen(readSeen())},[current?.id]);
 // The current notification remains visible until dismissed, even after being marked seen.
 const [visible,setVisible]=useState<Announcement|null>(null);
 useEffect(()=>{if(current)setVisible(current)},[current?.id]);
 if(!visible)return null;
 return <aside className={"mingle-announcement mingle-announcement-"+visible.tone} role="status" aria-live="polite" key={visible.id}><div className="mingle-announcement-icon"><Megaphone size={22}/></div><div className="mingle-announcement-content"><strong>{visible.title}</strong><p>{visible.body}</p><small>Mingle · Mededeling</small></div><button type="button" aria-label="Sluit mededeling" title="Sluiten" onClick={()=>setVisible(null)}><X size={19}/></button></aside>
}
