import {NameBadge} from "./Badges";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, Hash, Users, Sparkles, TrendingUp, X, ArrowUpRight } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import { Social } from "./Social";
import "./explore.css";

type Person={id:string;username:string;display_name:string;avatar_url:string|null;bio:string|null;is_private:boolean};
type PostPreview={id:string;author_id:string;body:string;created_at:string};
const hashtagPattern=/#([\p{L}\p{N}_]{2,40})/gu;
export function Explore({session,onOpenProfile}:{session:Session;onOpenProfile:(id:string)=>void}){
 const [search,setSearch]=useState(()=>window.sessionStorage.getItem("mingle-explore-query")||"");
 useEffect(()=>{const handler=(e:Event)=>{const tag=(e as CustomEvent<string>).detail;if(typeof tag==="string"){setSearch(tag);setFilter(tag.startsWith("#")?"posts":"all");window.sessionStorage.setItem("mingle-explore-query",tag)}};window.addEventListener("mingle-explore-search",handler);return()=>window.removeEventListener("mingle-explore-search",handler)},[]);
 const [filter,setFilter]=useState<"all"|"people"|"posts"|"tags">("all");
 const [people,setPeople]=useState<Person[]>([]);
 const [posts,setPosts]=useState<PostPreview[]>([]);
 const [followed,setFollowed]=useState<string[]>([]);
 const [error,setError]=useState("");
 const [loading,setLoading]=useState(true);
 const refresh=useCallback(async()=>{
  if(!supabase)return;
  const [users,postResult,follows]=await Promise.all([
   supabase.from("profiles").select("id,username,display_name,avatar_url,bio,is_private").eq("is_private",false).limit(100),
   supabase.from("posts").select("id,author_id,body,created_at").order("created_at",{ascending:false}).limit(100),
   supabase.from("follows").select("following_id").eq("follower_id",session.user.id)
  ]);
  if(users.error||postResult.error||follows.error)setError(users.error?.message||postResult.error?.message||follows.error?.message||"Laden mislukt");
  else{setPeople((users.data||[]) as Person[]);setPosts((postResult.data||[]) as PostPreview[]);setFollowed((follows.data||[]).map(x=>x.following_id));setError("")}
  setLoading(false);
 },[session.user.id]);
 useEffect(()=>{void refresh();const timer=window.setInterval(()=>{if(!document.hidden)void refresh()},12000);const onFocus=()=>{void refresh()};window.addEventListener("focus",onFocus);return()=>{window.clearInterval(timer);window.removeEventListener("focus",onFocus)}},[refresh]);
 const tags=useMemo(()=>{
  const counts=new Map<string,number>();
  for(const post of posts){const found=new Set([...post.body.matchAll(hashtagPattern)].map(m=>m[1].toLocaleLowerCase()));for(const tag of found)counts.set(tag,(counts.get(tag)||0)+1)}
  return [...counts.entries()].sort((a,b)=>b[1]-a[1]).map(([tag,count])=>({tag,count}));
 },[posts]);
 const term=search.trim().toLocaleLowerCase();
 const matches=people.filter(p=>p.id!==session.user.id&&(!term||[p.username,p.display_name,p.bio||""].some(v=>v.toLocaleLowerCase().includes(term)))).sort((a,b)=>Number(followed.includes(b.id))-Number(followed.includes(a.id)));
 const shownTags=tags.filter(t=>!term||t.tag.includes(term.replace(/^#/,"")));
 const followingPeople=matches.filter(p=>followed.includes(p.id));
 const pickTag=(tag:string)=>{setSearch("#"+tag);setFilter("posts")};
 return <div className="explore-page">
  <div className="explore-hero"><div className="explore-eyebrow"><Sparkles size={16}/> DISCOVER MINGLE</div><h2>Ontdek wat er speelt<span>.</span></h2><p>Vind mensen, gesprekken en onderwerpen die bij jou passen.</p>
   <div className="explore-search"><Search size={22}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Zoek mensen, posts of #hashtags..." aria-label="Zoeken op Mingle"/>{search&&<button onClick={()=>setSearch("")} aria-label="Zoekopdracht wissen"><X size={18}/></button>}</div>
  </div>
  <div className="explore-filters">{([["all","Alles"],["people","Mensen"],["posts","Posts"],["tags","Hashtags"]] as const).map(([key,label])=><button key={key} className={filter===key?"explore-filter active":"explore-filter"} onClick={()=>setFilter(key)}>{label}</button>)}</div>
  {error&&<p className="explore-error" role="alert">{error}</p>}
  {loading?<div className="explore-loading">Mingle ontdekken...</div>:<>
   {(filter==="all"||filter==="tags")&&<section className="explore-section"><div className="explore-heading"><div><TrendingUp size={20}/><h3>{term?"Gevonden hashtags":"Populaire hashtags"}</h3></div><span>{tags.length} onderwerpen</span></div>
    {shownTags.length?<div className="explore-tags">{shownTags.slice(0,filter==="tags"?40:10).map(({tag,count})=><button key={tag} onClick={()=>pickTag(tag)}><Hash size={18}/><span><strong>{tag}</strong><small>{count} {count===1?"post":"posts"}</small></span><ArrowUpRight size={15}/></button>)}</div>:<p className="explore-empty">Nog geen hashtags gevonden. Schrijf een post met bijvoorbeeld #kieteldood en het onderwerp verschijnt hier automatisch.</p>}
   </section>}
   {(filter==="all"||filter==="people")&&<section className="explore-section"><div className="explore-heading"><div><Users size={20}/><h3>{term?"Mensen gevonden":followingPeople.length?"Mensen die je volgt":"Ontdek mensen"}</h3></div><span>{matches.length} profielen</span></div>
    {matches.length?<div className="explore-people">{(term||filter==="people"?matches:followingPeople.length?followingPeople.concat(matches.filter(p=>!followed.includes(p.id))):matches).slice(0,filter==="people"?50:8).map(p=><button key={p.id} className="explore-person" onClick={()=>onOpenProfile(p.id)}><span className="explore-person-avatar">{p.avatar_url?<img src={p.avatar_url} alt=""/>:(p.display_name||"M")[0]}</span><span className="explore-person-info"><strong>{p.display_name} <NameBadge userId={p.id}/></strong><small>@{p.username}{followed.includes(p.id)?" · Volgend":""}</small>{p.bio&&<span className="explore-person-bio">{p.bio}</span>}</span><ArrowUpRight size={18}/></button>)}</div>:<p className="explore-empty">Geen mensen gevonden.</p>}
   </section>}
   {(filter==="all"||filter==="posts")&&<section className="explore-section explore-post-section"><div className="explore-heading"><div><Sparkles size={20}/><h3>{term?"Zoekresultaten in posts":"Posts ontdekken"}</h3></div><span>{term?"Zoeken in gesprekken":"Van de community"}</span></div>
    <Social session={session} mode="feed" searchQuery={search} onOpenProfile={onOpenProfile}/>
   </section>}
  </>}
 </div>;
}
