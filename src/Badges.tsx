import {useEffect,useState} from "react";
import {supabase} from "./lib/supabase";
export type BadgeKind="verified"|"official"|"premium";
type BadgeInfo={awarded:BadgeKind[];preferred:BadgeKind|null};
const cache=new Map<string,BadgeInfo>();
const pending=new Map<string,Promise<BadgeInfo>>();
const listeners=new Map<string,Set<(value:BadgeInfo)=>void>>();
const empty:BadgeInfo={awarded:[],preferred:null};
async function getInfo(id:string):Promise<BadgeInfo>{
 if(cache.has(id))return cache.get(id)!;
 if(pending.has(id))return pending.get(id)!;
 if(!supabase)return empty;
 const request=(async()=>{
  const [a,p]=await Promise.all([supabase!.rpc("mingle_active_badges",{uid:id}),supabase!.from("badge_preferences").select("preferred_badge").eq("user_id",id).maybeSingle()]);
  const info:BadgeInfo={awarded:(Array.isArray(a.data)?a.data:[]).filter((x):x is BadgeKind=>x==="verified"||x==="official"||x==="premium"),preferred:(p.data?.preferred_badge as BadgeKind|null)||null};
  cache.set(id,info);pending.delete(id);return info;
 })().catch(()=>{pending.delete(id);return empty});
 pending.set(id,request);return request;
}
export function invalidateBadges(id:string){cache.delete(id);pending.delete(id);void getInfo(id).then(info=>listeners.get(id)?.forEach(fn=>fn(info)))}
export function useBadges(id:string|null|undefined){
 const [info,setInfo]=useState<BadgeInfo>(id?cache.get(id)||empty:empty);
 useEffect(()=>{if(!id){setInfo(empty);return}let live=true;setInfo(cache.get(id)||empty);let set=listeners.get(id);if(!set){set=new Set();listeners.set(id,set)}const listener=(value:BadgeInfo)=>{if(live)setInfo(value)};set.add(listener);void getInfo(id).then(listener);const interval=window.setInterval(()=>invalidateBadges(id),60000);return()=>{window.clearInterval(interval);live=false;set!.delete(listener);if(!set!.size)listeners.delete(id)}},[id]);
 return info;
}
export function badgeOrder(info:BadgeInfo):BadgeKind[]{const list=[...info.awarded].sort((a,b)=>["verified","official","premium"].indexOf(a)-["verified","official","premium"].indexOf(b));if(info.preferred&&list.includes(info.preferred)){list.splice(list.indexOf(info.preferred),1);list.unshift(info.preferred)}return list}
export function NameBadge({userId}:{userId:string|null|undefined}){const info=useBadges(userId);const badges=badgeOrder(info);const chosen=badges[0];return chosen?<img className="mingle-name-badge" src={"/badges/"+chosen+".svg"} alt={chosen+" badge"} title={chosen}/>:null}
export function ProfileBadges({userId}:{userId:string|null|undefined}){const info=useBadges(userId);return <span className="profile-awarded-badges">{badgeOrder(info).map(b=><img key={b} src={"/badges/"+b+".svg"} title={b} alt={b+" badge"}/>)}</span>}
export function BadgePreference({userId}:{userId:string}){const info=useBadges(userId);const [saving,setSaving]=useState(false);const [error,setError]=useState("");const order=badgeOrder(info);if(!order.length)return null;return <div className="mingle-badge-preference"><label htmlFor="mingle-badge-choice">Hoofdbadge naast je naam</label><select id="mingle-badge-choice" value={info.preferred&&info.awarded.includes(info.preferred)?info.preferred:order[0]} disabled={saving} onChange={async e=>{if(!supabase)return;setSaving(true);setError("");const value=e.target.value as BadgeKind;const {error:err}=await supabase.from("badge_preferences").upsert({user_id:userId,preferred_badge:value},{onConflict:"user_id"});if(err)setError(err.message);else invalidateBadges(userId);setSaving(false)}}>{order.map(b=><option key={b} value={b}>{b==="verified"?"Verified":b==="official"?"Official":"Premium"}</option>)}</select>{error&&<small role="alert">{error}</small>}</div>}
