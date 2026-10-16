import {useEffect,useState} from "react";
import "./settings-extra.css";
type Prefs={compact:boolean;reduceMotion:boolean;largeText:boolean;hideMedia:boolean;confirmLinks:boolean};
const defaults:Prefs={compact:false,reduceMotion:false,largeText:false,hideMedia:false,confirmLinks:false};
const key="mingle_display_preferences_v1";
function load():Prefs{try{return {...defaults,...JSON.parse(localStorage.getItem(key)||"{}")}}catch{return defaults}}
export function ExtraSettings(){
 const [prefs,setPrefs]=useState<Prefs>(load);
 useEffect(()=>{localStorage.setItem(key,JSON.stringify(prefs));const root=document.documentElement;for(const [k,v] of Object.entries(prefs))root.classList.toggle("mingle-pref-"+k,v);return()=>{for(const k of Object.keys(prefs))root.classList.remove("mingle-pref-"+k)}},[prefs]);
 const items:[keyof Prefs,string,string][]=[
 ["compact","Compacte weergave","Minder ruimte tussen berichten en onderdelen."],
 ["reduceMotion","Minder animaties","Beperk bewegingen, overgangen en visuele effecten."],
 ["largeText","Grotere tekst","Maak de belangrijkste tekst beter leesbaar."],
 ["hideMedia","Afbeeldingen verbergen","Verberg berichtafbeeldingen op dit apparaat."],
 ];
 return <section className="mingle-extra-settings"><div className="mingle-settings-head"><h2>Weergave en toegankelijkheid</h2><p>Deze instellingen worden op dit apparaat opgeslagen.</p></div>{items.map(([id,title,description])=><label className="mingle-setting-toggle" key={id}><span><strong>{title}</strong><small>{description}</small></span><input type="checkbox" checked={prefs[id]} onChange={e=>setPrefs(p=>({...p,[id]:e.target.checked}))}/></label>)}<div className="mingle-settings-actions"><button type="button" onClick={()=>setPrefs(defaults)}>Standaardinstellingen herstellen</button></div></section>
}