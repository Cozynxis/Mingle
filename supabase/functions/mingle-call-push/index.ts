import {createClient} from "https://esm.sh/@supabase/supabase-js@2";
type ServiceAccount={client_email:string;private_key:string;project_id:string};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json","Access-Control-Allow-Origin":"https://mingle-app.nl","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info"}});
const b64=(input:Uint8Array)=>btoa(String.fromCharCode(...input)).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");
async function googleToken(sa:ServiceAccount){
 const now=Math.floor(Date.now()/1000);
 const header=b64(new TextEncoder().encode(JSON.stringify({alg:"RS256",typ:"JWT"})));
 const body=b64(new TextEncoder().encode(JSON.stringify({iss:sa.client_email,scope:"https://www.googleapis.com/auth/firebase.messaging",aud:"https://oauth2.googleapis.com/token",iat:now,exp:now+3600})));
 const keyData=sa.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g,"");
 const bytes=Uint8Array.from(atob(keyData),c=>c.charCodeAt(0));
 const key=await crypto.subtle.importKey("pkcs8",bytes,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["sign"]);
 const signature=b64(new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5",key,new TextEncoder().encode(header+"."+body))));
 const response=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion:header+"."+body+"."+signature})});
 if(!response.ok)throw Error("Google OAuth failed: "+response.status);
 return (await response.json()).access_token as string;
}
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return json({});
 if(req.method!=="POST")return json({error:"Method not allowed"},405);
 const auth=req.headers.get("authorization")||"";
 const url=Deno.env.get("SUPABASE_URL"),anon=Deno.env.get("SUPABASE_ANON_KEY"),service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),secret=Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");
 if(!url||!anon||!service||!secret)return json({error:"Server not configured"},503);
 const userClient=createClient(url,anon,{global:{headers:{Authorization:auth}}});
 const {data:{user},error:authError}=await userClient.auth.getUser();
 if(authError||!user)return json({error:"Unauthorized"},401);
 let payload:{call_id?:string;connection_id?:string};
 try{payload=await req.json()}catch{return json({error:"Invalid JSON"},400)}
 if(!payload.call_id||!payload.connection_id)return json({error:"Missing call information"},400);
 const db=createClient(url,service);
 const {data:offer,error}=await db.from("dm_call_signals").select("id,call_id,connection_id,sender_id,recipient_id,kind,payload,created_at").eq("call_id",payload.call_id).eq("connection_id",payload.connection_id).eq("sender_id",user.id).eq("kind","offer").order("created_at",{ascending:false}).limit(1).maybeSingle();
 if(error||!offer)return json({error:"Call not found"},404);
 if(Date.now()-new Date(offer.created_at).getTime()>45000)return json({error:"Call expired"},410);
 const {data:tokens}=await db.from("mingle_push_tokens").select("token").eq("user_id",offer.recipient_id).limit(20);
 if(!tokens?.length)return json({sent:0});
 const sa=JSON.parse(secret) as ServiceAccount;
 const bearer=await googleToken(sa);
 let sent=0;
 for(const {token} of tokens){
  const response=await fetch("https://fcm.googleapis.com/v1/projects/"+encodeURIComponent(sa.project_id)+"/messages:send",{method:"POST",headers:{"Authorization":"Bearer "+bearer,"Content-Type":"application/json"},body:JSON.stringify({message:{token,data:{type:"incoming_call",call_id:offer.call_id,connection_id:offer.connection_id,kind:offer.payload?.video?"video":"audio"},android:{priority:"HIGH",notification:{channel_id:"mingle_calls",title:"Mingle-oproep",body:"Je wordt gebeld via Mingle",click_action:"MINGLE_OPEN_CALL"}}}})});
  if(response.ok)sent++;
  else if(response.status===404||response.status===400)await db.from("mingle_push_tokens").delete().eq("token",token).eq("user_id",offer.recipient_id);
 }
 return json({sent});
});
