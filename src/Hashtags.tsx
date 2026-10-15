import { useMemo, useRef, useState } from "react";
import { Hash } from "lucide-react";
import "./hashtags.css";
export const HASHTAG_RE=/#([\p{L}\p{N}_]{1,40})/gu;
export const countHashtags=(text:string)=>[...text.matchAll(HASHTAG_RE)].length;
export const popularHashtags=["mingle","gaming","minecraft","roblox","nieuws","muziek","tech","art","memes","kieteldood","community","vragen"];
export function HighlightedText({text,onTag}:{text:string;onTag?:(tag:string)=>void}){
 const parts=text.split(/(#[\p{L}\p{N}_]{1,40})/gu);
 return <>{parts.map((part,i)=>part.startsWith("#")&&/^#[\p{L}\p{N}_]{1,40}$/u.test(part)?<button key={i} type="button" className="mingle-hashtag" onClick={e=>{e.stopPropagation();onTag?.(part)}}>{part}</button>:<span key={i}>{part}</span>)}</>;
}
export function HashtagComposer({value,onChange,maxLength=500,placeholder}:{value:string;onChange:(value:string)=>void;maxLength?:number;placeholder:string}){
 const [cursor,setCursor]=useState(0);
 const highlightRef=useRef<HTMLDivElement>(null);
 const active=useMemo(()=>{const before=value.slice(0,cursor);const m=before.match(/(?:^|\s)#([\p{L}\p{N}_]{0,40})$/u);return m?{fragment:m[1],start:before.length-m[1].length-1}:null},[value,cursor]);
 const suggestions=useMemo(()=>active?popularHashtags.filter(t=>t.startsWith(active.fragment.toLowerCase())&&!value.toLowerCase().includes("#"+t)).slice(0,6):[],[active,value]);
 const insert=(tag:string)=>{if(!active)return;const next=value.slice(0,active.start)+"#"+tag+" "+value.slice(cursor);if(countHashtags(next)>5||next.length>maxLength)return;onChange(next);setCursor(active.start+tag.length+2)};
 const atLimit=countHashtags(value)>=5;
 const highlighted=value.split(/(#[\p{L}\p{N}_]{1,40})/gu).map((p,i)=>p.startsWith("#")?<mark key={i}>{p}</mark>:<span key={i}>{p}</span>);
 return <div className="mingle-composer-shell"><div className="mingle-composer-highlight" ref={highlightRef} aria-hidden="true">{highlighted}{!value&&<span className="mingle-placeholder">{placeholder}</span>}{"\n"}</div><textarea id="composer" maxLength={maxLength} value={value} placeholder={placeholder} onChange={e=>{const next=e.target.value;if(countHashtags(next)<=5){onChange(next);setCursor(e.target.selectionStart)}}} onSelect={e=>setCursor(e.currentTarget.selectionStart)} onScroll={e=>{if(highlightRef.current){highlightRef.current.scrollTop=e.currentTarget.scrollTop;highlightRef.current.scrollLeft=e.currentTarget.scrollLeft}}} spellCheck={true}/>{active&&suggestions.length>0&&!atLimit&&<div className="mingle-tag-suggestions"><div className="mingle-tag-suggestion-title"><Hash size={14}/> Populaire hashtags · optioneel</div>{suggestions.map(t=><button key={t} type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>insert(t)}>#{t}</button>)}</div>}<span className="mingle-hashtag-count">{countHashtags(value)}/5 hashtags</span></div>;
}
