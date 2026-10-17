import {useEffect,useRef} from "react";
import {Capacitor} from "@capacitor/core";
import {PushNotifications} from "@capacitor/push-notifications";
import {supabase} from "./lib/supabase";
export function AndroidCallPush({userId,onOpen,onNavigate}:{userId:string;onOpen:(id:string)=>void;onNavigate?:(data:Record<string,unknown>)=>void}){
 const openRef=useRef(onOpen);openRef.current=onOpen;
 const navigateRef=useRef(onNavigate);navigateRef.current=onNavigate;
 useEffect(()=>{
  if(!Capacitor.isNativePlatform()||Capacitor.getPlatform()!=="android"||!supabase)return;
  let alive=true;
  const listeners:{remove:()=>Promise<void>}[]=[];
  const save=async(token:string)=>{
   if(!alive||!supabase)return;
   const {error}=await supabase.from("mingle_push_tokens").upsert({user_id:userId,token,platform:"android",updated_at:new Date().toISOString()},{onConflict:"token"});
   if(error)console.warn(error.message);
  };
  const open=(data:Record<string,unknown>)=>{
   if(data?.type==="incoming_call"&&typeof data.connection_id==="string")openRef.current(data.connection_id);
   else if(["dm_message","group_message","follow"].includes(String(data?.type)))navigateRef.current?.(data);
  };
  void (async()=>{
   try{
    listeners.push(await PushNotifications.addListener("registration",e=>{void save(e.value)}));
    listeners.push(await PushNotifications.addListener("registrationError",e=>console.warn(e)));
    listeners.push(await PushNotifications.addListener("pushNotificationActionPerformed",e=>open(e.notification.data)));
    listeners.push(await PushNotifications.addListener("pushNotificationReceived",()=>window.dispatchEvent(new Event("mingle-refresh-incoming-calls"))));
    await PushNotifications.createChannel({id:"mingle_messages",name:"Mingle-berichten",description:"Privé- en groepsberichten",importance:4,visibility:1,sound:"default",vibration:true});
    await PushNotifications.createChannel({id:"mingle_social",name:"Mingle-sociaal",description:"Volgers en sociale meldingen",importance:3,visibility:1,sound:"default",vibration:true});
    await PushNotifications.createChannel({id:"mingle_calls",name:"Mingle-oproepen",description:"Inkomende oproepen",importance:5,visibility:1,sound:"default",vibration:true});
    const permission=await PushNotifications.checkPermissions();
    const allowed=permission.receive==="granted"?permission:await PushNotifications.requestPermissions();
    if(allowed.receive==="granted")await PushNotifications.register();
   }catch(e){console.warn("Push unavailable",e)}
  })();
  return()=>{alive=false;listeners.forEach(x=>{void x.remove()})};
 },[userId]);
 return null;
}
