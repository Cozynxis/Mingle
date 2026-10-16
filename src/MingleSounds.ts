/* Mingle audio cues. Put the seven supplied MP3 files in public/sounds/. */
export type SoundName="call"|"notificationOff"|"message"|"voiceNext"|"voiceStop"|"mute"|"unmute";
const paths:Record<SoundName,string>={
 call:"/sounds/CallIncoming.mp3",
 notificationOff:"/sounds/NotificationOffBerichten.mp3",
 message:"/sounds/BerichtAudio.mp3",
 voiceNext:"/sounds/Spraakberichtverder.mp3",
 voiceStop:"/sounds/Spraakberichtstop.mp3",
 mute:"/sounds/Mute.mp3",
 unmute:"/sounds/Unmute.mp3"
};
let ringtone:HTMLAudioElement|null=null;
export async function playSound(name:SoundName){
 try{const audio=new Audio(paths[name]);audio.volume=name==="call"?.65:.8;await audio.play();return audio}catch{return null}
}
export function startRingtone(){
 if(ringtone)return;
 const audio=new Audio(paths.call);audio.loop=true;audio.volume=.65;ringtone=audio;
 void audio.play().catch(()=>{});
}
export function stopRingtone(){if(ringtone){ringtone.pause();ringtone.currentTime=0;ringtone=null}}
