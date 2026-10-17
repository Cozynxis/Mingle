import {useState} from "react";
import {MapPin,X} from "lucide-react";
import {supabase} from "./lib/supabase";
import "./group-location.css";

/** Send one static, approximate location as an ordinary group message. */
export function GroupLocation({groupId,onClose,onSent}:{groupId:string;onClose:()=>void;onSent:()=>Promise<void>}){
 const [working,setWorking]=useState(false);
 const [error,setError]=useState("");
 async function sendLocation(){
  if(working)return;
  if(!supabase){setError("Geen verbinding met Mingle.");return}
  if(!navigator.geolocation){setError("Locatie is niet beschikbaar op dit apparaat.");return}
  setWorking(true);setError("");
  try{
   const pos=await new Promise<GeolocationPosition>((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:false,maximumAge:30000,timeout:15000}));
   // Approximate location: round to ~100 m before sharing.
   const lat=Number(pos.coords.latitude.toFixed(3));
   const lon=Number(pos.coords.longitude.toFixed(3));
   const url=`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=15/${lat}/${lon}`;
   const {error:e}=await supabase.rpc("mingle_group_send",{g:groupId,content:"📍 Mijn locatie (ongeveer): "+url});
   if(e)throw e;
   await onSent();
   onClose();
  }catch(e){
   if(e instanceof GeolocationPositionError){setError(e.code===1?"Je hebt geen toestemming gegeven voor je locatie.":e.code===3?"Locatie ophalen duurde te lang. Probeer opnieuw.":"Je locatie kon niet worden bepaald.")}
   else setError(e instanceof Error?e.message:"Locatie versturen mislukt.");
  }finally{setWorking(false)}
 }
 return <div className="mgl-overlay"><section className="mgl-panel" role="dialog" aria-modal="true" aria-label="Locatie versturen">
  <header><h3><MapPin size={19}/> Locatie versturen</h3><button onClick={onClose} aria-label="Sluiten"><X size={20}/></button></header>
  <p className="mgl-note">Stuur je huidige, afgeronde locatie als één bericht naar deze groepschat. Andere groepsleden kunnen de locatie openen op een kaart.</p>
  <p className="mgl-note">Je locatie wordt niet live gevolgd of bijgewerkt. Alleen als je op de knop drukt, vraagt Mingle om locatietoestemming.</p>
  <button className="mgl-primary" disabled={working} onClick={()=>void sendLocation()}><MapPin size={17}/>{working?"Locatie ophalen...":"Mijn locatie versturen"}</button>
  {error&&<p className="mgl-error" role="alert">{error}</p>}
 </section></div>
}
