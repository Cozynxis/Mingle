import { useCallback, useEffect, useState } from "react";
import { Bookmark, Heart, MessageCircle, Repeat2, X, UserPlus, UserMinus } from "lucide-react";
import { supabase } from "./lib/supabase";
import type { Session } from "@supabase/supabase-js";
import "./social.css";
export type SocialPost={id:string;author_id:string;body:string;created_at:string;profiles:{display_name:string;username:string;avatar_url:string|null}|null};
type Engagement={likes:number;reposts:number;replies:number;liked:boolean;reposted:boolean;bookmarked:boolean};
type Reply={id:string;author_id:string;body:string;created_at:string;profiles:{display_name:string;username:string;avatar_url:string|null}|null};
const stamp=(s:string)=>new Date(s).toLocaleString("nl-NL",{dateStyle:"medium",timeStyle:"short"});
export function Social({session,mode="feed",profileId,followingOnly=false,onOpenProfile}:{session:Session;mode?:"feed"|"profile"|"bookmarks";profileId?:string;followingOnly?:boolean;onOpenProfile?:(id:string)=>void}){
 const [posts,setPosts]=useState<SocialPost[]>([]),[engagement,setEngagement]=useState<Record<string,Engagement>>({}),[selected,setSelected]=useState<SocialPost|null>(null),[replies,setReplies]=useState<Reply[]>([]),[reply,setReply]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false);
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
 useEffect(()=>{void load()},[load]);
 useEffect(()=>{if(!selected||!supabase)return;void supabase.from("post_replies").select("id,author_id,body,created_at,profiles!post_replies_author_id_fkey(display_name,username,avatar_url)").eq("post_id",selected.id).order("created_at").then(({data,error})=>{if(error)setError(error.message);else setReplies((data||[]) as unknown as Reply[])})},[selected]);
 async function toggle(table:"post_likes"|"post_reposts"|"post_bookmarks",p:SocialPost){if(!supabase||busy)return;setBusy(true);setError("");
 const key=table==="post_likes"?"liked":table==="post_reposts"?"reposted":"bookmarked";const exists=engagement[p.id]?.[key];
 const q=exists?await supabase.from(table).delete().eq("post_id",p.id).eq("user_id",session.user.id):await supabase.from(table).insert({post_id:p.id,user_id:session.user.id});
 if(q.error)setError(q.error.message);await load();setBusy(false)}
 async function sendReply(){if(!supabase||!selected||!reply.trim()||busy)return;setBusy(true);const {error:e}=await supabase.from("post_replies").insert({post_id:selected.id,author_id:session.user.id,body:reply.trim()});if(e)setError(e.message);else{setReply("");setSelected(null);await load()}setBusy(false)}
 function card(p:SocialPost){const e=engagement[p.id];return <article className="social-post" key={p.id}><div className="social-avatar" onClick={()=>onOpenProfile?.(p.author_id)}>{p.profiles?.avatar_url?<img src={p.profiles.avatar_url} alt=""/>:(p.profiles?.display_name||"M")[0]}</div><div className="social-post-main"><div className="social-meta"><button onClick={()=>onOpenProfile?.(p.author_id)}><strong>{p.profiles?.display_name||"Mingle member"}</strong> <span>@{p.profiles?.username||"member"}</span></button><time title={stamp(p.created_at)}>{stamp(p.created_at)}</time></div><button className="social-post-text" onClick={()=>setSelected(p)}>{p.body}</button><button className="social-read" onClick={()=>setSelected(p)}>Open post <span>↗</span></button><div className="social-actions"><button className={e?.liked?"social-active":""} onClick={()=>void toggle("post_likes",p)} aria-label="Vind ik leuk"><Heart size={17} fill={e?.liked?"currentColor":"none"}/> {e?.likes||0}</button><button onClick={()=>setSelected(p)} aria-label="Reacties"><MessageCircle size={17}/> {e?.replies||0}</button><button className={e?.reposted?"social-active":""} onClick={()=>void toggle("post_reposts",p)} aria-label="Repost"><Repeat2 size={17}/> {e?.reposts||0}</button><button className={e?.bookmarked?"social-active":""} onClick={()=>void toggle("post_bookmarks",p)} aria-label="Opslaan"><Bookmark size={17} fill={e?.bookmarked?"currentColor":"none"}/></button></div></div></article>}
 return <div className="social-list">{error&&<div className="social-error" role="alert">{error}<button onClick={()=>setError("")}>×</button></div>}{posts.length?posts.map(card):<div className="social-empty">{mode==="bookmarks"?"Je hebt nog geen posts opgeslagen. Sla een interessante post op om hem hier terug te vinden.":mode==="profile"?"Er zijn nog geen posts op dit profiel.":"Hier zijn nog geen posts. Plaats je eerste bericht!"}</div>}{selected&&<div className="social-modal-bg" onClick={()=>setSelected(null)}><section className="social-modal" role="dialog" aria-modal="true" aria-label="Post bekijken" onClick={e=>e.stopPropagation()}><button className="social-modal-close" onClick={()=>setSelected(null)}><X size={22}/></button><h2>{selected.profiles?.display_name||"Mingle member"}</h2><span className="social-date">{stamp(selected.created_at)}</span><p className="social-fulltext">{selected.body}</p><div className="social-actions"><button onClick={()=>void toggle("post_likes",selected)}><Heart size={18}/> {engagement[selected.id]?.likes||0}</button><button onClick={()=>void toggle("post_reposts",selected)}><Repeat2 size={18}/> {engagement[selected.id]?.reposts||0}</button><button onClick={()=>void toggle("post_bookmarks",selected)}><Bookmark size={18}/> Opslaan</button></div><h3>Reacties ({replies.length})</h3><div className="social-replies">{replies.map(r=><div className="social-reply" key={r.id}><button className="social-reply-avatar" aria-label={`Profiel van ${r.profiles?.display_name||"Member"} bekijken`} onClick={()=>{setSelected(null);onOpenProfile?.(r.author_id)}}>{r.profiles?.avatar_url?<img src={r.profiles.avatar_url} alt=""/>:(r.profiles?.display_name||"M")[0]}</button><div className="social-reply-content"><div className="social-reply-meta"><button className="social-reply-author" onClick={()=>{setSelected(null);onOpenProfile?.(r.author_id)}}>{r.profiles?.display_name||"Member"} <span>@{r.profiles?.username||"member"}</span></button><small>{stamp(r.created_at)}</small></div><p>{r.body}</p></div></div>)}</div><textarea maxLength={500} placeholder="Schrijf een reactie..." value={reply} onChange={e=>setReply(e.target.value)}/><button className="primary" disabled={!reply.trim()||busy} onClick={()=>void sendReply()}>Reactie plaatsen</button></section></div>}</div>
}
export function ProfileStats({session,userId}:{session:Session;userId:string}){const [stats,setStats]=useState({followers:0,following:0,likes:0});useEffect(()=>{if(!supabase)return;const client=supabase;void (async()=>{const [a,b,c,d]=await Promise.all([client.from("follows").select("*",{count:"exact",head:true}).eq("following_id",userId),client.from("follows").select("*",{count:"exact",head:true}).eq("follower_id",userId),client.from("posts").select("id").eq("author_id",userId),client.from("post_likes").select("post_id")]);const ids=new Set((c.data||[]).map(x=>x.id));setStats({followers:a.count||0,following:b.count||0,likes:(d.data||[]).filter(x=>ids.has(x.post_id)).length})})()},[userId,session.user.id]);return <div className="social-stats"><div><strong>{stats.followers}</strong><span>Volgers</span></div><div><strong>{stats.following}</strong><span>Volgend</span></div><div><strong>{stats.likes}</strong><span>Likes ontvangen</span></div></div>}

export function FollowButton({session,userId}:{session:Session;userId:string}){
 const [following,setFollowing]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 useEffect(()=>{if(!supabase||userId===session.user.id)return;let active=true;setFollowing(false);void supabase.from("follows").select("following_id").eq("follower_id",session.user.id).eq("following_id",userId).maybeSingle().then(({data,error:e})=>{if(active){if(e)setError(e.message);else setFollowing(!!data)}});return()=>{active=false}},[session.user.id,userId]);
 if(userId===session.user.id)return null;
 async function toggleFollow(){
  if(!supabase||busy)return;
  setBusy(true);setError("");
  const {error:e}=following
   ?await supabase.from("follows").delete().eq("follower_id",session.user.id).eq("following_id",userId)
   :await supabase.from("follows").insert({follower_id:session.user.id,following_id:userId});
  if(e)setError(e.message);
  else setFollowing(!following);
  setBusy(false);
 }
 return <div className="profile-follow-wrap"><button className="profile-follow-button" disabled={busy} onClick={()=>void toggleFollow()}>{following?<><UserMinus size={17}/> Ontvolgen</>:<><UserPlus size={17}/> Volgen</>}</button>{error&&<span className="profile-follow-error" role="alert">{error}</span>}</div>;
}
