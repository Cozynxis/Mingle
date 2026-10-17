import {createClient} from "https://esm.sh/@supabase/supabase-js@2";
type Event={type?:string;table?:string;record?:Record<string,unknown>};
type ServiceAccount={client_email:string;private_key:string;project_id:string};
const response=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json"}});
const b64=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes)).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");
async function googleToken(sa:ServiceAccount){
 const now=Math.floor(Date.now()/1000),header=b64(new TextEncoder().encode(JSON.stringify({alg:"RS256",typ:"JWT"}))),payload=b64(new TextEncoder().encode(JSON.stringify({iss:sa.client_email,scope:"https://www.googleapis.com/auth/firebase.messaging",aud:"https://oauth2.googleapis.com/token",iat:now,exp:now+3600})));
 const bytes=Uint8Array.from(atob(sa.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g,"")),c=>c.charCodeAt(0));
 const key=await crypto.subtle.importKey("pkcs8",bytes,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["sign"]);
 const signature=b64(new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5",key,new TextEncoder().encode(header+"."+payload))));
 const r=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion:header+"."+payload+"."+signature})});
 if(!r.ok)throw Error("FCM auth "+r.status);return (await r.json()).access_token as string;
}
Deno.serve(async req=>{
 if(req.method!=="POST")return response({error:"Method not allowed"},405);
 const secret=Deno.env.get("MINGLE_PUSH_WEBHOOK_SECRET");
 const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 const providedSecret=req.headers.get("x-mingle-webhook-secret");
 const bearer=req.headers.get("authorization")?.replace(/^Bearer\\s+/i,"");
 const webhookAuthenticated=Boolean(secret&&providedSecret===secret);
 const serviceAuthenticated=Boolean(serviceKey&&bearer===serviceKey);
 if(!webhookAuthenticated&&!serviceAuthenticated)return response({error:"Unauthorized",reason:!secret?"webhook_secret_missing":!providedSecret?"webhook_header_missing":"webhook_secret_mismatch"},401);
 const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),firebase=Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");
 if(!url||!key||!firebase)return response({error:"Missing server secrets"},503);
 let event:Event;try{event=await req.json()}catch{return response({error:"Invalid JSON"},400)}
 if(event.type!=="INSERT"||!event.record||!["dm_messages","mingle_group_messages","notifications"].includes(event.table||""))return response({skipped:true});
 const db=createClient(url,key),row=event.record,table=event.table;
 const id=String(row.id||"");if(!id)return response({skipped:true});
 let recipients:string[]=[],title="",body="",type="",channel="",extra:Record<string,string>={};
 if(table==="dm_messages"){
  const {data:c}=await db.from("dm_connections").select("requester_id,recipient_id,status").eq("id",row.connection_id).maybeSingle();
  if(!c||c.status!=="accepted")return response({skipped:true});
  const sender=String(row.sender_id);if(![c.requester_id,c.recipient_id].includes(sender))return response({skipped:true});
  recipients=[c.requester_id===sender?c.recipient_id:c.requester_id];title="Nieuw privébericht";body="Je hebt een nieuw bericht op Mingle";type="dm_message";channel="mingle_messages";extra={connection_id:String(row.connection_id)};
 }else if(table==="mingle_group_messages"){
  const {data:g}=await db.from("mingle_groups").select("name").eq("id",row.group_id).maybeSingle();
  const {data:m}=await db.from("mingle_group_members").select("user_id").eq("group_id",row.group_id).neq("user_id",row.sender_id);
  recipients=(m||[]).map(x=>x.user_id);title=g?.name||"Mingle-groep";body="Nieuw groepsbericht";type="group_message";channel="mingle_messages";extra={group_id:String(row.group_id)};
 }else if(table==="notifications"&&row.kind==="follow"){
  recipients=[String(row.recipient_id)];title="Nieuwe volger";body="Iemand volgt je nu op Mingle";type="follow";channel="mingle_social";
 }else return response({skipped:true});
 const sa=JSON.parse(firebase) as ServiceAccount,bearer=await googleToken(sa);let sent=0;
 for(const user of recipients){
  const {data:pref}=await db.from("notification_preferences").select("enabled,follows").eq("user_id",user).maybeSingle();
  if(pref?.enabled===false||(type==="follow"&&pref?.follows===false))continue;
  const {data:tokens}=await db.from("mingle_push_tokens").select("token").eq("user_id",user).eq("platform","android").limit(20);
  for(const t of tokens||[]){
   const message={token:t.token,data:{type,...extra,event_id:id},android:{priority:"HIGH",notification:{channel_id:channel,title,body,tag:type+":"+id}}};
   const res=await fetch("https://fcm.googleapis.com/v1/projects/"+encodeURIComponent(sa.project_id)+"/messages:send",{method:"POST",headers:{"Authorization":"Bearer "+bearer,"Content-Type":"application/json"},body:JSON.stringify({message})});
   if(res.ok)sent++;
   else if([400,404].includes(res.status)){const err=await res.text();if(err.includes("UNREGISTERED")||err.includes("INVALID_ARGUMENT"))await db.from("mingle_push_tokens").delete().eq("token",t.token)}
  }
 }
 return response({sent});
});
