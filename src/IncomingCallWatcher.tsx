import {useEffect,useRef,useState} from "react";
import {Phone,Video,X} from "lucide-react";
import {supabase} from "./lib/supabase";
type Offer={id:string;connection_id:string;call_id:string;created_at:string;payload:{video?:boolean}};
export function IncomingCallWatcher({userId,onOpen}:{userId:string;onOpen:(id:string)=>void}){
 const [offer,setOffer]=useState<Offer|null>(null),seen=useRef(new Set<string>());
 useEffect(()=>{if(!supabase)return;let live=true;const check=async()=>{const {data}=await supabase!.from("dm_call_signals").select("id,connection_id,call_id,created_at,payload,kind").eq("recipient_id",userId).eq("kind","offer").order("created_at",{ascending:false}).limit(5);if(!live||!data)return;const fresh=(data as (Offer&{kind:string})[]).find(x=>Date.now()-new Date(x.created_at).getTime()<45000&&!seen.current.has(x.call_id));if(fresh){seen.current.add(fresh.call_id);setOffer(fresh)}};void check();const timer=setInterval(()=>{if(!document.hidden)void check()},3000);return()=>{live=false;clearInterval(timer)}},[userId]);
 if(!offer)return null;
 return <div role="alertdialog" aria-label="Inkomende Mingle oproep" style={{position:"fixed",right:18,top:18,zIndex:99999,background:"#211c32",color:"white",padding:20,borderRadius:16,boxShadow:"0 10px 45px #0007",maxWidth:340}}>
 <strong>{offer.payload?.video?"Inkomend videogesprek":"Inkomende spraakoproep"}</strong><p>Er belt iemand via Mingle.</p>
 <div style={{display:"flex",gap:10}}><button onClick={()=>setOffer(null)}><X size={18}/> Weigeren</button><button onClick={()=>{onOpen(offer.connection_id);setOffer(null)}}>{offer.payload?.video?<Video size={18}/>:<Phone size={18}/>} Open gesprek</button></div></div>;
}
