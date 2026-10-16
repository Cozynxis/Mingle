import {createClient} from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return json({error:"Method not allowed"},405);
 const url=Deno.env.get("SUPABASE_URL"),anon=Deno.env.get("SUPABASE_ANON_KEY"),service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),key=Deno.env.get("GROQ_API_KEY");
 if(!url||!anon||!service||!key)return json({error:"AI is nog niet geconfigureerd."},503);
 const auth=req.headers.get("Authorization")||"";
 if(!auth.startsWith("Bearer "))return json({error:"Log eerst in."},401);
 const admin=createClient(url,service,{auth:{persistSession:false}});
 const {data:{user},error:authError}=await admin.auth.getUser(auth.slice(7));
 if(authError||!user)return json({error:"Sessie ongeldig."},401);
 let payload:{body?:unknown;imagePath?:unknown};
 try{payload=await req.json()}catch{return json({error:"Ongeldig verzoek."},400)}
 const body=typeof payload.body==="string"?payload.body.trim():"";
 const imagePath=typeof payload.imagePath==="string"?payload.imagePath:"";
 if(body.length>5000||(!body&&!imagePath))return json({error:"Schrijf een bericht van maximaal 5000 tekens."},400);
 if(imagePath&&(!imagePath.startsWith(user.id+"/")||imagePath.includes("..")))return json({error:"Ongeldige afbeelding."},400);
 const {data:premiumRow}=await admin.from("profile_badges").select("badge").eq("user_id",user.id).eq("badge","premium").maybeSingle();
 const premium=!!premiumRow;
 const since=new Date(Date.now()-86400000).toISOString();
 const {count,error:countError}=await admin.from("mingle_ai_messages").select("id",{count:"exact",head:true}).eq("user_id",user.id).eq("role","user").gte("created_at",since);
 if(countError)return json({error:"Kon gebruikslimiet niet controleren."},500);
 if((count||0)>=(premium?80:20))return json({error:"Je dagelijkse AI-limiet is bereikt. Probeer het morgen opnieuw."},429);
 const {data:history,error:historyError}=await admin.from("mingle_ai_messages").select("role,body").eq("user_id",user.id).order("created_at",{ascending:false}).limit(premium?28:12);
 if(historyError)return json({error:"Geschiedenis laden mislukt."},500);
 let imageUrl="";
 if(imagePath){
  const {data:file,error:fileError}=await admin.storage.from("mingle-ai-media").download(imagePath);
  if(fileError||!file||file.size>5242880)return json({error:"Afbeelding kon niet worden gelezen (maximaal 5 MB)."},400);
  const mime=file.type;
  if(!["image/jpeg","image/png","image/webp","image/gif"].includes(mime))return json({error:"Dit afbeeldingstype wordt niet ondersteund."},400);
  const bytes=new Uint8Array(await file.arrayBuffer());
  let binary="";for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  imageUrl="data:"+mime+";base64,"+btoa(binary);
 }
 const content=imageUrl?[{type:"text",text:body||"Beschrijf deze afbeelding."},{type:"image_url",image_url:{url:imageUrl}}]:body;
 const messages=[{role:"system",content:"Je bent Mingle AI, een behulpzame, vriendelijke AI-assistent binnen een sociaal platform. Antwoord meestal in de taal van de gebruiker. Wees eerlijk, duidelijk, natuurlijk en respecteer privacy. Je bent een AI, geen mens. Geef geen instructies die gevaar, misbruik of schade bevorderen. Doe geen ongegronde claims over afbeeldingen."},...(history||[]).reverse().map(m=>({role:m.role,content:m.body})),{role:"user",content}];
 const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),35000);
 let response:Response;
 try{response=await fetch("https://api.groq.com/openai/v1/chat/completions",{method:"POST",headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({model:imageUrl?"meta-llama/llama-4-scout-17b-16e-instruct":premium?"llama-3.3-70b-versatile":"llama-3.3-70b-versatile",messages,temperature:.7,max_completion_tokens:premium?1400:750}),signal:controller.signal})}catch{return json({error:"AI is tijdelijk niet bereikbaar."},502)}finally{clearTimeout(timeout)}
 const result=await response.json().catch(()=>({}));
 if(!response.ok){const providerMessage=typeof result?.error?.message==="string"?result.error.message:"Onbekende Groq-fout";console.error("Mingle AI Groq error",response.status,providerMessage);return json({error:response.status===429?"Groq-limiet bereikt. Probeer later opnieuw.":response.status===401?"Groq API-sleutel is ongeldig (401).":response.status===403?"Groq weigert toegang tot dit model (403).":response.status===404?"Groq-model niet gevonden (404): "+providerMessage.slice(0,280):response.status===400?"Groq heeft het verzoek afgewezen (400): "+providerMessage.slice(0,280):"Groq fout "+response.status+": "+providerMessage.slice(0,280)},502)}
 const answer=result?.choices?.[0]?.message?.content;
 if(typeof answer!=="string"||!answer.trim())return json({error:"Geen antwoord ontvangen."},502);
 const {error:saveError}=await admin.from("mingle_ai_messages").insert([{user_id:user.id,role:"user",body,image_path:imagePath||null},{user_id:user.id,role:"assistant",body:answer.trim()}]);
 if(saveError)return json({error:"Kon gesprek niet veilig opslaan."},500);
 return json({answer:answer.trim(),premium,remaining:Math.max(0,(premium?80:20)-(count||0)-1)});
});
