import {useEffect,useRef,useState} from "react";
import {Mic,Square,Play,Pause} from "lucide-react";
export function VoiceRecorder({onRecorded,disabled}:{onRecorded:(file:File)=>void;disabled:boolean}){
 const recorder=useRef<MediaRecorder|null>(null),stream=useRef<MediaStream|null>(null);
 const [recording,setRecording]=useState(false),[error,setError]=useState("");
 useEffect(()=>()=>{recorder.current?.stop();stream.current?.getTracks().forEach(t=>t.stop())},[]);
 async function toggle(){
  if(recording){recorder.current?.stop();setRecording(false);return}
  try{
   if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)throw Error("Opnemen wordt niet ondersteund.");
   const media=await navigator.mediaDevices.getUserMedia({audio:true});stream.current=media;
   const mime=["audio/webm;codecs=opus","audio/mp4","audio/webm"].find(t=>MediaRecorder.isTypeSupported(t));
   const chunks:Blob[]=[];const rec=new MediaRecorder(media,mime?{mimeType:mime}:undefined);recorder.current=rec;
   rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
   rec.onstop=()=>{media.getTracks().forEach(t=>t.stop());stream.current=null;recorder.current=null;const type=rec.mimeType||"audio/webm";const ext=type.includes("mp4")?"m4a":type.includes("ogg")?"ogg":"webm";const blob=new Blob(chunks,{type});if(blob.size)onRecorded(new File([blob],"spraakbericht-"+Date.now()+"."+ext,{type}));setRecording(false)};
   rec.start();setError("");setRecording(true);
  }catch(e){setError(e instanceof Error?e.message:"Microfoon niet beschikbaar");setRecording(false)}
 }
 return <><button type="button" title={recording?"Opname stoppen":"Spraakbericht opnemen"} aria-label={recording?"Stop opname":"Start spraakbericht"} disabled={disabled} onClick={()=>void toggle()} style={{color:recording?"#ff647d":undefined,background:recording?"#ff647d20":undefined,animation:recording?"dm-record-pulse 1.4s infinite":undefined}}>{recording?<Square size={19}/>:<Mic size={19}/>}</button>{recording&&<small style={{color:"#ff647d",whiteSpace:"nowrap"}}>Opnemen…</small>}{error&&<small role="alert">{error}</small>}</>;
}
// One shared audio element preserves Android's user-initiated playback session
// across voice notes, while each message owns its own visible controls.
const sharedVoice=new Audio();
let selectedVoice:string|null=null;
const voiceListeners=new Set<()=>void>();
function notifyVoice(){voiceListeners.forEach(fn=>fn())}
export function VoicePlayer({src,active=false,onStart,onFinished}:{src:string;active?:boolean;onStart?:()=>void;onFinished?:()=>void}){
 const [playing,setPlaying]=useState(false),[position,setPosition]=useState(0),[duration,setDuration]=useState(0),[speed,setSpeed]=useState(1);
 const finishRef=useRef(onFinished);finishRef.current=onFinished;
 useEffect(()=>{
  const update=()=>{const selected=selectedVoice===src;setPlaying(selected&&!sharedVoice.paused);setPosition(selected?sharedVoice.currentTime:0);setDuration(selected&&Number.isFinite(sharedVoice.duration)?sharedVoice.duration:0)};
  voiceListeners.add(update);
  const time=()=>notifyVoice();
  const ended=()=>{if(selectedVoice===src){setPlaying(false);finishRef.current?.()}};
  sharedVoice.addEventListener("timeupdate",time);
  sharedVoice.addEventListener("loadedmetadata",time);
  sharedVoice.addEventListener("play",time);
  sharedVoice.addEventListener("pause",time);
  sharedVoice.addEventListener("ended",ended);
  update();
  return()=>{voiceListeners.delete(update);sharedVoice.removeEventListener("timeupdate",time);sharedVoice.removeEventListener("loadedmetadata",time);sharedVoice.removeEventListener("play",time);sharedVoice.removeEventListener("pause",time);sharedVoice.removeEventListener("ended",ended)}
 },[src]);
 useEffect(()=>{
  if(!active||selectedVoice===src)return;
  selectedVoice=src;
  sharedVoice.src=src;
  sharedVoice.playbackRate=speed;
  // Reuse the SAME HTMLAudioElement for the next voice message on Android.
  void sharedVoice.play().then(notifyVoice).catch(notifyVoice);
  notifyVoice();
 },[active,src]);
 const fmt=(n:number)=>Number.isFinite(n)?Math.floor(n/60)+":"+String(Math.floor(n%60)).padStart(2,"0"):"0:00";
 return <div style={{display:"flex",alignItems:"center",gap:8,minWidth:0,maxWidth:"100%",width:"100%"}}>
  <button type="button" aria-label={playing?"Pauze":"Afspelen"} onClick={()=>{
   if(selectedVoice!==src){selectedVoice=src;sharedVoice.src=src;sharedVoice.playbackRate=speed;onStart?.();void sharedVoice.play().then(notifyVoice).catch(notifyVoice)}
   else if(sharedVoice.paused){onStart?.();void sharedVoice.play().then(notifyVoice).catch(notifyVoice)}
   else{sharedVoice.pause();notifyVoice()}
  }}>{playing?<Pause size={19}/>:<Play size={19}/>}</button>
  <input aria-label="Afspeelpositie" type="range" min={0} max={Number.isFinite(duration)?duration:0} step=".1" value={position} onChange={e=>{if(selectedVoice===src)sharedVoice.currentTime=Number(e.target.value);setPosition(Number(e.target.value))}} style={{width:"100%",minWidth:30,flex:1}}/>
  <small>{fmt(position)}/{fmt(duration)}</small>
  <button type="button" title="Afspeelsnelheid" onClick={()=>{const next=speed===1?1.5:speed===1.5?2:1;setSpeed(next);if(selectedVoice===src)sharedVoice.playbackRate=next}}>{speed}×</button>
 </div>
}
