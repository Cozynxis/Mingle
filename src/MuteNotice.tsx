import {useEffect,useState} from "react";
import {supabase} from "./lib/supabase";
import {ShieldAlert} from "lucide-react";
import "./mute.css";
type Restriction={muted_until:string|null;reason:string};
export function MuteNotice({userId}:{userId:string}){
 const [restriction,setRestriction]=useState<Restriction|null>(null);
 useEffect(()=>{if(!supabase)return;let live=true;const refresh=async()=>{const {data}=await supabase!.from("user_restrictions").select("muted_until,reason").eq("user_id",userId).maybeSingle();if(live)setRestriction(data)};void refresh();const timer=window.setInterval(()=>void refresh(),15000);return()=>{live=false;clearInterval(timer)}},[userId]);
 if(!restriction?.muted_until||restriction.muted_until!=="infinity"&&new Date(restriction.muted_until).getTime()<=Date.now())return null;
 return <div className="mingle-mute-banner" role="alert"><ShieldAlert size={23}/><div><strong>Je account is gemutet</strong><p>Je kunt momenteel geen posts, reacties, privéberichten of andere interacties plaatsen.</p>{restriction.reason&&<p><b>Reden:</b> {restriction.reason}</p>}<p><b>Tot:</b> {restriction.muted_until==="infinity"?"Onbepaalde tijd":new Date(restriction.muted_until).toLocaleString("nl-NL",{dateStyle:"medium",timeStyle:"short"})}</p></div></div>
}
export function friendlyMuteError(message:string){if(message.includes("record \"new\" has no field"))return "Databasefout bij accountbeperkingen. Een beheerder moet de nieuwste mute-SQL uitvoeren.";if(message.includes("Je account is tijdelijk beperkt"))return "Je account is gemutet. Bekijk de melding bovenaan voor de reden en einddatum.";return message}
