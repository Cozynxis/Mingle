import { useEffect, useState, type FormEvent } from "react";
import { motion } from "motion/react";
import { Bell, Bookmark, Compass, Heart, Home, Mail, MessageCircle, MoreHorizontal, Repeat2, Search, Settings, ShieldCheck, Users, Moon, Sun, Monitor, LogOut, Image, ArrowRight, BadgeCheck, Gem, Star } from "lucide-react";
import { supabase } from "./lib/supabase";
import type { Session } from "@supabase/supabase-js";
type Theme = "dark" | "light" | "system";
const navigation = [{label:"Home",icon:Home},{label:"Explore",icon:Compass},{label:"Notifications",icon:Bell},{label:"Messages",icon:Mail},{label:"Communities",icon:Users},{label:"Bookmarks",icon:Bookmark},{label:"Settings",icon:Settings}];
function Brand(){return <div className="brand"><span className="brand-icon" aria-label="Mingle logo"><svg viewBox="0 0 64 64" aria-hidden="true" width="38" height="38"><rect x="0" y="0" width="64" height="64" rx="17" fill="#7385ff"/><path d="M12 44V24c0-9 12-9 12 0v20-20c0-9 12-9 12 0v20-20c0-9 12-9 12 0v20" fill="none" stroke="#fff" strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round"/></svg></span><strong>mingle<span className="brand-dot">.</span></strong></div>}
function Auth({onClose}:{onClose:()=>void}) {
  const [mode,setMode]=useState<"login"|"signup"|"reset"|"verify">("login");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [name,setName]=useState("");
  const [error,setError]=useState("");
  const [success,setSuccess]=useState("");
  const [busy,setBusy]=useState(false);
  const [showPassword,setShowPassword]=useState(false);
  const [resending,setResending]=useState(false);
  const [otp,setOtp]=useState("");
  const redirectTo=window.location.origin+"/Mingle/";
  function changeMode(next:typeof mode){setMode(next);setError("");setSuccess("")}
  async function submit(e:FormEvent){
    e.preventDefault();setError("");setSuccess("");
    if(!supabase){setError("De verbinding met Supabase ontbreekt.");return}
    setBusy(true);
    try {
      if(mode==="reset"){
        const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo});
        if(error)throw error;
        setSuccess("We hebben een herstelmail aangevraagd. Controleer ook je spamfolder.");
      }else if(mode==="signup"){
        const {data,error}=await supabase.auth.signUp({email,password,options:{data:{display_name:name.trim()},emailRedirectTo:redirectTo}});
        if(error)throw error;
        if(data.session){onClose();return}
        setOtp("");changeMode("verify");
      }else if(mode==="login"){
        const {error}=await supabase.auth.signInWithPassword({email,password});
        if(error)throw error;
        onClose();
      }
    }catch(e){setError(e instanceof Error?e.message:"Er ging iets mis. Probeer opnieuw.")}finally{setBusy(false)}
  }
  async function verifyCode(e:FormEvent){
    e.preventDefault();
    if(!supabase||busy||!/^[0-9]{8}$/.test(otp))return;
    setBusy(true);setError("");setSuccess("");
    try{
      const {error}=await supabase.auth.verifyOtp({email:email.trim(),token:otp,type:"email"});
      if(error)throw error;
      onClose();
    }catch(e){setError(e instanceof Error && !/expired|invalid/i.test(e.message)?e.message:"De code is ongeldig of verlopen. Vraag hieronder een nieuwe code aan en gebruik alleen de nieuwste e-mail.");}
    finally{setBusy(false)}
  }
  async function resend(){
    if(!supabase||resending)return;
    setResending(true);setError("");setSuccess("");
    try{const {error}=await supabase.auth.resend({type:"signup",email,options:{emailRedirectTo:redirectTo}});if(error)throw error;setSuccess("Nieuwe bevestigingsmail aangevraagd. Controleer ook spam.");}
    catch(e){setError(e instanceof Error?e.message:"Opnieuw versturen is niet gelukt.")}
    finally{setResending(false)}
  }
  async function google(){
    if(!supabase){setError("De verbinding met Supabase ontbreekt.");return}
    setError("");
    const {error}=await supabase.auth.signInWithOAuth({provider:"google",options:{redirectTo}});
    if(error)setError(error.message);
  }
  return <div className="overlay" role="presentation"><motion.section initial={{opacity:0,y:22,scale:.97}} animate={{opacity:1,y:0,scale:1}} transition={{duration:.28}} className="auth-modal" role="dialog" aria-modal="true" aria-label="Mingle account">
    <div className="auth-brand"><Brand/><span className="auth-eyebrow">CONNECT · SHARE · DISCOVER</span></div>
    {mode==="verify"?<div className="verify-panel">
      <div className="verify-icon"><Mail size={31}/></div>
      <h2>Bevestig je e-mailadres</h2>
      <p>Vul de 8-cijferige code in die we naar <strong>{email}</strong> hebben gestuurd.</p>
      <p className="muted">Controleer ook je spamfolder. De code is tijdelijk geldig.</p>
      {success&&<p className="success" role="status">{success}</p>}
      {error&&<p className="error" role="alert">{error}</p>}
      <form onSubmit={verifyCode}><label className="otp-label" htmlFor="mingle-otp">Verificatiecode</label><input id="mingle-otp" className="otp-input" inputMode="numeric" pattern="[0-9]{8}" maxLength={8} autoComplete="one-time-code" placeholder="00000000" value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,"").slice(0,8))} required/><button className="primary wide" disabled={busy||otp.length!==8} type="submit">{busy?"Controleren...":"Account bevestigen"} <ArrowRight size={17}/></button></form>
      <button className="google" disabled={resending} onClick={resend}>{resending?"Versturen...":"Bevestigingsmail opnieuw sturen"}</button>
      <button className="auth-text-button" onClick={()=>changeMode("login")}>Terug naar inloggen</button><button className="auth-text-button" onClick={()=>changeMode("signup")}>Ander e-mailadres gebruiken</button>
    </div>:<>
      <h2>{mode==="login"?"Welkom terug":mode==="signup"?"Maak je account aan":"Wachtwoord herstellen"}</h2>
      <p className="muted">{mode==="login"?"Log in om verder te gaan met Mingle.":mode==="signup"?"Word onderdeel van de community.":"We sturen je een link om je wachtwoord te herstellen."}</p>
      <form onSubmit={submit}>
        {mode==="signup"&&<label>Naam<input required value={name} onChange={e=>setName(e.target.value)} placeholder="Hoe mogen we je noemen?" maxLength={60}/></label>}
        <label>E-mailadres<input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="jij@voorbeeld.nl"/></label>
        {mode!=="reset"&&<label>Wachtwoord<div className="password-field"><input type={showPassword?"text":"password"} minLength={6} required autoComplete={mode==="signup"?"new-password":"current-password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Minimaal 6 tekens"/><button type="button" onClick={()=>setShowPassword(!showPassword)} aria-label={showPassword?"Verberg wachtwoord":"Toon wachtwoord"}>{showPassword?"Verberg":"Toon"}</button></div></label>}
        {error&&<p className="error" role="alert">{error}</p>}
        {success&&<p className="success" role="status">{success}</p>}
        <button disabled={busy} className="primary wide" type="submit">{busy?"Even wachten...":mode==="login"?"Inloggen":mode==="signup"?"Account aanmaken":"Herstellink versturen"} <ArrowRight size={17}/></button>
      </form>
      {mode!=="reset"&&<><div className="auth-divider"><span>of</span></div><button className="google" disabled={busy} onClick={google}>Doorgaan met Google</button></>}
      <div className="auth-links">{mode==="login"?<><button onClick={()=>changeMode("signup")}>Nog geen account? Registreren</button><button onClick={()=>changeMode("reset")}>Wachtwoord vergeten?</button></>:<button onClick={()=>changeMode("login")}>Terug naar inloggen</button>}</div>
    </>}
  </motion.section></div>
}
export default function App(){const [theme,setTheme]=useState<Theme>(()=>(localStorage.getItem("mingle-theme") as Theme)||"dark");const [session,setSession]=useState<Session|null>(null);const [auth,setAuth]=useState(true);const [sessionChecked,setSessionChecked]=useState(false);const [isAdmin,setIsAdmin]=useState(false);const [page,setPage]=useState("Home");const [tab,setTab]=useState("For you");const [composer,setComposer]=useState("");const [posts,setPosts]=useState<{id:string;body:string;name:string;handle:string;created_at:string;likes:number}[]>([]);const [notice,setNotice]=useState("");
useEffect(()=>{const media=window.matchMedia("(prefers-color-scheme: dark)");const update=()=>document.documentElement.dataset.theme=theme==="system"?(media.matches?"dark":"light"):theme;update();media.addEventListener("change",update);localStorage.setItem("mingle-theme",theme);return()=>media.removeEventListener("change",update)},[theme]);
useEffect(()=>{if(!supabase){setSessionChecked(true);setAuth(true);return}supabase.auth.getSession().then(({data})=>{setSession(data.session);setSessionChecked(true);if(!data.session)setAuth(true)}).catch(()=>{setSessionChecked(true);setAuth(true)});const {data}=supabase.auth.onAuthStateChange((_event,s)=>{setSession(s);if(s)setAuth(false)});return()=>data.subscription.unsubscribe()},[]);
useEffect(()=>{if(!supabase||!session){setIsAdmin(false);return}supabase.from("profiles").select("role").eq("id",session.user.id).single().then(({data})=>setIsAdmin(data?.role==="admin"))},[session]);
useEffect(()=>{if(!supabase||!session)return;const client=supabase;async function load(){const {data,error}=await client.from("posts").select("id,body,created_at,profiles(display_name,username)").order("created_at",{ascending:false}).limit(30);if(error){setNotice("Feed unavailable: "+error.message);return}setPosts((data||[]).map((p:any)=>({id:p.id,body:p.body,created_at:p.created_at,name:p.profiles?.display_name||"Member",handle:p.profiles?.username||"member",likes:0})))}void load();const channel=client.channel("feed-changes").on("postgres_changes",{event:"INSERT",schema:"public",table:"posts"},()=>{void load()}).subscribe();return()=>{void client.removeChannel(channel)}},[session]);
async function publish(){if(!session||!supabase){setAuth(true);return}if(!composer.trim())return;const {error}=await supabase.from("posts").insert({author_id:session.user.id,body:composer.trim()});if(error)setNotice(error.message);else{setComposer("");setNotice("Post published");const {data}=await supabase.from("posts").select("id,body,created_at,profiles(display_name,username)").order("created_at",{ascending:false}).limit(30);setPosts((data||[]).map((p:any)=>({id:p.id,body:p.body,created_at:p.created_at,name:p.profiles?.display_name||"Member",handle:p.profiles?.username||"member",likes:0})))}} 
return <div className="app"><aside className="sidebar"><Brand/><nav aria-label="Main navigation">{navigation.map(({label,icon:Icon})=><button key={label} onClick={()=>setPage(label)} className={page===label?"nav-item active":"nav-item"}><Icon size={21}/><span>{label}</span></button>)}</nav><button className="primary post-button" onClick={()=>{setPage("Home");document.getElementById("composer")?.focus()}}>Post <ArrowRight size={18}/></button><div className="sidebar-bottom">{session?<button className="account" onClick={()=>supabase?.auth.signOut()}><span className="avatar">{session.user.email?.[0]?.toUpperCase()}</span><span className="account-text">{session.user.email}{isAdmin&&<span className="mini-badges"><span className="badge-verified" title="Verified" aria-label="Verified"><BadgeCheck size={17} strokeWidth={2.6}/></span><span className="badge-official" title="Official" aria-label="Official"><Star size={15} fill="currentColor" strokeWidth={1.8}/></span><span className="badge-premium" title="Premium" aria-label="Premium"><Gem size={16} strokeWidth={2.4}/></span></span>}</span><LogOut size={16}/></button>:<button className="account" onClick={()=>setAuth(true)}><span className="avatar">?</span><span>Sign in / Join</span></button>}</div></aside><main className="main"><header className="topbar"><div><h1>{page}</h1><p>{page==="Home"?"Your world, your conversations":"Mingle • "+page}</p></div><button className="icon-button" aria-label="Search" onClick={()=>setPage("Explore")}><Search size={21}/></button></header>{page==="Home"?<><div className="tabs">{["For you","Following","Trending","Latest"].map(t=><button key={t} className={tab===t?"tab selected":"tab"} onClick={()=>setTab(t)}>{t}</button>)}</div><div className="composer"><span className="avatar purple">{session?.user.email?.[0]?.toUpperCase()||"M"}</span><div className="compose-area"><textarea id="composer" maxLength={500} value={composer} onChange={e=>setComposer(e.target.value)} placeholder={session?"What's happening?":"Sign in to share what's happening..."}/><div className="compose-bottom"><div className="compose-icons"><Image size={19}/><span>Everyone can reply</span></div><div className="compose-actions"><span>{composer.length}/500</span><button className="primary" onClick={publish} disabled={!composer.trim()}>Post</button></div></div></div></div>{notice&&<div className="notice" role="status">{notice}<button onClick={()=>setNotice("")}>×</button></div>}{posts.length?posts.map(p=><article className="feed-post" key={p.id}><span className="avatar">{p.name[0]?.toUpperCase()}</span><div className="post-content"><div className="post-meta"><strong>{p.name}</strong><span>@{p.handle} · {new Date(p.created_at).toLocaleDateString()}</span><MoreHorizontal size={18}/></div><p>{p.body}</p><div className="post-actions"><span><Heart size={18}/> {p.likes}</span><span><MessageCircle size={18}/></span><span><Repeat2 size={18}/></span><span><Bookmark size={18}/></span></div></div></article>):<div className="empty"><div className="empty-icon"><MessageCircle size={30}/></div><h2>{session?"Your feed starts here":"Welcome to Mingle"}</h2><p>{session?"Be the first to share something.":"Join the conversation. Real accounts, real connections, and a space for your ideas."}</p>{!session&&<button className="primary" onClick={()=>setAuth(true)}>Get started <ArrowRight size={17}/></button>}</div>}</>:page==="Settings"?<section className="settings"><h2>Appearance</h2><p className="muted">Choose how Mingle looks on your device.</p><div className="theme-row">{([["dark",Moon],["light",Sun],["system",Monitor]] as const).map(([t,Icon])=><button className={theme===t?"theme-choice chosen":"theme-choice"} key={t} onClick={()=>setTheme(t)}><Icon size={19}/>{t}</button>)}</div><h2>Account</h2>{session?<><p className="muted">{session.user.email}</p><button className="secondary" onClick={()=>supabase?.auth.signOut()}>Sign out</button></>:<button className="primary" onClick={()=>setAuth(true)}>Sign in</button>}<p className="muted">More security and profile settings will be added in later phases.</p></section>:<div className="empty"><div className="empty-icon">{page==="Messages"?<Mail size={30}/>:page==="Communities"?<Users size={30}/>:<Compass size={30}/>}</div><h2>{page} is coming next</h2><p>We're building this feature in a later development phase. The navigation and design are ready.</p></div>}</main><aside className="rightbar"><div className="searchbox"><Search size={19}/><span>Search Mingle</span></div><section className="side-card"><div className="side-title"><ShieldCheck size={19}/><strong>Welcome to Mingle</strong></div><p>A new space to connect, share and discover.</p><button className="primary wide" onClick={()=>session?setPage("Home"):setAuth(true)}>{session?"Explore your feed":"Join Mingle"}</button></section><section className="side-card"><h3>What's happening</h3><p className="muted">Trending topics will appear here once the discovery system is ready.</p></section><footer>About · Privacy · Terms<br/>© {new Date().getFullYear()} Mingle</footer></aside>{auth&&sessionChecked&&!session&&<Auth onClose={()=>setAuth(false)}/>}</div>}
