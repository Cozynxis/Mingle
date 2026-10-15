import { BadgePreference } from "./Badges";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { Camera, CheckCircle2, ChevronLeft, ChevronRight, ImagePlus, Lock, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { supabase } from "./lib/supabase";
import type { Session } from "@supabase/supabase-js";
import "./profile.css";

export type MingleProfile = {
  id: string; username: string; display_name: string; bio: string;
  avatar_url: string | null; banner_url: string | null; is_private: boolean;
  onboarding_completed: boolean;
};
export const emptyProfile = (session: Session): MingleProfile => ({
  id: session.user.id,
  username: "user_" + session.user.id.replace(/-/g, "").slice(0, 25),
  display_name: String(session.user.user_metadata?.display_name || session.user.email?.split("@")[0] || "Mingle member"),
  bio: "", avatar_url: null, banner_url: null, is_private: false, onboarding_completed: false
});

async function uploadProfileImage(userId: string, kind: "avatar" | "banner", file: File) {
  if (!supabase) throw new Error("Supabase is niet verbonden.");
  if (!["image/jpeg","image/png","image/webp","image/gif"].includes(file.type)) throw new Error("Gebruik een JPG, PNG, WebP of GIF.");
  if (file.size > 5 * 1024 * 1024) throw new Error("Afbeeldingen mogen maximaal 5 MB zijn.");
  const ext = ({ "image/jpeg":"jpg", "image/png":"png", "image/webp":"webp", "image/gif":"gif" } as Record<string,string>)[file.type];
  const path = userId + "/" + kind + "-" + crypto.randomUUID() + "." + ext;
  const { error } = await supabase.storage.from("profile-media").upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return supabase.storage.from("profile-media").getPublicUrl(path).data.publicUrl;
}

export function ProfileEditor({ session, initial, onSaved, onCancel, onboarding = false }: {
  session: Session; initial: MingleProfile; onSaved: (profile: MingleProfile) => void;
  onCancel?: () => void; onboarding?: boolean;
}) {
  const [draft,setDraft] = useState<MingleProfile>({...initial});
  const [avatar,setAvatar] = useState<File|null>(null);
  const [banner,setBanner] = useState<File|null>(null);
  const [avatarPreview,setAvatarPreview] = useState<string|null>(null);
  const [bannerPreview,setBannerPreview] = useState<string|null>(null);
  const [step,setStep] = useState(0);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  function selectImage(e: ChangeEvent<HTMLInputElement>, kind: "avatar"|"banner") {
    const file = e.target.files?.[0]; if (!file) return;
    if (!["image/jpeg","image/png","image/webp","image/gif"].includes(file.type) || file.size > 5*1024*1024) {setError("Kies een JPG, PNG, WebP of GIF van maximaal 5 MB.");return}
    setError("");
    const reader = new FileReader();
    reader.onload = () => { if (kind==="avatar") setAvatarPreview(String(reader.result)); else setBannerPreview(String(reader.result)); };
    reader.readAsDataURL(file);
    if (kind==="avatar") setAvatar(file); else setBanner(file);
  }
  async function save(e: FormEvent) {
    e.preventDefault(); setError("");
    if (onboarding && step < 2) { setStep(step+1);return }
    if (!supabase) {setError("Geen verbinding met Supabase.");return}
    if (!/^[a-z0-9_]{3,30}$/.test(draft.username)) {setError("Gebruikersnaam: 3-30 kleine letters, cijfers of underscores.");setStep(0);return}
    if (!draft.display_name.trim() || draft.display_name.trim().length>60) {setError("Vul een naam in van maximaal 60 tekens.");setStep(0);return}
    setBusy(true);
    try {
      const next={...draft, display_name:draft.display_name.trim(), bio:draft.bio.trim(), onboarding_completed:true};
      if (avatar) next.avatar_url=await uploadProfileImage(session.user.id,"avatar",avatar);
      if (banner) next.banner_url=await uploadProfileImage(session.user.id,"banner",banner);
      const {data,error:saveError}=await supabase.from("profiles").update({
        username:next.username,display_name:next.display_name,bio:next.bio,
        avatar_url:next.avatar_url,banner_url:next.banner_url,is_private:next.is_private,
        onboarding_completed:true
      }).eq("id",session.user.id).select("id,username,display_name,bio,avatar_url,banner_url,is_private,onboarding_completed").single();
      if (saveError) throw saveError;
      if (!data) throw new Error("Profiel niet opgeslagen. Probeer opnieuw.");
      onSaved(data as MingleProfile);
    } catch (e) {
      const msg=e instanceof Error?e.message:"Opslaan mislukt.";
      setError(/profiles_username_key|duplicate key/i.test(msg)?"Deze gebruikersnaam is al in gebruik. Kies een andere.":msg);
    } finally {setBusy(false)}
  }
  return <div className="profile-overlay"><section className="profile-editor" role="dialog" aria-modal="true" aria-label={onboarding?"Welkom bij Mingle":"Profiel bewerken"}>
    <div className="profile-editor-top"><span className="profile-kicker"><Sparkles size={17}/> {onboarding?"WELCOME TO MINGLE":"YOUR MINGLE PROFILE"}</span>{!onboarding&&onCancel&&<button type="button" className="profile-close" onClick={onCancel}>Sluiten ×</button>}</div>
    <h2>{onboarding?["Maak Mingle helemaal van jou","Vertel iets over jezelf","Jouw privacy, jouw keuze"][step]:"Bewerk je profiel"}</h2>
    <p className="profile-intro">{onboarding?"Je bent er bijna! Maak je profiel af en ontdek Mingle.":"Werk je profiel bij. Je wijzigingen worden opgeslagen in je account."}</p>
    {onboarding&&<div className="profile-progress">{[0,1,2].map(n=><span key={n} className={n<=step?"active":""}/>)}</div>}
    <form onSubmit={save}>
      {(!onboarding||step===0)&&<div className="profile-form-section">
        <div className="profile-banner-preview" style={{backgroundImage:(bannerPreview||draft.banner_url)?`url("${bannerPreview||draft.banner_url}")`:undefined}}>
          <label className="profile-upload banner-upload"><ImagePlus size={17}/> Banner kiezen<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={e=>selectImage(e,"banner")}/></label>
        </div>
        <div className="profile-avatar-line"><div className="profile-avatar-preview" style={{backgroundImage:(avatarPreview||draft.avatar_url)?`url("${avatarPreview||draft.avatar_url}")`:undefined}}>{!(avatarPreview||draft.avatar_url)&&<UserRound size={32}/>}</div><label className="profile-upload"><Camera size={17}/> Profielfoto<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={e=>selectImage(e,"avatar")}/></label><small>JPG, PNG, WebP of GIF · max. 5 MB</small></div>
        <label>Weergavenaam<input required maxLength={60} value={draft.display_name} onChange={e=>setDraft(p=>({...p,display_name:e.target.value}))} placeholder="Jouw naam"/></label>
        <label>Gebruikersnaam <span className="profile-muted">@{draft.username}</span><input required minLength={3} maxLength={30} pattern="[a-z0-9_]{3,30}" value={draft.username} onChange={e=>setDraft(p=>({...p,username:e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,"")}))} placeholder="jouw_gebruikersnaam"/></label>
      </div>}
      {(!onboarding||step===1)&&<div className="profile-form-section"><label>Bio<textarea maxLength={160} rows={5} value={draft.bio} onChange={e=>setDraft(p=>({...p,bio:e.target.value}))} placeholder="Wie ben jij? Wat wil je delen op Mingle?"/></label><span className="profile-muted">{draft.bio.length}/160 tekens</span><div className="profile-tip"><Sparkles size={20}/> Een leuke bio helpt anderen om je te leren kennen.</div></div>}
      {(!onboarding||step===2)&&<div className="profile-form-section"><div className="profile-privacy"><div><strong><Lock size={19}/> Privéaccount</strong><p>Alleen jij en later goedgekeurde volgers kunnen je privéprofiel en posts zien. Sommige accountgegevens blijven zichtbaar.</p></div><input type="checkbox" checked={draft.is_private} onChange={e=>setDraft(p=>({...p,is_private:e.target.checked}))} aria-label="Privéaccount"/></div><div className="profile-tip"><ShieldCheck size={20}/> Je kunt dit later altijd aanpassen via Profiel bewerken.</div></div>}
      {!onboarding&&<div className="profile-form-section"><h3>Badges</h3><p className="profile-muted">Kies welke toegekende badge naast je naam wordt weergegeven.</p><BadgePreference userId={session.user.id}/></div>}
      {error&&<p className="profile-error" role="alert">{error}</p>}
      <div className="profile-editor-actions">{onboarding&&step>0&&<button type="button" className="profile-back" onClick={()=>{setError("");setStep(step-1)}}><ChevronLeft size={18}/> Vorige</button>}<button type="submit" className="profile-next" disabled={busy}>{busy?"Opslaan...":onboarding&&step<2?"Volgende":"Profiel opslaan"}{!busy&&(onboarding&&step===2?<CheckCircle2 size={18}/>:<ChevronRight size={18}/>)}</button></div>
    </form>
  </section></div>;
}
