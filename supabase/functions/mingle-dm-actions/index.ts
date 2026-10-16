import {createClient} from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"https://mingle-app.nl","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Content-Type":"application/json"};
const respond=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return respond({});
 if(req.method!=="POST")return respond({error:"Method not allowed"},405);
 const url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
 const jwt=req.headers.get("Authorization")||"";
 if(!jwt.startsWith("Bearer "))return respond({error:"Not authenticated"},401);
 const client=createClient(url,anon,{global:{headers:{Authorization:jwt}}});
 const {data:userInfo,error:authError}=await client.auth.getUser();
 if(authError||!userInfo.user)return respond({error:"Not authenticated"},401);
 const body=await req.json().catch(()=>({}));
 if(body.action!=="clear"&&body.action!=="delete")return respond({error:"Invalid action"},400);
 const {data,error}=body.action==="clear"
  ?await client.rpc("dm_clear_chat",{connection:body.connection})
  :await client.rpc("dm_delete_message",{message_id:body.message_id});
 if(error)return respond({error:error.message},400);
 const paths=(body.action==="clear"?(data||[]):data?[data]:[]) as string[];
 if(paths.length){
  const admin=createClient(url,service);
  for(let i=0;i<paths.length;i+=100){
   const {error:storageError}=await admin.storage.from("dm-attachments").remove(paths.slice(i,i+100));
   if(storageError)return respond({ok:true,storageCleanupPending:true,error:storageError.message});
  }
 }
 return respond({ok:true,storageCleanupPending:false});
});
