# Mingle Android background calls — setup still required

The in-app incoming call banner and TURN credential endpoint are in source. **Closed-app Android incoming calls are not active yet.** A website or WebView cannot wake a terminated Android process using Supabase polling.

## TURN
1. Deploy Supabase Edge Function `mingle-turn-credentials`.
2. Configure secrets `MINGLE_TURN_URL` (e.g. `turn:your-turn-host:3478?transport=udp,turns:your-turn-host:5349?transport=tcp`) and `MINGLE_TURN_SHARED_SECRET` matching a TURN server with REST/shared-secret authentication (e.g. coturn use-auth-secret/static-auth-secret).
3. Test from mobile data to another network. Keep TURN secrets on server only. STUN fallback is not sufficient for reliable calls.

## Closed-app incoming calls (not yet implemented)
1. Create a Firebase project with Android package `nl.mingle.app`, download `google-services.json` privately, and configure FCM with Capacitor Android native push registration and runtime notification permission.
2. Store FCM device tokens in a Supabase table with user ownership/RLS. Revoke tokens on logout.
3. Trigger a server-side Edge Function on a **validated** new call offer to send FCM data messages to the recipient. Do not send using browser-held Firebase server keys.
4. Implement an Android native high-priority incoming-call notification with answer/decline actions and a PendingIntent/deep link that launches the exact Mingle conversation. Handle locked screens, notification permission, Android 13+, background restrictions, and Android 14+ full-screen-intent eligibility.
5. Implement expiry, cancellation, call state and ICE candidate buffering. Test force-closed, killed by OS, Doze, battery saver, locked screen and two networks. Delivery is not guaranteed in every state; force-stopped apps may not receive FCM until reopened.

Do not mark closed-app calls production-ready before those steps and device tests are complete.
