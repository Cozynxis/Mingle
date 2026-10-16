import {useEffect,useState} from "react";
import {Capacitor} from "@capacitor/core";
import {App} from "@capacitor/app";
import "./android-update.css";
type Release={versionCode:number;versionName:string;apkUrl:string;releaseNotes?:string;required?:boolean};
export function AndroidUpdate(){
 const [release,setRelease]=useState<Release|null>(null);
 const [busy,setBusy]=useState(false);
 useEffect(()=>{if(!Capacitor.isNativePlatform()||Capacitor.getPlatform()!=="android")return;let live=true;
 const check=async()=>{try{const info=await App.getInfo();const res=await fetch("https://mingle-app.nl/android-update.json?t="+Date.now(),{cache:"no-store"});if(!res.ok)return;const data=await res.json() as Release;const current=Number(info.build);if(live&&Number.isInteger(data.versionCode)&&data.versionCode>current&&/^https:\/\//.test(data.apkUrl)&&new URL(data.apkUrl).hostname==="github.com")setRelease(data)}catch{/* Network unavailable: retry next launch */}};
 void check();const listener=()=>void check();document.addEventListener("visibilitychange",listener);return()=>{live=false;document.removeEventListener("visibilitychange",listener)}},[]);
 if(!release)return null;
 return <div className="mingle-android-update-backdrop"><section className="mingle-android-update" role="dialog" aria-modal="true" aria-label="Android-update beschikbaar"><span className="mingle-android-update-label">MINGLE ANDROID</span><h2>Nieuwe update beschikbaar</h2><p>Versie {release.versionName} staat klaar.</p><p>{release.releaseNotes||"Nieuwe verbeteringen en bugfixes."}</p><div className="mingle-android-update-actions"><button type="button" disabled={busy} onClick={()=>{setBusy(true);window.location.assign(release.apkUrl)}}>{busy?"Download openen...":"APK-update downloaden"}</button>{!release.required&&<button type="button" onClick={()=>setRelease(null)}>Later</button>}</div><small>Android vraagt toestemming om de APK te installeren. Installeer alleen updates van de officiële Mingle-releasepagina.</small></section></div>
}
