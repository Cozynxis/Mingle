import { useCallback, useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import "./post-extras.css";
type Option={id:string;post_id:string;label:string;position:number};
type Vote={option_id:string;user_id:string};
export function PostExtras({postId,userId,imageUrl}:{postId:string;userId:string;imageUrl?:string|null}){
 const [question,setQuestion]=useState(""),[options,setOptions]=useState<Option[]>([]),[votes,setVotes]=useState<Vote[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const refresh=useCallback(async()=>{
  if(!supabase)return;
  const {data:poll,error:e}=await supabase.from("post_polls").select("question").eq("post_id",postId).maybeSingle();
  if(e){setError(e.message);setLoading(false);return}
  if(!poll){setQuestion("");setOptions([]);setVotes([]);setLoading(false);return}
  const [o,v]=await Promise.all([supabase.from("post_poll_options").select("id,post_id,label,position").eq("post_id",postId).order("position"),supabase.from("post_poll_votes").select("option_id,user_id").eq("post_id",postId)]);
  if(o.error||v.error)setError(o.error?.message||v.error?.message||"Stemmen laden mislukt");
  else{setQuestion(poll.question);setOptions(o.data||[]);setVotes(v.data||[]);setError("")}
  setLoading(false);
 },[postId]);
 useEffect(()=>{void refresh();const timer=window.setInterval(()=>{if(!document.hidden)void refresh()},5000);let channel:ReturnType<NonNullable<typeof supabase>["channel"]>|undefined;if(supabase){channel=supabase.channel("poll-"+postId+"-"+crypto.randomUUID()).on("postgres_changes",{event:"*",schema:"public",table:"post_poll_votes",filter:"post_id=eq."+postId},()=>{void refresh()}).subscribe()}return()=>{window.clearInterval(timer);if(channel&&supabase)void supabase.removeChannel(channel)}},[refresh,postId]);
 const own=votes.find(v=>v.user_id===userId);
 async function vote(optionId:string){if(!supabase||busy||own)return;setBusy(true);const {error:e}=await supabase.from("post_poll_votes").insert({post_id:postId,option_id:optionId,user_id:userId});if(e)setError(e.message);await refresh();setBusy(false)}
 return <>{imageUrl&&<a href={imageUrl} target="_blank" rel="noopener noreferrer" className="post-image-link" onClick={e=>e.stopPropagation()}><img className="post-image" src={imageUrl} alt="Afbeelding bij post" loading="lazy"/></a>}{!loading&&question&&<div className="post-poll"><strong className="post-poll-question">{question}</strong><div className="post-poll-options">{options.map(o=>{const count=votes.filter(v=>v.option_id===o.id).length;const percent=votes.length?Math.round(count/votes.length*100):0;return <button type="button" key={o.id} disabled={busy||!!own} className={"post-poll-option"+(own?.option_id===o.id?" voted":"")} onClick={()=>void vote(o.id)}>{own&&<span className="post-poll-fill" style={{width:percent+"%"}}/>}<span>{o.label}</span>{own&&<b>{percent}%</b>}</button>})}</div><small>{votes.length} {votes.length===1?"stem":"stemmen"} · {own?"Je hebt gestemd":"Kies één antwoord"}</small>{error&&<small className="post-poll-error">{error}</small>}</div>}</>;
}
