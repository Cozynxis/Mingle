# Mingle Premium — Mollie integration (TEST ONLY)

This integration is intentionally restricted to Mollie **test keys**. No live charges or production Premium entitlements are possible from these functions. The live transition requires an adult/authorized business owner, provider approval, and a separate security review.

## Prerequisites
1. Apply `202610160001_premium_foundation.sql`, `202610160002_premium_visuals.sql`, and `202610160003_mollie_billing.sql` in order in Supabase SQL Editor.
2. Have the authorized account holder create a Mollie organization/website profile, enable suitable recurring methods (iDEAL first payment + SEPA direct debit, or cards), and retrieve a **test** API key. Never put API keys in GitHub or Vite environment variables.
3. In Supabase Edge Function secrets, configure `MOLLIE_API_KEY=test_...`. `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are server-only environment secrets. Do not paste credentials into chat.
4. Deploy functions from the repo:
   `supabase functions deploy mollie-checkout`
   `supabase functions deploy mollie-cancel`
   `supabase functions deploy mollie-webhook --no-verify-jwt`
   Checkout and cancel require the signed-in Supabase JWT. Webhook is public but re-fetches every payment directly from Mollie, matches stored payment and customer IDs, validates amount and test mode, and never trusts POST status.
5. Mollie must reach the HTTPS webhook at `https://nhacsqqkczqmyfvcifho.supabase.co/functions/v1/mollie-webhook`. The functions supply this URL when creating payments and subscriptions. GitHub Pages cannot host this webhook.
6. Test first payment, cancel, payment failure, webhook retries, browser refresh, different users, and that test purchases **do not** grant real Premium.

## Current scope
- Test checkout: creates customer and €1 first recurring-consent payment, then monthly test subscription on verified paid webhook.
- Payment events and billing status stored server-side with RLS (read-own only).
- User-initiated cancellation calls Mollie and stops future test renewals.
- Test status is displayed in the Premium page. **Test payments do not enable the production Premium badge or cosmetics**; use existing admin test access for that.
- The €1/month display is not a live purchase offer yet.

## Before going live (not implemented)
- Merchant identity/business verification, responsible adult authorization, consumer cancellation/renewal disclosures, terms and privacy, VAT/invoicing, refund and chargeback policy, consent and applicable EU/NL requirements.
- Explicit production/test separation; no promotion of test subscriptions to live.
- Verified live payment entitlements with paid-through reconciliation and grace policies; webhook idempotency/locking and reconciliation jobs for out-of-order callbacks.
- Secure refunds, failed payments, renewals, dunning, cancellation at period end, and administrative audit logs.
- Comprehensive end-to-end tests. Do not switch to live keys by removing the test-key guard alone.
