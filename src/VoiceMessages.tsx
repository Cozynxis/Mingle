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
   rec.onstop=()=>{media.getTracks().forEach(t=>t.stop());const type=rec.mimeType||"audio/webm";const ext=type.includes("mp4")?"m4a":type.includes("ogg")?"ogg":"webm";const blob=new Blob(chunks,{type});if(blob.size)onRecorded(new File([blob],"spraakbericht-"+Date.now()+"."+ext,{type}));setRecording(false)};
   rec.start();setError("");setRecording(true);
  }catch(e){setError(e instanceof Error?e.message:"Microfoon niet beschikbaar");setRecording(false)}
 }
 return <><button type="button" title={recording?"Opname stoppen":"Spraakbericht opnemen"} aria-label={recording?"Stop opname":"Start spraakbericht"} disabled={disabled} onClick={()=>void toggle()} style={{color:recording?"#ff647d":undefined}}>{recording?<Square size={19}/>:<Mic size={19}/>}</button>{error&&<small role="alert">{error}</small>}</>;
}
export function VoicePlayer({src}:{src:string}){
 const audio=useRef<HTMLAudioElement>(null);const [playing,setPlaying]=useState(false),[position,setPosition]=useState(0),[duration,setDuration]=useState(0),[speed,setSpeed]=useState(1);
 useEffect(()=>{setPlaying(false);setPosition(0)},[src]);
 const fmt=(n:number)=>Number.isFinite(n)?Math.floor(n/60)+":"+String(Math.floor(n%60)).padStart(2,"0"):"0:00";
 return <div style={{display:"flex",alignItems:"center",gap:8,minWidth:190}}>
  <audio ref={audio} src={src} preload="metadata" onTimeUpdate={e=>setPosition(e.currentTarget.currentTime)} onLoadedMetadata={e=>setDuration(e.currentTarget.duration)} onEnded={()=>setPlaying(false)}/>
  <button type="button" aria-label={playing?"Pauze":"Afspelen"} onClick={()=>{const a=audio.current;if(!a)return;if(a.paused){void a.play().then(()=>setPlaying(true)).catch(()=>setPlaying(false))}else{a.pause();setPlaying(false)}}}>{playing?<Pause size={19}/>:<Play size={19}/>}</button>
  <input aria-label="Afspeelpositie" type="range" min={0} max={Number.isFinite(duration)?duration:0} step=".1" value={position} onChange={e=>{if(audio.current)audio.current.currentTime=Number(e.target.value);setPosition(Number(e.target.value))}} style={{width:95}}/>
  <small>{fmt(position)}/{fmt(duration)}</small>
  <button type="button" title="Afspeelsnelheid" onClick={()=>{const next=speed===1?1.5:speed===1.5?2:1;setSpeed(next);if(audio.current)audio.current.playbackRate=next}}>{speed}×</button>
 </div>
}