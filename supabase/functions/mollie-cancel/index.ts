import {auth,cors,json,mollie} from "../_shared/mollie.ts";
Deno.serve(async req=>{if(req.method==="OPTIONS")return cors();if(req.method!=="POST")return json({error:"Method not allowed"},405);
 try{const {admin,user}=await auth(req);const {data:b}=await admin.from("mollie_billing").select("*").eq("user_id",user.id).maybeSingle();if(!b?.subscription_id)return json({error:"Geen lopend Mollie-abonnement"},400);
 await mollie("/customers/"+encodeURIComponent(b.customer_id)+"/subscriptions/"+encodeURIComponent(b.subscription_id),"DELETE");
 const {error}=await admin.from("mollie_billing").update({cancel_at_period_end:true,state:"canceled_test",updated_at:new Date().toISOString()}).eq("user_id",user.id);if(error)throw error;return json({ok:true,paid_through:b.paid_through});
 }catch(e){return json({error:String(e instanceof Error?e.message:e)},400)}
});
