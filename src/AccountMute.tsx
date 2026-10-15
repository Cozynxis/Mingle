import {useEffect,useState} from "react";
import {supabase} from "./lib/supabase";
import {ShieldAlert,X} from "lucide-react";
import "./mute.css";
type Restriction={muted_until:string|null;reason:string};
function activeMute(v:Restriction|null){return !!v?.muted_until&&(v.muted_until==="infinity"||new Date(v.muted_until).getTime()>Date.now())}
export function useAccountMute(userId:string|null|undefined){
 const [mute,setMute]=useState<Restriction|null>(null);
 useEffect(()=>{if(!userId||!supabase){setMute(null);return}let live=true;const refresh=async()=>{const {data}=await supabase!.from("user_restrictions").select("muted_until,reason").eq("user_id",userId).maybeSingle();if(live)setMute(data as Restriction|null)};void refresh();const interval=setInterval(()=>void refresh(),20000);return()=>{live=false;clearInterval(interval)}},[userId]);
 return activeMute(mute)?mute:null;
}
export function muteMessage(mute:Restriction){const until=mute.muted_until==="infinity"?"totdat een beheerder de beperking opheft":mute.muted_until?"tot "+new Date(mute.muted_until).toLocaleString("nl-NL"):"";return "Je account is gemutet "+until+". Je kunt tijdelijk geen berichten, reacties of interacties plaatsen."+(mute.reason?" Reden: "+mute.reason:"")}
export function AccountMuteBanner({userId}:{userId:string|null|undefined}){
 const mute=useAccountMute(userId);const [dismissed,setDismissed]=useState(false);
 useEffect(()=>setDismissed(false),[mute?.muted_until]);
 if(!mute||dismissed)return null;
 return <aside className="mingle-mute-banner" role="alert"><ShieldAlert size={24}/><div><strong>Je account is beperkt</strong><p>{muteMessage(mute)}</p></div><button type="button" aria-label="Melding sluiten" onClick={()=>setDismissed(true)}><X size={19}/></button></aside>
}
export async function readableMuteError(message:string,userId:string){if(!supabase||!/beperkt|muted|muten|mingle_check_mute|temporarily restricted/i.test(message))return message;const {data}=await supabase.from("user_restrictions").select("muted_until,reason").eq("user_id",userId).maybeSingle();return data&&activeMute(data as Restriction)?muteMessage(data as Restriction):message}
