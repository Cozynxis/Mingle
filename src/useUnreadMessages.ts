import {useEffect,useState} from "react";
import {supabase} from "./lib/supabase";
export function useUnreadMessages(userId:string|null){
 const [count,setCount]=useState(0);
 useEffect(()=>{
  if(!userId||!supabase){setCount(0);return}
  let alive=true;
  const poll=async()=>{
   const [dm,groups]=await Promise.all([supabase!.rpc("dm_unread_counts"),supabase!.rpc("mingle_group_unread")]);
   if(!alive)return;
   const dmCount=(dm.data||[] as {unread_count:number}[]).reduce((n:number,x:{unread_count:number})=>n+Number(x.unread_count),0);
   const groupCount=(groups.data||[] as {unread_count:number}[]).reduce((n:number,x:{unread_count:number})=>n+Number(x.unread_count),0);
   setCount(dmCount+groupCount);
  };
  void poll();const timer=setInterval(()=>{void poll()},4000);
  const refresh=()=>{void poll()};window.addEventListener("focus",refresh);window.addEventListener("mingle-group-unread",refresh);
  return()=>{alive=false;clearInterval(timer);window.removeEventListener("focus",refresh);window.removeEventListener("mingle-group-unread",refresh)};
 },[userId]);
 return count;
}
