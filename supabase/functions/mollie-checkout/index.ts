import {auth,cors,db,json,mollie,webhookUrl} from "../_shared/mollie.ts";
Deno.serve(async req=>{if(req.method==="OPTIONS")return cors();if(req.method!=="POST")return json({error:"Method not allowed"},405);
 try{
 const {admin,user}=await auth(req);const {data:existing}=await admin.from("mollie_billing").select("*").eq("user_id",user.id).maybeSingle();
 if(existing?.subscription_id&&!existing.cancel_at_period_end)return json({error:"Je hebt al een abonnement"},409);
 if(existing?.first_payment_id&&!existing.subscription_id){const previous=await mollie("/payments/"+encodeURIComponent(existing.first_payment_id));if(["open","pending","authorized"].includes(previous.status))return json({url:previous._links?.checkout?.href});}
 let customerId=existing?.customer_id;
 if(!customerId){const customer=await mollie("/customers","POST",{name:user.user_metadata?.display_name||"Mingle gebruiker",email:user.email});customerId=customer.id}
 const payment=await mollie("/payments","POST",{amount:{currency:"EUR",value:"1.00"},customerId,sequenceType:"first",description:"Mingle Premium - eerste maand (TEST)",redirectUrl:"https://mingle-app.nl/?premium=return",webhookUrl:webhookUrl(),metadata:{userId:user.id,purpose:"mingle_premium_first",mode:"test"}});
 const {error}=await admin.from("mollie_billing").upsert({user_id:user.id,customer_id:customerId,first_payment_id:payment.id,mode:"test",state:"awaiting_first_payment",updated_at:new Date().toISOString()},{onConflict:"user_id"});if(error)throw error;
 return json({url:payment._links.checkout.href});
 }catch(e){return json({error:String(e instanceof Error?e.message:e)},400)}
});
