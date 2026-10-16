import {createClient} from "https://esm.sh/@supabase/supabase-js@2";
Deno.serve(async(req)=>{
 const origin=req.headers.get("origin")||"https://mingle-app.nl";
 const headers={"Access-Control-Allow-Origin":origin==="https://mingle-app.nl"?"https://mingle-app.nl":"null","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Content-Type":"application/json","Vary":"Origin"};
 if(req.method==="OPTIONS")return new Response(null,{headers});
 if(req.method!=="POST")return new Response(JSON.stringify({error:"Method not allowed"}),{status:405,headers});
 const token=req.headers.get("authorization")?.replace(/^Bearer\s+/i,"");
 if(!token)return new Response(JSON.stringify({error:"Unauthorized"}),{status:401,headers});
 const client=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_ANON_KEY")!,{global:{headers:{Authorization:"Bearer "+token}}});
 const {data:{user},error}=await client.auth.getUser(token);
 if(error||!user)return new Response(JSON.stringify({error:"Unauthorized"}),{status:401,headers});
 const url=Deno.env.get("MINGLE_TURN_URL"),secret=Deno.env.get("MINGLE_TURN_SHARED_SECRET");
 if(!url||!secret)return new Response(JSON.stringify({iceServers:[],configured:false}),{headers});
 const username=String(Math.floor(Date.now()/1000)+3600)+":"+user.id;
 const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-1"},false,["sign"]);
 const signed=new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(username)));
 const credential=btoa(String.fromCharCode(...signed));
 return new Response(JSON.stringify({iceServers:[{urls:url.split(",").map(x=>x.trim()),username,credential}],configured:true}),{headers});
});
