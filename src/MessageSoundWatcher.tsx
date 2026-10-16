import {useEffect,useRef} from "react";
import {supabase} from "./lib/supabase";
import {playSound} from "./MingleSounds";
/** Only play off-page notifications for newly observed messages, not message history. */
export function MessageSoundWatcher({userId,page}:{userId:string;page:string}){
 const pageRef=useRef(page);pageRef.current=page;
 useEffect(()=>{
  if(!supabase)return;
  let alive=true,initialized=false,checking=false;
  const seen=new Set<string>();
  const poll=async()=>{
   if(!alive||checking||document.hidden)return;
   checking=true;
   try{
    const {data:connections}=await supabase!.from("dm_connections").select("id").eq("status","accepted").or("requester_id.eq."+userId+",recipient_id.eq."+userId);
    const ids=(connections||[]).map(c=>c.id);
    if(!ids.length)return;
    const {data}=await supabase!.from("dm_messages").select("id,sender_id,created_at").in("connection_id",ids).order("created_at",{ascending:false}).limit(35);
    if(!alive||!data)return;
    const newIncoming=data.filter(m=>!seen.has(m.id)&&m.sender_id!==userId);
    if(initialized&&newIncoming.length&&pageRef.current!=="Messages")void playSound("notificationOff");
    data.forEach(m=>seen.add(m.id));
    if(seen.size>500){seen.clear();data.forEach(m=>seen.add(m.id))}
    initialized=true;
   }finally{checking=false}
  };
  void poll();
  const timer=window.setInterval(()=>{void poll()},3500);
  return()=>{alive=false;clearInterval(timer)}
 },[userId]);
 return null;
}
