import {db,json,mollie,webhookUrl} from "../_shared/mollie.ts";
Deno.serve(async req=>{if(req.method!=="POST")return json({error:"Method not allowed"},405);
 try{
 const body=await req.text();const id=new URLSearchParams(body).get("id");if(!id||!/^tr_[a-zA-Z0-9]+$/.test(id))return json({error:"Invalid id"},400);
 // Mollie classic webhooks are not signed: never trust POST fields; fetch canonical payment.
 const payment=await mollie("/payments/"+encodeURIComponent(id));if(payment.mode!=="test")return json({error:"Mode mismatch"},400);
 const admin=db();let billing;
 if(payment.subscriptionId){const {data}=await admin.from("mollie_billing").select("*").eq("subscription_id",payment.subscriptionId).maybeSingle();billing=data}
 else{const {data}=await admin.from("mollie_billing").select("*").eq("first_payment_id",payment.id).maybeSingle();billing=data}
 if(!billing||billing.customer_id!==payment.customerId||payment.amount?.currency!=="EUR"||payment.amount?.value!=="1.00")return json({ok:true});
 const userId=billing.user_id;
 await admin.from("mollie_payment_events").upsert({payment_id:id,user_id:userId,subscription_id:payment.subscriptionId||null,status:payment.status,amount:payment.amount.value,processed_at:new Date().toISOString()});
 if(payment.status==="paid"){
  if(!payment.subscriptionId&&!billing.subscription_id){
   // Create recurring schedule only after the paid first installment; avoid charging twice this month.
   const start=new Date();start.setUTCMonth(start.getUTCMonth()+1);
   const sub=await mollie("/customers/"+encodeURIComponent(billing.customer_id)+"/subscriptions","POST",{amount:{currency:"EUR",value:"1.00"},interval:"1 month",startDate:start.toISOString().slice(0,10),description:"Mingle Premium - maandabonnement (TEST)",webhookUrl:webhookUrl(),metadata:{userId,mode:"test"}});
   await admin.from("mollie_billing").update({subscription_id:sub.id,state:"active_test",paid_through:start.toISOString(),updated_at:new Date().toISOString()}).eq("user_id",userId);
  }else if(payment.subscriptionId){
   const previous=billing.paid_through&&new Date(billing.paid_through)>new Date()?new Date(billing.paid_through):new Date();previous.setUTCMonth(previous.getUTCMonth()+1);
   await admin.from("mollie_billing").update({state:"active_test",paid_through:previous.toISOString(),updated_at:new Date().toISOString()}).eq("user_id",userId);
  }
 }else if(["failed","canceled","expired","charged_back"].includes(payment.status)){await admin.from("mollie_billing").update({state:"payment_"+payment.status,updated_at:new Date().toISOString()}).eq("user_id",userId)}
 // Test-mode payment NEVER grants production premium_subscriptions.
 return json({ok:true});
 }catch(e){return json({error:String(e instanceof Error?e.message:e)},500)}
});
