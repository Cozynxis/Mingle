import {useEffect,useState} from "react";
import {supabase} from "./lib/supabase";
export function useUnreadMessages(userId:string|null){
 const [count,setCount]=useState(0);
 useEffect(()=>{
  if(!userId||!supabase){setCount(0);return}
  let alive=true;
  const poll=async()=>{const {data}=await supabase!.rpc("dm_unread_counts");if(alive&&data)setCount((data as {unread_count:number}[]).reduce((n,x)=>n+Number(x.unread_count),0))};
  void poll();const timer=setInterval(()=>{void poll()},4500);
  const refresh=()=>{void poll()};window.addEventListener("focus",refresh);
  return()=>{alive=false;clearInterval(timer);window.removeEventListener("focus",refresh)};
 },[userId]);
 return count;
}
