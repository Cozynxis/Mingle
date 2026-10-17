import {useCallback,useEffect,useRef,useState} from "react";
import {MapPin,Radio,Square, X} from "lucide-react";
import {supabase} from "./lib/supabase";
import "./group-location.css";
type Shared={id:string;user_id:string;latitude:number;longitude:number;expires_at:string;updated_at:string};
export function GroupLocation({groupId,me,onClose}:{groupId:string;me:string;onClose:()=>void}){
 const [locations,setLocations]=useState<Shared[]>([]);
 const [duration,setDuration]=useState(15);
 const [sharing,setSharing]=useState<string|null>(null);
 const [mode,setMode]=useState<"live"|"once">("live");
 const [error,setError]=useState("");
 const [working,setWorking]=useState(false);
 const watch=useRef<number|null>(null);
 const current=useRef<string|null>(null);
 const stopWatch=()=>{if(watch.current!==null){navigator.geolocation.clearWatch(watch.current);watch.current=null}};
 const load=useCallback(async()=>{if(!supabase)return;const {data}=await supabase.from("mingle_group_locations").select("id,user_id,latitude,longitude,expires_at,updated_at").eq("group_id",groupId).gt("expires_at",new Date().toISOString()).eq("active",true);if(data){setLocations(data);if(!current.current){const mine=data.find(x=>x.user_id===me);if(mine)setSharing(mine.id)}}},[groupId,me]);
 useEffect(()=>{void load();const timer=setInterval(()=>void load(),12000);return()=>clearInterval(timer)},[load]);
 useEffect(()=>()=>{stopWatch()},[]);
 useEffect(()=>{current.current=sharing},[sharing]);
 async function stop(){stopWatch();const id=current.current;current.current=null;setSharing(null);if((id||locations.some(x=>x.user_id===me))&&supabase){const {error:e}=await supabase.rpc("mingle_group_location_stop",{loc:id||locations.find(x=>x.user_id===me)?.id});if(e)setError(e.message)}void load()}
 async function start(){if(!supabase||!navigator.geolocation||working)return;setWorking(true);setError("");try{
  const position=await new Promise<GeolocationPosition>((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:false,timeout:15000,maximumAge:30000}));
  const {data,error:e}=await supabase.rpc("mingle_group_location_start",{g:groupId,lat:position.coords.latitude,lon:position.coords.longitude,minutes:mode==="once"?15:duration});
  if(e)throw e;const id=String(data);if(mode==="live"){current.current=id;setSharing(id);watch.current=navigator.geolocation.watchPosition(async p=>{if(!supabase||current.current!==id)return;const {error:err}=await supabase.rpc("mingle_group_location_update",{loc:id,lat:p.coords.latitude,lon:p.coords.longitude});if(err){setError(err.message);stopWatch();setSharing(null)}},e=>setError(e.message),{enableHighAccuracy:false,maximumAge:15000,timeout:20000})}
  await load();
 }catch(e){setError(e instanceof Error?e.message:"Locatietoegang geweigerd of niet beschikbaar")}finally{setWorking(false)}}
 return <div className="mgl-overlay"><section className="mgl-panel" role="dialog" aria-modal="true" aria-label="Groepslocaties">
 <header><h3><MapPin size={19}/> Locatie delen</h3><button onClick={onClose} aria-label="Sluiten"><X size={20}/></button></header>
 <p className="mgl-note">Alleen leden van deze groep zien gedeelde locaties. Je deelt een afgeronde locatie (ongeveer 100 meter nauwkeurig). Locatie delen staat standaard uit.</p>
 {!sharing?<><div className="mgl-modes"><button className={mode==="once"?"selected":""} onClick={()=>setMode("once")}>Eenmalige locatie</button><button className={mode==="live"?"selected":""} onClick={()=>setMode("live")}><Radio size={15}/> Live locatie</button></div>
 {mode==="live"&&<label>Deel gedurende <select value={duration} onChange={e=>setDuration(Number(e.target.value))}><option value={15}>15 minuten</option><option value={60}>1 uur</option><option value={480}>8 uur</option></select></label>}
 <p className="mgl-note">{mode==="live"?"Live delen werkt momenteel alleen zolang Mingle actief is. Op de achtergrond kunnen updates stoppen.":"Je locatie blijft maximaal 15 minuten zichtbaar en wordt niet automatisch bijgewerkt."}</p>
 <button className="mgl-primary" disabled={working} onClick={()=>void start()}><MapPin size={17}/>{working?"Locatie opvragen...":"Locatie delen starten"}</button></>:<div className="mgl-sharing"><strong><Radio size={16}/> Je deelt je live locatie</strong><button onClick={()=>void stop()}><Square size={14}/> Stop met delen</button></div>}
 {error&&<p className="mgl-error" role="alert">{error}</p>}
 <h4>Actieve locaties in deze groep</h4><div className="mgl-list">{locations.length===0?<p className="mgl-note">Er deelt momenteel niemand een locatie.</p>:locations.map(l=><div key={l.id} className="mgl-item"><span><MapPin size={16}/> {l.user_id===me?"Jouw locatie":"Groepslid"}<small>Bijgewerkt: {new Date(l.updated_at).toLocaleTimeString("nl-NL",{hour:"2-digit",minute:"2-digit"})}</small></span><a href={`https://www.openstreetmap.org/?mlat=${l.latitude}&mlon=${l.longitude}#map=15/${l.latitude}/${l.longitude}`} target="_blank" rel="noopener noreferrer">Bekijk kaart ↗</a></div>)}</div>
 <p className="mgl-note">Als je dit venster sluit, stoppen live updates. Een bestaande deelsessie kun je hier opnieuw openen en stoppen.</p>
 </section></div>
}
