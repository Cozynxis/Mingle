import {useEffect,useRef,useState} from "react";
import {Phone,Video,X} from "lucide-react";
import {supabase} from "./lib/supabase";
import {startRingtone,stopRingtone} from "./MingleSounds";
type Offer={id:string;connection_id:string;call_id:string;created_at:string;payload:{video?:boolean}};
const ignored=new Set<string>();
export function IncomingCallWatcher({userId,onOpen}:{userId:string;onOpen:(id:string)=>void}){
 const [offer,setOffer]=useState<Offer|null>(null);
 const openRef=useRef(onOpen);openRef.current=onOpen;
 useEffect(()=>{
  if(!supabase)return;
  let live=true;let checking=false;
  const check=async()=>{
   if(checking||!live||document.hidden)return;
   checking=true;
   try{
    const {data}=await supabase!.from("dm_call_signals").select("id,connection_id,call_id,created_at,payload,kind").eq("recipient_id",userId).order("created_at",{ascending:false}).limit(40);
    if(!live||!data)return;
    const signals=data as (Offer&{kind:string})[];
    const ended=new Set(signals.filter(s=>s.kind==="hangup").map(s=>s.call_id));
    const fresh=signals.find(s=>s.kind==="offer"&&Date.now()-new Date(s.created_at).getTime()<35000&&!ended.has(s.call_id)&&!ignored.has(s.call_id));
    setOffer(current=>current&&fresh?.call_id===current.call_id?current:fresh||null);
   }finally{checking=false}
  };
  void check();
  const timer=window.setInterval(()=>{void check()},4000);
  const onFocus=()=>{void check()};
  window.addEventListener("mingle-refresh-incoming-calls",onFocus);
  document.addEventListener("visibilitychange",onFocus);
  return()=>{live=false;clearInterval(timer);window.removeEventListener("mingle-refresh-incoming-calls",onFocus);document.removeEventListener("visibilitychange",onFocus)};
 },[userId]);
 useEffect(()=>{if(offer)startRingtone();else stopRingtone();return()=>stopRingtone()},[offer?.call_id]);
 if(!offer)return null;
 const dismiss=()=>{stopRingtone();ignored.add(offer.call_id);setOffer(null)};
 return <div role="alertdialog" aria-label="Inkomende Mingle oproep" className="mingle-incoming-toast">
 <strong>{offer.payload?.video?"Inkomend videogesprek":"Inkomende spraakoproep"}</strong><p>Er belt iemand via Mingle.</p>
 <div className="mingle-incoming-actions"><button onClick={dismiss}><X size={17}/> Sluiten</button><button onClick={()=>{stopRingtone();ignored.add(offer.call_id);openRef.current(offer.connection_id);setOffer(null)}}>{offer.payload?.video?<Video size={17}/>:<Phone size={17}/>} Open gesprek</button></div></div>;
}
