import {friendlyMuteError} from "./MuteNotice";
import {NameBadge} from "./Badges";
import { PostExtras } from "./PostExtras";
import { HighlightedText, HashtagComposer, countHashtags } from "./Hashtags";
import { useCallback, useEffect, useState } from "react";
import { Bookmark, Heart, MessageCircle, Repeat2, Images, X, UserPlus, UserMinus, MoreHorizontal, Pencil, Trash2, Eye } from "lucide-react";
import { supabase } from "./lib/supabase";
import type { Session } from "@supabase/supabase-js";
import "./social.css";
export type SocialPost={id:string;author_id:string;body:string;image_url?:string|null;created_at:string;profiles:{display_name:string;username:string;avatar_url:string|null}|null};
type Engagement={views:number;likes:number;reposts:number;replies:number;liked:boolean;reposted:boolean;bookmarked:boolean};
type Reply={id:string;author_id:string;parent_id:string|null;body:string;created_at:string;profiles:{display_name:string;username:string;avatar_url:string|null}|null};
const stamp=(s:string)=>new Date(s).toLocaleString("nl-NL",{dateStyle:"medium",timeStyle:"short"});
const SOCIAL_TABLES=["follows","post_likes","post_reposts","post_replies","reply_likes","posts"] as const;
function useSocialUpdates(refresh:()=>void){
 useEffect(()=>{
  if(!supabase)return;
  const client=supabase;
  let pending=false;
  const notify=()=>{if(pending)return;pending=true;window.setTimeout(()=>{pending=false;if(!document.hidden)refresh()},250)};
  const channel=client.channel("mingle-social-"+crypto.randomUUID());
  for(const table of SOCIAL_TABLES)channel.on("postgres_changes",{event:"*",schema:"public",table},notify);
  channel.subscribe();
  const onVisible=()=>{if(!document.hidden)refresh()};
  document.addEventListener("visibilitychange",onVisible);
  window.addEventListener("focus",onVisible);
  return()=>{document.removeEventListener("visibilitychange",onVisible);window.removeEventListener("focus",onVisible);void client.removeChannel(channel)};
 },[refresh]);
}
export function Social({session,mode="feed",profileId,followingOnly=false,searchQuery="",targetPostId,onTargetHandled,onOpenProfile}:{session:Session;mode?:"feed"|"profile"|"bookmarks";profileId?:string;followingOnly?:boolean;searchQuery?:string;targetPostId?:string|null;onTargetHandled?:()=>void;onOpenProfile?:(id:string)=>void}){
 const [menuPost,setMenuPost]=useState<string|null>(null),[editing,setEditing]=useState<SocialPost|null>(null),[editBody,setEditBody]=useState(""),[saving,setSaving]=useState(false),[confirmDelete,setConfirmDelete]=useState<SocialPost|null>(null),[pendingActions,setPendingActions]=useState<string[]>([]),[replyLikes,setReplyLikes]=useState<Record<string,{count:number;liked:boolean}>>({}),[replyTo,setReplyTo]=useState<Reply|null>(null),[posts,setPosts]=useState<SocialPost[]>([]),[engagement,setEngagement]=useState<Record<string,Engagement>>({}),[selected,setSelected]=useState<SocialPost|null>(null),[replies,setReplies]=useState<Reply[]>([]),[reply,setReply]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 const [profileTab,setProfileTab]=useState<"posts"|"media"|"reposts">("posts");
 const [repostDates,setRepostDates]=useState<Record<string,string>>({});
 const load=useCallback(async()=>{if(!supabase)return;const client=supabase;
 const isProfile=mode==="profile"&&Boolean(profileId);
 const repostResult=isProfile&&profileTab==="reposts"?await client.from("post_reposts").select("post_id,created_at").eq("user_id",profileId!).order("created_at",{ascending:false}).limit(500):null;
 if(repostResult?.error){setError(repostResult.error.message);return}
 const repostRows=repostResult?.data||[];
 const repostIds=[...new Set(repostRows.map(x=>x.post_id))];
 setRepostDates(Object.fromEntries(repostRows.map(x=>[x.post_id,x.created_at])));
 const [{data:followData},{data:postsData,error:postsError}]=await Promise.all([
 client.from("follows").select("following_id").eq("follower_id",session.user.id),
 isProfile&&profileTab==="reposts"
  ?(repostIds.length?client.from("posts").select("id,author_id,body,image_url,created_at,profiles!posts_author_id_fkey(display_name,username,avatar_url)").in("id",repostIds).limit(500):Promise.resolve({data:[],error:null}))
  :isProfile
  ?client.from("posts").select("id,author_id,body,image_url,created_at,profiles!posts_author_id_fkey(display_name,username,avatar_url)").eq("author_id",profileId!).order("created_at",{ascending:false}).limit(500)
  :client.from("posts").select("id,author_id,body,image_url,created_at,profiles!posts_author_id_fkey(display_name,username,avatar_url)").order("created_at",{ascending:false}).limit(100)
 ]);
 if(postsError){setError(postsError.message);return}
 const followed=(followData||[]).map((f:any)=>String(f.following_id));
 const all=(postsData||[]) as unknown as SocialPost[];
 const ids=all.map(p=>p.id);
 if(!ids.length){setPosts([]);setEngagement({});return}
 const [likes,reposts,bookmarks,repliesData,views]=await Promise.all([
 client.from("post_likes").select("post_id,user_id").in("post_id",ids),
 client.from("post_reposts").select("post_id,user_id").in("post_id",ids),
 client.from("post_bookmarks").select("post_id").eq("user_id",session.user.id).in("post_id",ids),
 client.from("post_replies").select("post_id").in("post_id",ids),
 client.from("post_views").select("post_id").in("post_id",ids)
 ]);
 const failures=[likes,reposts,bookmarks,repliesData,views].filter(x=>x.error);if(failures.length){setError(failures[0].error!.message);return}
 const map:Record<string,Engagement>={};
 for(const id of ids){const l=(likes.data||[]).filter(x=>x.post_id===id),r=(reposts.data||[]).filter(x=>x.post_id===id);
 map[id]={views:(views.data||[]).filter(x=>x.post_id===id).length,likes:l.length,reposts:r.length,replies:(repliesData.data||[]).filter(x=>x.post_id===id).length,liked:l.some(x=>x.user_id===session.user.id),reposted:r.some(x=>x.user_id===session.user.id),bookmarked:(bookmarks.data||[]).some(x=>x.post_id===id)}}
 setEngagement(map);
 setPosts((mode==="profile"&&profileTab==="reposts"?all.sort((a,b)=>(repostDates[b.id]||repostRows.find(x=>x.post_id===b.id)?.created_at||"").localeCompare(repostDates[a.id]||repostRows.find(x=>x.post_id===a.id)?.created_at||"")):all).filter(p=>(mode==="profile"?(profileTab==="reposts"?repostIds.includes(p.id):p.author_id===profileId&&(profileTab!=="media"||Boolean(p.image_url))):mode==="bookmarks"?map[p.id]?.bookmarked:!followingOnly||p.author_id===session.user.id||followed.includes(p.author_id))&&(!searchQuery.trim()||p.body.toLocaleLowerCase().includes(searchQuery.trim().toLocaleLowerCase()))));
 },[session.user.id,mode,profileId,profileTab,followingOnly,searchQuery]);
 useSocialUpdates(load);
 useEffect(()=>{window.addEventListener("mingle-social-changed",load);return()=>window.removeEventListener("mingle-social-changed",load)},[load]);
 useEffect(()=>{void load();const timer=window.setInterval(()=>{if(!document.hidden)void load()},5000);return()=>window.clearInterval(timer)},[load]);
 useEffect(()=>{if(!targetPostId||!supabase)return;let cancelled=false;const open=async()=>{const {data,error:e}=await supabase!.from("posts").select("id,author_id,body,image_url,created_at,profiles!posts_author_id_fkey(display_name,username,avatar_url)").eq("id",targetPostId).maybeSingle();if(cancelled)return;if(e){setError(friendlyMuteError(e.message));return}if(data){setSelected(data as unknown as SocialPost);onTargetHandled?.()}else{setError("Deze post is niet meer beschikbaar.");onTargetHandled?.()}};void open();return()=>{cancelled=true}},[targetPostId,onTargetHandled]);
 const loadReplies=useCallback(async(postId:string)=>{if(!supabase)return;
 let {data,error:e}=await supabase.from("post_replies").select("id,author_id,parent_id,body,created_at,profiles!post_replies_author_id_fkey(display_name,username,avatar_url)").eq("post_id",postId).order("created_at");
 if(e && /parent_id|schema cache/i.test(e.message)){
  const fallback=await supabase.from("post_replies").select("id,author_id,body,created_at,profiles!post_replies_author_id_fkey(display_name,username,avatar_url)").eq("post_id",postId).order("created_at");
  data=(fallback.data||[]).map(item=>({...item,parent_id:null})) as typeof data;
  e=fallback.error;
 }
 if(e){setError(friendlyMuteError(e.message));return}
 const items=(data||[]) as unknown as Reply[];
 setReplies(items);
 if(!items.length){setReplyLikes({});return}
 const {data:likes,error:likeError}=await supabase.from("reply_likes").select("reply_id,user_id").in("reply_id",items.map(r=>r.id));
 if(likeError){setError(likeError.message);return}
 const map:Record<string,{count:number;liked:boolean}>={};
 for(const item of items){const own=(likes||[]).filter(l=>l.reply_id===item.id);map[item.id]={count:own.length,liked:own.some(l=>l.user_id===session.user.id)}}
 setReplyLikes(map);
 },[session.user.id]);
 const refreshSelected=useCallback(()=>{if(selected)void loadReplies(selected.id)},[selected?.id,loadReplies]);
 useSocialUpdates(refreshSelected);
 useEffect(()=>{if(!selected)return;void loadReplies(selected.id);const timer=window.setInterval(()=>{if(!document.hidden)void loadReplies(selected.id)},5000);return()=>window.clearInterval(timer)},[selected,loadReplies]);
 async function toggleReplyLike(item:Reply){if(!supabase||busy)return;setBusy(true);setError("");
 const exists=replyLikes[item.id]?.liked;
 const {error:e}=exists?await supabase.from("reply_likes").delete().eq("reply_id",item.id).eq("user_id",session.user.id):await supabase.from("reply_likes").upsert({reply_id:item.id,user_id:session.user.id},{onConflict:"reply_id,user_id",ignoreDuplicates:true});
 if(e)setError(friendlyMuteError(e.message));if(selected)await loadReplies(selected.id);setBusy(false)}
 function renderReplies(parentId:string|null,depth=0):React.ReactNode{
  return replies.filter(r=>r.parent_id===parentId||(parentId===null&&r.parent_id&&!replies.some(p=>p.id===r.parent_id))).map(r=><div key={r.id} className="social-reply-thread" style={{marginLeft:Math.min(depth,3)*16}}>
   <div className="social-reply"><button className="social-reply-avatar" aria-label="Profiel bekijken" onClick={()=>{setSelected(null);onOpenProfile?.(r.author_id)}}>{r.profiles?.avatar_url?<img src={r.profiles.avatar_url} alt=""/>:(r.profiles?.display_name||"M")[0]}</button>
   <div className="social-reply-content"><div className="social-reply-meta"><button className="social-reply-author" onClick={()=>{setSelected(null);onOpenProfile?.(r.author_id)}}>{r.profiles?.display_name||"Member"} <NameBadge userId={r.author_id}/> <span>@{r.profiles?.username||"member"}</span></button><small>{stamp(r.created_at)}</small></div><p>{r.body}</p>
   <div className="social-reply-actions"><button disabled={busy} className={replyLikes[r.id]?.liked?"social-active":""} onClick={()=>void toggleReplyLike(r)}><Heart size={14} fill={replyLikes[r.id]?.liked?"currentColor":"none"}/> {replyLikes[r.id]?.count||0}</button><button onClick={()=>{setReplyTo(r);setReply("")}}>Beantwoorden</button></div></div></div>
   {depth<8&&renderReplies(r.id,depth+1)}
  </div>)
 }
 async function toggle(table:"post_likes"|"post_reposts"|"post_bookmarks",p:SocialPost){
  if(!supabase)return;
  const action=table+":"+p.id;
  if(pendingActions.includes(action))return;
  setPendingActions(v=>[...v,action]);setError("");
  const key=table==="post_likes"?"liked":table==="post_reposts"?"reposted":"bookmarked";
  const current=engagement[p.id];
  const exists=!!current?.[key];
  if(current)setEngagement(prev=>({...prev,[p.id]:{...current,[key]:!exists,
   likes:table==="post_likes"?Math.max(0,current.likes+(exists?-1:1)):current.likes,
   reposts:table==="post_reposts"?Math.max(0,current.reposts+(exists?-1:1)):current.reposts}}));
  try{
   const result=exists
    ?await supabase.from(table).delete().eq("post_id",p.id).eq("user_id",session.user.id)
    :await supabase.from(table).upsert({post_id:p.id,user_id:session.user.id},{onConflict:"post_id,user_id",ignoreDuplicates:true});
   if(result.error)throw result.error;
  }catch(e){setError(e instanceof Error?friendlyMuteError(e.message):"Actie mislukt")}
  finally{await load();setPendingActions(v=>v.filter(x=>x!==action))}
 }
 async function sendReply(){if(!supabase||!selected||!reply.trim()||busy)return;setBusy(true);setError("");const {error:e}=await supabase.from("post_replies").insert({post_id:selected.id,author_id:session.user.id,parent_id:replyTo?.id||null,body:reply.trim()});if(e)setError(friendlyMuteError(e.message));else{setReply("");setReplyTo(null);await Promise.all([loadReplies(selected.id),load()])}setBusy(false)}
 const openPost=useCallback(async(p:SocialPost)=>{
  setSelected(p);setMenuPost(null);
  if(!supabase)return;
  const {error:e}=await supabase.from("post_views").upsert({post_id:p.id,viewer_id:session.user.id},{onConflict:"post_id,viewer_id",ignoreDuplicates:true});
  if(e)setError(friendlyMuteError(e.message));else void load();
 },[session.user.id,load]);
 function startEdit(p:SocialPost){setEditing(p);setEditBody(p.body);setMenuPost(null);setSelected(null);setError("")}
 async function saveEdit(){
  if(!supabase||!editing||saving||!editBody.trim()||editBody.length>500||countHashtags(editBody)>5)return;
  setSaving(true);setError("");
  try{
   const {data,error:e}=await supabase.from("posts").update({body:editBody.trim()}).eq("id",editing.id).eq("author_id",session.user.id).select("id").single();
   if(e)throw e;if(!data)throw new Error("Post kon niet worden bijgewerkt");
   setEditing(null);await load();
  }catch(e){setError(e instanceof Error?friendlyMuteError(e.message):"Bewerken mislukt")}finally{setSaving(false)}
 }
 async function deletePost(){
  if(!supabase||!confirmDelete||saving)return;
  setSaving(true);setError("");
  try{
   const {data,error:e}=await supabase.from("posts").delete().eq("id",confirmDelete.id).eq("author_id",session.user.id).select("id").single();
   if(e)throw e;if(!data)throw new Error("Post kon niet worden verwijderd");
   if(selected?.id===confirmDelete.id)setSelected(null);
   setConfirmDelete(null);await load();
  }catch(e){setError(e instanceof Error?friendlyMuteError(e.message):"Verwijderen mislukt")}finally{setSaving(false)}
 }
 function card(p:SocialPost){const e=engagement[p.id];return <article className="social-post" key={p.id}><div className="social-avatar" onClick={()=>onOpenProfile?.(p.author_id)}>{p.profiles?.avatar_url?<img src={p.profiles.avatar_url} alt=""/>:(p.profiles?.display_name||"M")[0]}</div><div className="social-post-main"><div className="social-meta"><button onClick={()=>onOpenProfile?.(p.author_id)}><strong>{p.profiles?.display_name||"Mingle member"}</strong> <NameBadge userId={p.author_id}/> <span>@{p.profiles?.username||"member"}</span></button><time title={stamp(p.created_at)}>{stamp(p.created_at)}</time>{p.author_id===session.user.id&&<div className="social-manage"><button className="social-manage-trigger" aria-label="Post beheren" aria-expanded={menuPost===p.id} onClick={()=>setMenuPost(v=>v===p.id?null:p.id)}><MoreHorizontal size={20}/></button>{menuPost===p.id&&<div className="social-manage-menu"><button onClick={()=>startEdit(p)}><Pencil size={16}/> Bewerken</button><button className="social-danger" onClick={()=>{setConfirmDelete(p);setMenuPost(null)}}><Trash2 size={16}/> Verwijderen</button></div>}</div>}</div><button className="social-post-text" onClick={()=>void openPost(p)}><HighlightedText text={p.body} onTag={tag=>{window.dispatchEvent(new CustomEvent("mingle-open-hashtag",{detail:tag}))}}/></button><PostExtras postId={p.id} userId={session.user.id} imageUrl={p.image_url}/><button className="social-read" onClick={()=>void openPost(p)}>Open post <span>↗</span></button><div className="social-actions"><button className={e?.liked?"social-active":""} onClick={()=>void toggle("post_likes",p)} aria-label="Vind ik leuk"><Heart size={17} fill={e?.liked?"currentColor":"none"}/> {e?.likes||0}</button><button onClick={()=>void openPost(p)} aria-label="Reacties"><MessageCircle size={17}/> {e?.replies||0}</button><button className={e?.reposted?"social-active":""} onClick={()=>void toggle("post_reposts",p)} aria-label="Repost"><Repeat2 size={17}/> {e?.reposts||0}</button><button className={e?.bookmarked?"social-active":""} onClick={()=>void toggle("post_bookmarks",p)} aria-label="Opslaan"><Bookmark size={17} fill={e?.bookmarked?"currentColor":"none"}/></button><span className="social-view-count" title="Unieke weergaven"><Eye size={16}/> {e?.views||0}</span></div></div></article>}
 return <div className="social-list">{mode==="profile"&&<div className="profile-post-tabs" role="tablist" aria-label="Profielberichten"><button type="button" role="tab" aria-selected={profileTab==="posts"} className={profileTab==="posts"?"active":""} onClick={()=>setProfileTab("posts")}><MessageCircle size={17}/> Posts</button><button type="button" role="tab" aria-selected={profileTab==="media"} className={profileTab==="media"?"active":""} onClick={()=>setProfileTab("media")}><Images size={17}/> Media</button><button type="button" role="tab" aria-selected={profileTab==="reposts"} className={profileTab==="reposts"?"active":""} onClick={()=>setProfileTab("reposts")}><Repeat2 size={17}/> Reposts</button></div>}{error&&<div className="social-error" role="alert">{error}<button onClick={()=>setError("")}>×</button></div>}{posts.length?posts.map(card):<div className="social-empty">{mode==="bookmarks"?"Je hebt nog geen posts opgeslagen. Sla een interessante post op om hem hier terug te vinden.":mode==="profile"?(profileTab==="media"?"Er zijn nog geen posts met media op dit profiel.":profileTab==="reposts"?"Dit profiel heeft nog niets gerepost.":"Er zijn nog geen posts op dit profiel."):"Hier zijn nog geen posts. Plaats je eerste bericht!"}</div>}{editing&&<div className="social-modal-bg" onClick={()=>!saving&&setEditing(null)}><section className="social-modal social-edit-modal" role="dialog" aria-modal="true" aria-label="Post bewerken" onClick={e=>e.stopPropagation()}><button className="social-modal-close" onClick={()=>setEditing(null)} disabled={saving}><X size={20}/></button><h2>Post bewerken</h2><p className="social-edit-help">Pas je tekst en hashtags aan. Maximaal 5 hashtags.</p><HashtagComposer value={editBody} onChange={setEditBody} placeholder="Wat wil je delen?"/><div className="social-edit-actions"><button className="secondary" onClick={()=>setEditing(null)} disabled={saving}>Annuleren</button><button className="primary" onClick={()=>void saveEdit()} disabled={saving||!editBody.trim()||countHashtags(editBody)>5||editBody===editing.body}>{saving?"Opslaan...":"Wijzigingen opslaan"}</button></div></section></div>}{confirmDelete&&<div className="social-modal-bg" onClick={()=>!saving&&setConfirmDelete(null)}><section className="social-modal social-confirm-modal" role="alertdialog" aria-modal="true" aria-label="Post verwijderen" onClick={e=>e.stopPropagation()}><h2>Post verwijderen?</h2><p>Je post en alle bijbehorende reacties, likes en weergaven worden definitief verwijderd.</p><div className="social-edit-actions"><button className="secondary" disabled={saving} onClick={()=>setConfirmDelete(null)}>Annuleren</button><button className="social-delete-confirm" disabled={saving} onClick={()=>void deletePost()}>{saving?"Verwijderen...":"Definitief verwijderen"}</button></div></section></div>}{selected&&<div className="social-modal-bg" onClick={()=>setSelected(null)}><section className="social-modal" role="dialog" aria-modal="true" aria-label="Post bekijken" onClick={e=>e.stopPropagation()}><button className="social-modal-close" onClick={()=>setSelected(null)}><X size={22}/></button><h2>{selected.profiles?.display_name||"Mingle member"} <NameBadge userId={selected.author_id}/></h2><span className="social-date">{stamp(selected.created_at)}</span><p className="social-fulltext"><HighlightedText text={selected.body} onTag={tag=>window.dispatchEvent(new CustomEvent("mingle-open-hashtag",{detail:tag}))}/></p><PostExtras postId={selected.id} userId={session.user.id} imageUrl={selected.image_url}/><div className="social-actions"><button onClick={()=>void toggle("post_likes",selected)}><Heart size={18}/> {engagement[selected.id]?.likes||0}</button><button onClick={()=>void toggle("post_reposts",selected)}><Repeat2 size={18}/> {engagement[selected.id]?.reposts||0}</button><button onClick={()=>void toggle("post_bookmarks",selected)}><Bookmark size={18}/> Opslaan</button></div><div className="social-detail-views"><Eye size={16}/> {engagement[selected.id]?.views||0} unieke weergaven</div><h3>Reacties ({replies.length})</h3><div className="social-replies">{renderReplies(null)}</div>{replyTo&&<div className="social-replying-to">Antwoord op @{replyTo.profiles?.username||"member"} <button onClick={()=>setReplyTo(null)}>Annuleren</button></div>}<textarea maxLength={500} placeholder={replyTo?"Schrijf een antwoord...":"Schrijf een reactie..."} value={reply} onChange={e=>setReply(e.target.value)}/><button className="primary" disabled={!reply.trim()||busy} onClick={()=>void sendReply()}>{replyTo?"Antwoord plaatsen":"Reactie plaatsen"}</button></section></div>}</div>
}
export function ProfileStats({session,userId}:{session:Session;userId:string}){
 const [stats,setStats]=useState({followers:0,following:0,likes:0});
 const [revision,setRevision]=useState(0);
 const refreshNow=useCallback(()=>setRevision(n=>n+1),[]);
 useSocialUpdates(refreshNow);
 useEffect(()=>{window.addEventListener("mingle-social-changed",refreshNow);return()=>window.removeEventListener("mingle-social-changed",refreshNow)},[refreshNow]);
 useEffect(()=>{if(!supabase)return;const client=supabase;let active=true;
 const refresh=async()=>{
  const [a,b,c]=await Promise.all([
   client.from("follows").select("*",{count:"exact",head:true}).eq("following_id",userId),
   client.from("follows").select("*",{count:"exact",head:true}).eq("follower_id",userId),
   client.from("posts").select("id").eq("author_id",userId)
  ]);
  const ids=(c.data||[]).map(x=>x.id);
  const likes=ids.length?await client.from("post_likes").select("*",{count:"exact",head:true}).in("post_id",ids):null;
  if(active)setStats({followers:a.count||0,following:b.count||0,likes:likes?.count||0});
 };
 void refresh();const timer=window.setInterval(()=>{if(!document.hidden)void refresh()},5000);
 return()=>{active=false;window.clearInterval(timer)}
 },[userId,session.user.id,revision]);
 return <div className="social-stats"><div><strong>{stats.followers}</strong><span>Volgers</span></div><div><strong>{stats.following}</strong><span>Volgend</span></div><div><strong>{stats.likes}</strong><span>Likes ontvangen</span></div></div>
}

export function FollowButton({session,userId}:{session:Session;userId:string}){
 const [following,setFollowing]=useState<boolean|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const refresh=useCallback(async()=>{
  if(!supabase||userId===session.user.id)return;
  const {data,error:e}=await supabase.from("follows").select("follower_id,following_id").eq("follower_id",session.user.id).eq("following_id",userId).limit(1);
  if(e){setError(friendlyMuteError(e.message));return}
  setError("");setFollowing((data||[]).length>0);
 },[session.user.id,userId]);
 const notify=useCallback(()=>{void refresh()},[refresh]);
 useSocialUpdates(notify);
 useEffect(()=>{setFollowing(null);setError("");void refresh();const timer=window.setInterval(()=>{if(!document.hidden)void refresh()},5000);return()=>window.clearInterval(timer)},[refresh]);
 if(userId===session.user.id)return null;
 async function toggleFollow(){
  if(!supabase||busy||following===null)return;
  setBusy(true);setError("");
  try{
   const {error:e}=following
    ?await supabase.from("follows").delete().eq("follower_id",session.user.id).eq("following_id",userId)
    :await supabase.from("follows").upsert({follower_id:session.user.id,following_id:userId},{onConflict:"follower_id,following_id",ignoreDuplicates:true});
   if(e)throw e;
   setFollowing(!following);
   window.dispatchEvent(new Event("mingle-social-changed"));
   await refresh();
  }catch(e){setError(e instanceof Error?friendlyMuteError(e.message):"Volgen is mislukt");await refresh()}
  finally{setBusy(false)}
 }
 return <div className="profile-follow-wrap"><button className="profile-follow-button" disabled={busy||following===null} onClick={()=>void toggleFollow()}>{following===null?"Laden...":following?<><UserMinus size={17}/> Ontvolgen</>:<><UserPlus size={17}/> Volgen</>}</button>{error&&<span className="profile-follow-error" role="alert">{error}</span>}</div>;
}
