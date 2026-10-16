import {useEffect,useState} from "react";
import type {Session} from "@supabase/supabase-js";
import {Gem,Check,Sparkles,Palette,Image,ShieldCheck,ArrowLeft,Clock} from "lucide-react";
import {supabase} from "./lib/supabase";
import "./premium.css";
type Access={status:string;expires_at:string|null};
const perks=[
 {icon:Image,title:"Bewegende profielfoto en banner",description:"Gebruik geanimeerde GIF- en WebP-bestanden op je profiel."},
 {icon:Sparkles,title:"Exclusieve avatarframes",description:"Gold, Neon, Galaxy en bewegende glow-frames."},
 {icon:Palette,title:"Profielkleuren en naam-effecten",description:"Kies gradients, accentkleuren en een geanimeerde naam."},
 {icon:Palette,title:"Exclusieve app-thema's",description:"Midnight, Aurora, Ocean en Royal Gold, met eigen accentkleur."},
 {icon:Gem,title:"Gouden Premium-badge",description:"Laat je Premium-status zien naast je naam."},
 {icon:Sparkles,title:"Profielpresets",description:"Sla meerdere profielstijlen op en wissel wanneer je wilt."}
];
export function PremiumPage({session,onBack}:{session:Session;onBack:()=>void}){
 const [access,setAccess]=useState<Access|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [billing,setBilling]=useState<{state:string;paid_through:string|null;subscription_id:string|null;cancel_at_period_end:boolean}|null>(null);
 const [busy,setBusy]=useState(false);
 useEffect(()=>{let live=true;if(!supabase){setLoading(false);return}void supabase.from("premium_subscriptions").select("status,expires_at").eq("user_id",session.user.id).maybeSingle().then(({data,error:e})=>{if(!live)return;if(e&&e.code!=="42P01")setError(e.message);setAccess(data);setLoading(false)});return()=>{live=false}},[session.user.id]);
 useEffect(()=>{if(!supabase)return;let mounted=true;void supabase.from("mollie_billing").select("state,paid_through,subscription_id,cancel_at_period_end").eq("user_id",session.user.id).maybeSingle().then(({data})=>{if(mounted)setBilling(data)});return()=>{mounted=false}},[session.user.id]);
 async function billingAction(name:"mollie-checkout"|"mollie-cancel"){if(!supabase)return;setBusy(true);setError("");const {data,error:e}=await supabase.functions.invoke(name,{body:{}});setBusy(false);if(e||data?.error){setError(data?.error||e?.message||"Er ging iets mis");return}if(name==="mollie-checkout"&&data?.url){window.location.assign(data.url);return}if(name==="mollie-cancel")setBilling(s=>s?{...s,cancel_at_period_end:true,state:"canceled_test"}:s)}
 const active=access?.status==="active"&&(!access.expires_at||new Date(access.expires_at).getTime()>Date.now());
 return <section className="premium-page">
  <button type="button" className="premium-back" onClick={onBack}><ArrowLeft size={18}/> Terug naar profiel</button>
  <div className="premium-hero"><div className="premium-glow"/><div className="premium-hero-content"><span className="premium-eyebrow"><Gem size={17}/> MINGLE PREMIUM</span><h1>Maak Mingle helemaal <em>van jou.</em></h1><p>Exclusieve animaties, profielstijlen en app-thema's. Jouw Mingle, jouw uitstraling.</p><div className="premium-price"><strong>€ 1,00</strong><span>/ maand</span></div><span className="premium-price-note">€ 1,00 per maand · momenteel uitsluitend Mollie-testmodus</span><div className="premium-hero-actions">{loading?<span>Status controleren…</span>:active?<span className="premium-active"><Check size={18}/> Premium actief{access?.expires_at?" tot "+new Date(access.expires_at).toLocaleDateString("nl-NL"):""}</span>:<button type="button" className="premium-disabled" disabled={busy} onClick={()=>void billingAction("mollie-checkout")}>{busy?"Even wachten…":"Mollie testbetaling starten"}</button>}</div><small><ShieldCheck size={14}/> Testmodus: er wordt geen echt geld afgeschreven. Live betalingen staan uit.</small></div></div>
  {billing&&<div className="premium-billing"><h2>Mollie testabonnement</h2><p>Status: {billing.state}{billing.paid_through?" · Testperiode tot "+new Date(billing.paid_through).toLocaleDateString("nl-NL"):""}</p>{billing.subscription_id&&!billing.cancel_at_period_end&&<button type="button" disabled={busy} onClick={()=>void billingAction("mollie-cancel")}>Testabonnement opzeggen</button>}{billing.cancel_at_period_end&&<p>Opgezegd: geen volgende testafschrijving.</p>}</div>}
  <div className="premium-section-title"><span>ALLE VOORDELEN</span><h2>Meer mogelijkheden voor jouw profiel</h2><p>Dit zijn de Premium-functies die we voor Mingle ontwikkelen. Ze worden stap voor stap beschikbaar.</p></div>
  <div className="premium-benefits">{perks.map(({icon:Icon,title,description})=><article className="premium-benefit" key={title}><span className="premium-benefit-icon"><Icon size={23}/></span><h3>{title}</h3><p>{description}</p><span className="premium-coming"><Clock size={13}/> In ontwikkeling</span></article>)}</div>
  <div className="premium-faq"><h2>Veelgestelde vragen</h2><details><summary>Wat kost Premium?</summary><p>De geplande prijs is € 1,00 per maand. Er worden momenteel alleen gesimuleerde testbetalingen verwerkt.</p></details><details><summary>Kan ik Premium al kopen?</summary><p>Je kunt de Mollie-testmodus gebruiken. Echte abonnementen blijven uitgeschakeld totdat de betaalaccountconfiguratie en controles zijn afgerond.</p></details><details><summary>Blijven gewone Mingle-functies gratis?</summary><p>Ja. Berichten plaatsen, reageren, volgen en de normale profielinstellingen blijven gratis.</p></details></div>
  {error&&<p className="premium-error">Premium-status kon niet worden opgehaald: {error}</p>}
 </section>
}
