# Mingle AI — deployment

## 1. Database
Open Supabase SQL Editor and run `supabase/migrations/202610160020_mingle_ai.sql`.

## 2. Groq key
Create a Groq API key in the Groq Console. **Never put it in GitHub, Vite environment variables, or frontend code.**
In Supabase Dashboard → Edge Functions → Secrets add `GROQ_API_KEY`.

## 3. Deploy Edge Function
Using the Supabase CLI with access to your project:
```sh
supabase functions deploy mingle-ai
```
The Edge Function uses the Supabase built-in `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` secrets.
Leave JWT verification enabled. The function independently validates the user token and enforces ownership and quotas.

## 4. Test
Sign in to Mingle, open Berichten → Mingle AI, and send a text message. Test an image after that.

## Limitations
- Image upload supports JPEG, PNG, WebP, GIF up to 5 MB. Video and document analysis are not implemented yet.
- Free users: 20 messages per 24-hour rolling window; Premium badge holders: 80.
- Premium model is `llama-3.3-70b-versatile`; free model is `llama-3.1-8b-instant`. Images use `qwen/qwen3.8-27b`.
- Premium eligibility currently checks the `premium` profile badge, which may not match the subscription state. Align this with authoritative subscription entitlement before production.
- Conversations are stored privately and cannot be deleted from the chat UI yet.
- The browser uploads images to a private storage bucket; the Edge Function downloads them server-side.
- This feature has provider costs and must be monitored for abuse, errors, and rate limits.
