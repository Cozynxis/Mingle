import { useCallback, useEffect, useState } from "react";
import { Bookmark, Heart, MessageCircle, Repeat2, X, UserPlus, UserMinus } from "lucide-react";
import { supabase } from "./lib/supabase";
import type { Session } from "@supabase/supabase-js";
import "./social.css";
export type SocialPost={id:string;author_id:string;body:string;created_at:string;profiles:{display_name:string;username:string;avatar_url:string|null}|null};
type Engagement={likes:number;reposts:number;replies:number;liked:boolean;reposted:boolean;bookmarked:boolean};
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
export function Social({session,mode="feed",profileId,followingOnly=false,onOpenProfile}:{session:Session;mode?:"feed"|"profile"|"bookmarks";profileId?:string;followingOnly?:boolean;onOpenProfile?:(id:string)=>void}){
 const [replyLikes,setReplyLikes]=useState<Record<string,{count:number;liked:boolean}>>({}),[replyTo,setReplyTo]=useState<Reply|null>(null),[posts,setPosts]=useState<SocialPost[]>([]),[engagement,setEngagement]=useState<Record<string,Engagement>>({}),[selected,setSelected]=useState<SocialPost|null>(null),[replies,setReplies]=useState<Reply[]>([]),[reply,setReply]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 const load=useCallback(async()=>{if(!supabase)return;const client=supabase;
 const [{data:followData},{data:postsData,error:postsError}]=await Promise.all([
 client.from("follows").select("following_id").eq("follower_id",session.user.id),
 client.from("posts").select("id,author_id,body,created_at,profiles!posts_author_id_fkey(display_name,username,avatar_url)").order("created_at",{ascending:false}).limit(100)
 ]);
 if(postsError){setError(postsError.message);return}
 const followed=(followData||[]).map((f:any)=>String(f.following_id));
 const all=(postsData||[]) as unknown as SocialPost[];
 const ids=all.map(p=>p.id);
 if(!ids.length){setPosts([]);setEngagement({});return}
 const [likes,reposts,bookmarks,repliesData]=await Promise.all([
 client.from("post_likes").select("post_id,user_id").in("post_id",ids),
 client.from("post_reposts").select("post_id,user_id").in("post_id",ids),
 client.from("post_bookmarks").select("post_id").eq("user_id",session.user.id).in("post_id",ids),
 client.from("post_replies").select("post_id").in("post_id",ids)
 ]);
 const failures=[likes,reposts,bookmarks,repliesData].filter(x=>x.error);if(failures.length){setError(failures[0].error!.message);return}
 const map:Record<string,Engagement>={};
 for(const id of ids){const l=(likes.data||[]).filter(x=>x.post_id===id),r=(reposts.data||[]).filter(x=>x.post_id===id);
 map[id]={likes:l.length,reposts:r.length,replies:(repliesData.data||[]).filter(x=>x.post_id===id).length,liked:l.some(x=>x.user_id===session.user.id),reposted:r.some(x=>x.user_id===session.user.id),bookmarked:(bookmarks.data||[]).some(x=>x.post_id===id)}}
 setEngagement(map);
 setPosts(all.filter(p=>mode==="profile"?p.author_id===profileId:mode==="bookmarks"?map[p.id]?.bookmarked:!followingOnly||p.author_id===session.user.id||followed.includes(p.author_id)));
 },[session.user.id,mode,profileId,followingOnly]);
 useSocialUpdates(load);
 useEffect(()=>{void load();const timer=window.setInterval(()=>{if(!document.hidden)void load()},5000);return()=>window.clearInterval(timer)},[load]);
 const loadReplies=useCallback(async(postId:string)=>{if(!supabase)return;
 let {data,error:e}=await supabase.from("post_replies").select("id,author_id,parent_id,body,created_at,profiles!post_replies_author_id_fkey(display_name,username,avatar_url)").eq("post_id",postId).order("created_at");
 if(e && /parent_id|schema cache/i.test(e.message)){
  const fallback=await supabase.from("post_replies").select("id,author_id,body,created_at,profiles!post_replies_author_id_fkey(display_name,username,avatar_url)").eq("post_id",postId).order("created_at");
  data=(fallback.data||[]).map(item=>({...item,parent_id:null})) as typeof data;
  e=fallback.error;
 }
 if(e){setError(e.message);return}
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
 const {error:e}=exists?await supabase.from("reply_likes").delete().eq("reply_id",item.id).eq("user_id",session.user.id):await supabase.from("reply_likes").insert({reply_id:item.id,user_id:session.user.id});
 if(e)setError(e.message);if(selected)await loadReplies(selected.id);setBusy(false)}
 function renderReplies(parentId:string|null,depth=0):React.ReactNode{
  return replies.filter(r=>r.parent_id===parentId||(parentId===null&&r.parent_id&&!replies.some(p=>p.id===r.parent_id))).map(r=><div key={r.id} className="social-reply-thread" style={{marginLeft:Math.min(depth,3)*16}}>
   <div className="social-reply"><button className="social-reply-avatar" aria-label="Profiel bekijken" onClick={()=>{setSelected(null);onOpenProfile?.(r.author_id)}}>{r.profiles?.avatar_url?<img src={r.profiles.avatar_url} alt=""/>:(r.profiles?.display_name||"M")[0]}</button>
   <div className="social-reply-content"><div className="social-reply-meta"><button className="social-reply-author" onClick={()=>{setSelected(null);onOpenProfile?.(r.author_id)}}>{r.profiles?.display_name||"Member"} <span>@{r.profiles?.username||"member"}</span></button><small>{stamp(r.created_at)}</small></div><p>{r.body}</p>
   <div className="social-reply-actions"><button disabled={busy} className={replyLikes[r.id]?.liked?"social-active":""} onClick={()=>void toggleReplyLike(r)}><Heart size={14} fill={replyLikes[r.id]?.liked?"currentColor":"none"}/> {replyLikes[r.id]?.count||0}</button><button onClick={()=>{setReplyTo(r);setReply("")}}>Beantwoorden</button></div></div></div>
   {depth<8&&renderReplies(r.id,depth+1)}
  </div>)
 }
 async function toggle(table:"post_likes"|"post_reposts"|"post_bookmarks",p:SocialPost){if(!supabase||busy)return;setBusy(true);setError("");
 const key=table==="post_likes"?"liked":table==="post_reposts"?"reposted":"bookmarked";const exists=engagement[p.id]?.[key];
 const q=exists?await supabase.from(table).delete().eq("post_id",p.id).eq("user_id",session.user.id):await supabase.from(table).insert({post_id:p.id,user_id:session.user.id});
 if(q.error)setError(q.error.message);await load();setBusy(false)}
 async function sendReply(){if(!supabase||!selected||!reply.trim()||busy)return;setBusy(true);setError("");const {error:e}=await supabase.from("post_replies").insert({post_id:selected.id,author_id:session.user.id,parent_id:replyTo?.id||null,body:reply.trim()});if(e)setError(e.message);else{setReply("");setReplyTo(null);await Promise.all([loadReplies(selected.id),load()])}setBusy(false)}
 function card(p:SocialPost){const e=engagement[p.id];return <article className="social-post" key={p.id}><div className="social-avatar" onClick={()=>onOpenProfile?.(p.author_id)}>{p.profiles?.avatar_url?<img src={p.profiles.avatar_url} alt=""/>:(p.profiles?.display_name||"M")[0]}</div><div className="social-post-main"><div className="social-meta"><button onClick={()=>onOpenProfile?.(p.author_id)}><strong>{p.profiles?.display_name||"Mingle member"}</strong> <span>@{p.profiles?.username||"member"}</span></button><time title={stamp(p.created_at)}>{stamp(p.created_at)}</time></div><button className="social-post-text" onClick={()=>setSelected(p)}>{p.body}</button><button className="social-read" onClick={()=>setSelected(p)}>Open post <span>↗</span></button><div className="social-actions"><button className={e?.liked?"social-active":""} onClick={()=>void toggle("post_likes",p)} aria-label="Vind ik leuk"><Heart size={17} fill={e?.liked?"currentColor":"none"}/> {e?.likes||0}</button><button onClick={()=>setSelected(p)} aria-label="Reacties"><MessageCircle size={17}/> {e?.replies||0}</button><button className={e?.reposted?"social-active":""} onClick={()=>void toggle("post_reposts",p)} aria-label="Repost"><Repeat2 size={17}/> {e?.reposts||0}</button><button className={e?.bookmarked?"social-active":""} onClick={()=>void toggle("post_bookmarks",p)} aria-label="Opslaan"><Bookmark size={17} fill={e?.bookmarked?"currentColor":"none"}/></button></div></div></article>}
 return <div className="social-list">{error&&<div className="social-error" role="alert">{error}<button onClick={()=>setError("")}>×</button></div>}{posts.length?posts.map(card):<div className="social-empty">{mode==="bookmarks"?"Je hebt nog geen posts opgeslagen. Sla een interessante post op om hem hier terug te vinden.":mode==="profile"?"Er zijn nog geen posts op dit profiel.":"Hier zijn nog geen posts. Plaats je eerste bericht!"}</div>}{selected&&<div className="social-modal-bg" onClick={()=>setSelected(null)}><section className="social-modal" role="dialog" aria-modal="true" aria-label="Post bekijken" onClick={e=>e.stopPropagation()}><button className="social-modal-close" onClick={()=>setSelected(null)}><X size={22}/></button><h2>{selected.profiles?.display_name||"Mingle member"}</h2><span className="social-date">{stamp(selected.created_at)}</span><p className="social-fulltext">{selected.body}</p><div className="social-actions"><button onClick={()=>void toggle("post_likes",selected)}><Heart size={18}/> {engagement[selected.id]?.likes||0}</button><button onClick={()=>void toggle("post_reposts",selected)}><Repeat2 size={18}/> {engagement[selected.id]?.reposts||0}</button><button onClick={()=>void toggle("post_bookmarks",selected)}><Bookmark size={18}/> Opslaan</button></div><h3>Reacties ({replies.length})</h3><div className="social-replies">{renderReplies(null)}</div>{replyTo&&<div className="social-replying-to">Antwoord op @{replyTo.profiles?.username||"member"} <button onClick={()=>setReplyTo(null)}>Annuleren</button></div>}<textarea maxLength={500} placeholder={replyTo?"Schrijf een antwoord...":"Schrijf een reactie..."} value={reply} onChange={e=>setReply(e.target.value)}/><button className="primary" disabled={!reply.trim()||busy} onClick={()=>void sendReply()}>{replyTo?"Antwoord plaatsen":"Reactie plaatsen"}</button></section></div>}</div>
}
export function ProfileStats({session,userId}:{session:Session;userId:string}){
 const [stats,setStats]=useState({followers:0,following:0,likes:0});
 const [revision,setRevision]=useState(0);
 const refreshNow=useCallback(()=>setRevision(n=>n+1),[]);
 useSocialUpdates(refreshNow);
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
  if(e){setError(e.message);return}
  setFollowing((data||[]).length>0);
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
   await refresh();
  }catch(e){setError(e instanceof Error?e.message:"Volgen is mislukt");await refresh()}
  finally{setBusy(false)}
 }
 return <div className="profile-follow-wrap"><button className="profile-follow-button" disabled={busy||following===null} onClick={()=>void toggleFollow()}>{following===null?"Laden...":following?<><UserMinus size={17}/> Ontvolgen</>:<><UserPlus size={17}/> Volgen</>}</button>{error&&<span className="profile-follow-error" role="alert">{error}</span>}</div>;
}
