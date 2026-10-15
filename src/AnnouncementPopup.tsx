import {useEffect,useState} from "react";
import {supabase} from "./lib/supabase";
import {Megaphone,X} from "lucide-react";
import "./announcements.css";
type Announcement={id:string;title:string;body:string;tone:string;created_at:string};
export function AnnouncementPopup(){
 const [items,setItems]=useState<Announcement[]>([]);
 const [hidden,setHidden]=useState<string[]>(()=>{try{return JSON.parse(sessionStorage.getItem("mingle-announcement-hidden")||"[]") as string[]}catch{return []}});
 useEffect(()=>{if(!supabase)return;let live=true;async function refresh(){const {data}=await supabase!.from("platform_announcements").select("id,title,body,tone,created_at").eq("active",true).order("created_at",{ascending:false}).limit(10);if(live&&data)setItems(data as Announcement[])}void refresh();const channel=supabase.channel("mingle-announcements").on("postgres_changes",{event:"*",schema:"public",table:"platform_announcements"},()=>void refresh()).subscribe();const interval=setInterval(()=>void refresh(),30000);return()=>{live=false;clearInterval(interval);void supabase!.removeChannel(channel)}},[]);
 const current=items.find(item=>!hidden.includes(item.id));if(!current)return null;
 return <aside className={"mingle-announcement mingle-announcement-"+current.tone} role="status" aria-live="polite" key={current.id}><div className="mingle-announcement-icon"><Megaphone size={22}/></div><div className="mingle-announcement-content"><strong>{current.title}</strong><p>{current.body}</p><small>Mingle · Mededeling</small></div><button type="button" aria-label="Sluit mededeling" title="Sluiten" onClick={()=>{const next=[...hidden,current.id];setHidden(next);sessionStorage.setItem("mingle-announcement-hidden",JSON.stringify(next))}}><X size={19}/></button></aside>
}
