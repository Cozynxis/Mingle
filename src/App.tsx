import { Explore } from "./Explore";
import { useEffect, useState, type FormEvent } from "react";
import { motion } from "motion/react";
import { Bell, Bookmark, Compass, Home, Mail, Search, Settings, ShieldCheck, Users, Moon, Sun, Monitor, LogOut, Image, ArrowRight, BadgeCheck, Gem, Star } from "lucide-react";
import { supabase } from "./lib/supabase";
import type { Session } from "@supabase/supabase-js";
import { ProfileEditor, type MingleProfile } from "./ProfileEditor";
import { Social, ProfileStats, FollowButton } from "./Social";
import { UserRound, UserPen, ChevronUp } from "lucide-react";
type Theme = "dark" | "light" | "system";
const navigation = [{label:"Home",icon:Home},{label:"Explore",icon:Compass},{label:"Notifications",icon:Bell},{label:"Messages",icon:Mail},{label:"Communities",icon:Users},{label:"Bookmarks",icon:Bookmark}];
function Brand(){return <div className="brand"><span className="brand-icon" aria-label="Mingle logo"><svg viewBox="0 0 64 64" aria-hidden="true" width="38" height="38"><rect x="0" y="0" width="64" height="64" rx="17" fill="#7385ff"/><path d="M12 44V24c0-9 12-9 12 0v20-20c0-9 12-9 12 0v20-20c0-9 12-9 12 0v20" fill="none" stroke="#fff" strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round"/></svg></span><strong>mingle<span className="brand-dot">.</span></strong></div>}
function Auth({onClose,recoveryMode=false,onRecoveryComplete}:{onClose:()=>void;recoveryMode?:boolean;onRecoveryComplete?:()=>void}) {
  const [mode,setMode]=useState<"login"|"signup"|"reset"|"verify"|"newPassword">(recoveryMode?"newPassword":"login");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [name,setName]=useState("");
  const [error,setError]=useState("");
  const [success,setSuccess]=useState("");
  const [busy,setBusy]=useState(false);
  const [showPassword,setShowPassword]=useState(false);
  const [resending,setResending]=useState(false);
  const [otp,setOtp]=useState("");
  const [confirmPassword,setConfirmPassword]=useState("");
  const redirectTo=window.location.origin+"/";
  function changeMode(next:typeof mode){setMode(next);setError("");setSuccess("")}
  async function submit(e:FormEvent){
    e.preventDefault();setError("");setSuccess("");
    if(!supabase){setError("De verbinding met Supabase ontbreekt.");return}
    setBusy(true);
    try {
      if(mode==="newPassword"){
        if(password.length<8)throw new Error("Gebruik minimaal 8 tekens voor je nieuwe wachtwoord.");
        if(password!==confirmPassword)throw new Error("De wachtwoorden komen niet overeen.");
        const {error}=await supabase.auth.updateUser({password});
        if(error)throw error;
        setPassword("");setConfirmPassword("");
        setSuccess("Je wachtwoord is gewijzigd. Je kunt nu met je nieuwe wachtwoord inloggen.");
        await supabase.auth.signOut({ scope: "local" });
        onRecoveryComplete?.();
      }else if(mode==="reset"){
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
    {mode==="newPassword"?<div className="verify-panel"><div className="verify-icon"><ShieldCheck size={31}/></div><h2>Nieuw wachtwoord instellen</h2><p className="muted">Kies een nieuw wachtwoord voor je Mingle-account.</p>{error&&<p className="error" role="alert">{error}</p>}{success&&<p className="success" role="status">{success}</p>}{!success&&<form onSubmit={submit}><label>Nieuw wachtwoord<input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={e=>setPassword(e.target.value)}/></label><label>Herhaal nieuw wachtwoord<input type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)}/></label><button className="primary wide" type="submit" disabled={busy}>{busy?"Opslaan...":"Wachtwoord wijzigen"} <ArrowRight size={17}/></button></form>}{success&&<button className="primary wide" onClick={()=>{changeMode("login");onClose()}}>Terug naar inloggen</button>}</div>:mode==="verify"?<div className="verify-panel">
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
export default function App(){const [theme,setTheme]=useState<Theme>(()=>(localStorage.getItem("mingle-theme") as Theme)||"dark");const [session,setSession]=useState<Session|null>(null);const [auth,setAuth]=useState(true);const [recoveryMode,setRecoveryMode]=useState(false);const [sessionChecked,setSessionChecked]=useState(false);const [isAdmin,setIsAdmin]=useState(false);const [page,setPage]=useState("Home");const [tab,setTab]=useState("For you");const [composer,setComposer]=useState("");const [notice,setNotice]=useState("");const [profile,setProfile]=useState<MingleProfile|null>(null);const [profileLoaded,setProfileLoaded]=useState(false);const [editingProfile,setEditingProfile]=useState(false);const [accountMenu,setAccountMenu]=useState(false);const [viewProfileId,setViewProfileId]=useState<string|null>(null);const [viewedProfile,setViewedProfile]=useState<MingleProfile|null>(null);const [feedRefresh,setFeedRefresh]=useState(0);
useEffect(()=>{const media=window.matchMedia("(prefers-color-scheme: dark)");const update=()=>document.documentElement.dataset.theme=theme==="system"?(media.matches?"dark":"light"):theme;update();media.addEventListener("change",update);localStorage.setItem("mingle-theme",theme);return()=>media.removeEventListener("change",update)},[theme]);
useEffect(()=>{if(!supabase){setSessionChecked(true);setAuth(true);return}const hash=new URLSearchParams(window.location.hash.slice(1));const query=new URLSearchParams(window.location.search);const recoveryLink=hash.get("type")==="recovery"||query.get("type")==="recovery"||!!query.get("token_hash")&&query.get("type")==="recovery";if(recoveryLink){setRecoveryMode(true);setAuth(true)}supabase.auth.getSession().then(({data})=>{setSession(data.session);setSessionChecked(true);if(!data.session)setAuth(true)}).catch(()=>{setSessionChecked(true);setAuth(true)});const {data}=supabase.auth.onAuthStateChange((event,s)=>{setSession(s);if(event==="PASSWORD_RECOVERY"){setRecoveryMode(true);setAuth(true)}else if(s&&!recoveryLink){setAuth(false)}});return()=>data.subscription.unsubscribe()},[]);
useEffect(()=>{if(!supabase||!session){setProfile(null);setProfileLoaded(false);setAccountMenu(false);return}const client=supabase;let active=true;setProfileLoaded(false);(async()=>{let result=await client.from("profiles").select("id,username,display_name,bio,avatar_url,banner_url,is_private,onboarding_completed").eq("id",session.user.id).single();if(result.error?.message.includes("onboarding_completed")){const fallback=await client.from("profiles").select("id,username,display_name,bio,avatar_url,banner_url,is_private").eq("id",session.user.id).single();if(!active)return;if(fallback.error){setNotice("Profiel laden mislukt: "+fallback.error.message);setProfile(null)}else{setProfile({...fallback.data,onboarding_completed:true} as MingleProfile);setNotice("Database-update ontbreekt: voer de nieuwe profiel-SQL uit in Supabase om het welkomstscherm en opslaan te activeren.")}setProfileLoaded(true);return}if(!active)return;if(result.error){setNotice("Profiel laden mislukt: "+result.error.message);setProfile(null)}else setProfile(result.data as MingleProfile);setProfileLoaded(true)})();return()=>{active=false}},[session?.user.id]);
useEffect(()=>{if(!supabase||!viewProfileId||viewProfileId===session?.user.id){setViewedProfile(null);return}let active=true;supabase.from("profiles").select("id,username,display_name,bio,avatar_url,banner_url,is_private,onboarding_completed").eq("id",viewProfileId).single().then(({data})=>{if(active)setViewedProfile(data as MingleProfile|null)});return()=>{active=false}},[viewProfileId,session?.user.id]);
useEffect(()=>{if(!supabase||!session){setIsAdmin(false);return}supabase.from("profiles").select("role").eq("id",session.user.id).single().then(({data})=>setIsAdmin(data?.role==="admin"))},[session]);
async function publish(){if(!session||!supabase){setAuth(true);return}if(!composer.trim())return;const {error}=await supabase.from("posts").insert({author_id:session.user.id,body:composer.trim()});if(error)setNotice(error.message);else{setComposer("");setFeedRefresh(x=>x+1);setNotice("Post published")}}
return <div className="app"><aside className="sidebar"><Brand/><nav aria-label="Main navigation">{navigation.map(({label,icon:Icon})=><button key={label} onClick={()=>setPage(label)} className={page===label?"nav-item active":"nav-item"}><Icon size={21}/><span>{label}</span></button>)}</nav><button className="primary post-button" onClick={()=>{setPage("Home");document.getElementById("composer")?.focus()}}>Post <ArrowRight size={18}/></button><div className="sidebar-bottom">{session?<div className="account-menu-wrap">{accountMenu&&<div className="account-menu" role="menu"><button onClick={()=>{setViewProfileId(null);setPage("Profile");setAccountMenu(false)}}><UserRound size={17}/> Mijn profiel</button><button onClick={()=>{setEditingProfile(true);setAccountMenu(false)}}><UserPen size={17}/> Profiel bewerken</button><button onClick={()=>{setPage("Settings");setAccountMenu(false)}}><Settings size={17}/> Instellingen</button><hr/><button className="menu-danger" onClick={()=>{setAccountMenu(false);void supabase?.auth.signOut({ scope: "local" })}}><LogOut size={17}/> Uitloggen</button></div>}<button className="account" aria-expanded={accountMenu} aria-label="Accountmenu openen" onClick={()=>setAccountMenu(v=>!v)}><span className="avatar">{profile?.avatar_url?<img className="account-avatar-img" src={profile.avatar_url} alt="Profielfoto"/>:session.user.email?.[0]?.toUpperCase()}</span><span className="account-text">{profile?.display_name||session.user.email}{isAdmin&&<span className="mini-badges"><span className="badge-verified" title="Verified" aria-label="Verified"><BadgeCheck size={17} strokeWidth={2.6}/></span><span className="badge-official" title="Official" aria-label="Official"><Star size={15} fill="currentColor" strokeWidth={1.8}/></span><span className="badge-premium" title="Premium" aria-label="Premium"><Gem size={16} strokeWidth={2.4}/></span></span>}</span><ChevronUp size={16}/></button></div>:<button className="account" onClick={()=>setAuth(true)}><span className="avatar">?</span><span>Sign in / Join</span></button>}</div></aside><main className="main"><header className="topbar"><div><h1>{page}</h1><p>{page==="Home"?"Your world, your conversations":"Mingle • "+page}</p></div><button className="icon-button" aria-label="Search" onClick={()=>setPage("Explore")}><Search size={21}/></button></header>{page==="Home"?<><div className="tabs">{["For you","Following","Trending","Latest"].map(t=><button key={t} className={tab===t?"tab selected":"tab"} onClick={()=>setTab(t)}>{t}</button>)}</div><div className="composer"><span className="avatar purple">{session?.user.email?.[0]?.toUpperCase()||"M"}</span><div className="compose-area"><textarea id="composer" maxLength={500} value={composer} onChange={e=>setComposer(e.target.value)} placeholder={session?"What's happening?":"Sign in to share what's happening..."}/><div className="compose-bottom"><div className="compose-icons"><Image size={19}/><span>Everyone can reply</span></div><div className="compose-actions"><span>{composer.length}/500</span><button className="primary" onClick={publish} disabled={!composer.trim()}>Post</button></div></div></div></div>{notice&&<div className="notice" role="status">{notice}<button onClick={()=>setNotice("")}>×</button></div>}{session?<Social key={feedRefresh+"-"+tab} session={session} mode="feed" followingOnly={tab==="Following"} onOpenProfile={id=>{setViewProfileId(id);setPage("Profile")}}/>:<div className="empty">Log in om de feed te bekijken.</div>}</>:page==="Explore"&&session?<Explore session={session} onOpenProfile={id=>{setViewProfileId(id);setPage("Profile")}}/>:page==="Profile"&&session?<section className="profile-page"><div className="profile-page-banner" style={{backgroundImage:(viewProfileId&&viewProfileId!==session.user.id?viewedProfile:profile)?.banner_url?`url("${(viewProfileId&&viewProfileId!==session.user.id?viewedProfile:profile)?.banner_url}")`:undefined}}/><div className="profile-page-body"><div className="profile-page-head"><div className="profile-page-avatar">{(viewProfileId&&viewProfileId!==session.user.id?viewedProfile:profile)?.avatar_url?<img src={(viewProfileId&&viewProfileId!==session.user.id?viewedProfile:profile)?.avatar_url ?? undefined} alt="Profielfoto"/>:<UserRound size={35}/>}</div>{(!viewProfileId||viewProfileId===session.user.id)&&<button className="secondary" onClick={()=>setEditingProfile(true)}>Profiel bewerken</button>}{viewProfileId&&viewProfileId!==session.user.id&&<FollowButton key={viewProfileId} session={session} userId={viewProfileId}/>}</div><h2>{(viewProfileId&&viewProfileId!==session.user.id?viewedProfile:profile)?.display_name||"Mingle member"}</h2><span className="profile-page-handle">@{(viewProfileId&&viewProfileId!==session.user.id?viewedProfile:profile)?.username||"member"}</span><p>{(viewProfileId&&viewProfileId!==session.user.id?viewedProfile:profile)?.bio||"Nog geen bio toegevoegd."}</p><span className="profile-muted">{(viewProfileId&&viewProfileId!==session.user.id?viewedProfile:profile)?.is_private?"Privéaccount":"Openbaar account"}</span><ProfileStats session={session} userId={viewProfileId||session.user.id}/></div><Social session={session} mode="profile" profileId={viewProfileId||session.user.id} onOpenProfile={id=>setViewProfileId(id)}/></section>:page==="Bookmarks"&&session?<Social session={session} mode="bookmarks" onOpenProfile={id=>{setViewProfileId(id);setPage("Profile")}}/>:page==="Settings"?<section className="settings"><h2>Appearance</h2><p className="muted">Choose how Mingle looks on your device.</p><div className="theme-row">{([["dark",Moon],["light",Sun],["system",Monitor]] as const).map(([t,Icon])=><button className={theme===t?"theme-choice chosen":"theme-choice"} key={t} onClick={()=>setTheme(t)}><Icon size={19}/>{t}</button>)}</div><h2>Account</h2>{session?<><p className="muted">{session.user.email}</p><button className="secondary" onClick={()=>supabase?.auth.signOut({ scope: "local" })}>Sign out</button></>:<button className="primary" onClick={()=>setAuth(true)}>Sign in</button>}<p className="muted">More security and profile settings will be added in later phases.</p></section>:<div className="empty"><div className="empty-icon">{page==="Messages"?<Mail size={30}/>:page==="Communities"?<Users size={30}/>:<Compass size={30}/>}</div><h2>{page} is coming next</h2><p>We're building this feature in a later development phase. The navigation and design are ready.</p></div>}</main><aside className="rightbar"><div className="searchbox"><Search size={19}/><span>Search Mingle</span></div><section className="side-card"><div className="side-title"><ShieldCheck size={19}/><strong>Welcome to Mingle</strong></div><p>A new space to connect, share and discover.</p><button className="primary wide" onClick={()=>session?setPage("Home"):setAuth(true)}>{session?"Explore your feed":"Join Mingle"}</button></section><section className="side-card"><h3>What's happening</h3><p className="muted">Trending topics will appear here once the discovery system is ready.</p></section><footer>About · Privacy · Terms<br/>© {new Date().getFullYear()} Mingle</footer></aside>{session&&profileLoaded&&profile&&!profile.onboarding_completed&&!recoveryMode&&<ProfileEditor key={"welcome-"+session.user.id} session={session} initial={profile} onboarding onSaved={p=>{setProfile(p);setPage("Profile")}}/>}{session&&profileLoaded&&profile&&profile.onboarding_completed&&editingProfile&&!recoveryMode&&<ProfileEditor key={"edit-"+session.user.id} session={session} initial={profile} onSaved={p=>{setProfile(p);setEditingProfile(false)}} onCancel={()=>setEditingProfile(false)}/>}{auth&&sessionChecked&&(!session||recoveryMode)&&<Auth recoveryMode={recoveryMode} onRecoveryComplete={()=>{setRecoveryMode(false);window.history.replaceState(null,"",window.location.pathname)}} onClose={()=>setAuth(false)}/>}</div>}
