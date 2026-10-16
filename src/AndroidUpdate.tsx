import {useEffect,useState} from "react";
import {Capacitor} from "@capacitor/core";
import {App} from "@capacitor/app";
import {supabase} from "./lib/supabase";
import "./android-update.css";
type Release={versionCode:number;versionName:string;apkUrl:string;title?:string;description?:string;releaseNotes?:string;color?:string;required?:boolean;enabled?:boolean};
const validUrl=(url:string)=>{try{const u=new URL(url);return u.protocol==="https:"&&u.hostname==="github.com"&&u.pathname.startsWith("/Cozynxis/Mingle/releases/download/")}catch{return false}};
export function AndroidUpdate(){
 const [release,setRelease]=useState<Release|null>(null),[busy,setBusy]=useState(false);
 useEffect(()=>{if(!Capacitor.isNativePlatform()||Capacitor.getPlatform()!=="android")return;let live=true;
 const check=async()=>{try{
 const info=await App.getInfo();let data:Release|null=null;
 if(supabase){const result=await supabase.rpc("mingle_android_update_config");if(!result.error&&result.data)data=result.data as Release}
 if(!data){const res=await fetch("https://mingle-app.nl/android-update.json?t="+Date.now(),{cache:"no-store"});if(res.ok)data=await res.json() as Release}
 const current=Number(info.build);
 if(!live)return;
 if(data&&data.enabled!==false&&Number.isInteger(data.versionCode)&&data.versionCode>current&&validUrl(data.apkUrl))setRelease(data);
 else setRelease(null);
 }catch{/* Network unavailable: retry next check */}};
 void check();const listener=()=>{if(!document.hidden)void check()};document.addEventListener("visibilitychange",listener);
 const interval=window.setInterval(()=>void check(),5*60*1000);
 return()=>{live=false;document.removeEventListener("visibilitychange",listener);window.clearInterval(interval)}},[]);
 if(!release)return null;
 const color=/^#[0-9a-fA-F]{6}$/.test(release.color||"")?release.color:"#9465f5";
 return <div className="mingle-android-update-backdrop"><section className="mingle-android-update" role="dialog" aria-modal="true" aria-label="Android-update beschikbaar" style={{borderColor:color}}><span className="mingle-android-update-label" style={{color}}>MINGLE ANDROID</span><h2>{release.title||"Nieuwe update beschikbaar"}</h2><p>Versie {release.versionName} staat klaar.</p><p>{release.description||release.releaseNotes||"Nieuwe verbeteringen en bugfixes."}</p><div className="mingle-android-update-actions"><button type="button" disabled={busy} style={{backgroundColor:color}} onClick={()=>{setBusy(true);window.location.assign(release.apkUrl);window.setTimeout(()=>setBusy(false),1500)}}>{busy?"Download openen...":"APK-update downloaden"}</button>{!release.required&&<button type="button" onClick={()=>setRelease(null)}>Later</button>}</div>{release.required&&<p>Deze Android-versie moet worden bijgewerkt voordat je verder kunt.</p>}<small>Android vraagt zelf toestemming om de APK te installeren. Download uitsluitend de officiële Mingle-release.</small></section></div>
}
