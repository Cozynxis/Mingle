import { useEffect } from "react";
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { supabase } from "./lib/supabase";

export function AndroidAuthCallback(){
  useEffect(()=>{
    if(!Capacitor.isNativePlatform()||Capacitor.getPlatform()!=="android"||!supabase)return;
    let active=true;
    const handle=async(url:string)=>{
      if(!url.startsWith("mingle://auth/callback"))return;
      try{
        const parsed=new URL(url);
        const query=new URLSearchParams(parsed.search);
        const fragment=new URLSearchParams(parsed.hash.slice(1));
        const error=query.get("error_description")||fragment.get("error_description");
        if(error)throw new Error(error);
        const access=fragment.get("access_token")||query.get("access_token");
        const refresh=fragment.get("refresh_token")||query.get("refresh_token");
        if(access&&refresh){
          const {error:sessionError}=await supabase!.auth.setSession({access_token:access,refresh_token:refresh});
          if(sessionError)throw sessionError;
        }else if(query.get("code")){
          const {error:codeError}=await supabase!.auth.exchangeCodeForSession(query.get("code")!);
          if(codeError)throw codeError;
        }else throw new Error("Geen aanmeldgegevens ontvangen");
        if(active){await Browser.close().catch(()=>{});window.history.replaceState(null,"","/");}
      }catch(e){console.error("Android Google login failed:",e);if(active)await Browser.close().catch(()=>{});}
    };
    let listener:{remove:()=>Promise<void>}|undefined;
    void App.addListener("appUrlOpen",event=>{void handle(event.url)}).then(l=>{if(active)listener=l;else void l.remove()});
    void App.getLaunchUrl().then(event=>{if(event?.url)void handle(event.url)});
    return()=>{active=false;void listener?.remove()};
  },[]);
  return null;
}
