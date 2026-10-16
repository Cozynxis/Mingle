import {useEffect,useRef,useState} from "react";
import {supabase} from "./lib/supabase";
import {Megaphone,X} from "lucide-react";
import "./announcements.css";
type Announcement={id:string;title:string;body:string;tone:string;created_at:string};
const SEEN_KEY="mingle-announcements-seen-v3";
const LEGACY_CUTOFF=Date.parse("2026-10-16T00:00:00+02:00");
function readSeen():string[]{try{const parsed=JSON.parse(localStorage.getItem(SEEN_KEY)||"[]");return Array.isArray(parsed)?parsed.filter((x):x is string=>typeof x==="string"):[]}catch{return []}}
function markSeen(id:string){try{localStorage.setItem(SEEN_KEY,JSON.stringify([...new Set([...readSeen(),id])].slice(-1000)))}catch{}}
export function AnnouncementPopup(){
 const [visible,setVisible]=useState<Announcement|null>(null);
 const visibleRef=useRef<string|null>(null);
 useEffect(()=>{if(!supabase)return;let live=true;
 async function refresh(){
  const {data}=await supabase!.from("platform_announcements").select("id,title,body,tone,created_at").eq("active",true).order("created_at",{ascending:true}).limit(100);
  if(!live||!data||visibleRef.current)return;
  const seen=new Set(readSeen());
  const next=(data as Announcement[]).find(a=>Date.parse(a.created_at)>LEGACY_CUTOFF&&!seen.has(a.id));
  if(!next)return;
  markSeen(next.id);visibleRef.current=next.id;setVisible(next);
 }
 void refresh();
 const channel=supabase.channel("mingle-announcements-v3").on("postgres_changes",{event:"INSERT",schema:"public",table:"platform_announcements"},()=>void refresh()).subscribe();
 const interval=setInterval(()=>void refresh(),30000);
 return()=>{live=false;clearInterval(interval);void supabase!.removeChannel(channel)}
 },[]);
 if(!visible)return null;
 return <aside className={"mingle-announcement mingle-announcement-"+visible.tone} role="status" aria-live="polite"><div className="mingle-announcement-icon"><Megaphone size={22}/></div><div className="mingle-announcement-content"><strong>{visible.title}</strong><p>{visible.body}</p><small>Mingle · Mededeling</small></div><button type="button" aria-label="Sluit mededeling" title="Sluiten" onClick={()=>{visibleRef.current=null;setVisible(null)}}><X size={19}/></button></aside>
}
