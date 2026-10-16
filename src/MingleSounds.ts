/* Shared and warmed-up audio cues for mobile WebView playback. */
export type SoundName="call"|"notificationOff"|"message"|"voiceNext"|"voiceStop"|"mute"|"unmute";
const paths:Record<SoundName,string>={
 call:"/sounds/CallIncoming.mp3",notificationOff:"/sounds/NotificationOffBerichten.mp3",
 message:"/sounds/BerichtAudio.mp3",voiceNext:"/sounds/Spraakberichtverder.mp3",
 voiceStop:"/sounds/Spraakberichtstop.mp3",mute:"/sounds/Mute.mp3",unmute:"/sounds/Unmute.mp3"
};
const sounds=new Map<SoundName,HTMLAudioElement>();
let unlocked=false;
function getSound(name:SoundName){
 let audio=sounds.get(name);
 if(!audio){audio=new Audio(paths[name]);audio.preload="auto";audio.volume=name==="call"?.65:.8;sounds.set(name,audio)}
 return audio;
}
function unlock(){
 if(unlocked)return;
 unlocked=true;
 for(const name of Object.keys(paths) as SoundName[]){
  const audio=getSound(name);audio.load();
 }
}
if(typeof document!=="undefined"){
 document.addEventListener("pointerdown",unlock,{once:true,passive:true});
 document.addEventListener("touchstart",unlock,{once:true,passive:true});
 document.addEventListener("keydown",unlock,{once:true});
}
export async function playSound(name:SoundName){
 const audio=getSound(name);
 try{audio.pause();audio.currentTime=0;await audio.play();return audio}
 catch{return null}
}
export function startRingtone(){const audio=getSound("call");audio.loop=true;void audio.play().catch(()=>{})}
export function stopRingtone(){const audio=sounds.get("call");if(audio){audio.pause();audio.currentTime=0;audio.loop=false}}
