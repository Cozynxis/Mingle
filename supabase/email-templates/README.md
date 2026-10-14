# Mingle registratie via 6-cijferige code

De Mingle-app gebruikt `supabase.auth.signUp`, `supabase.auth.verifyOtp({ email, token, type: 'signup' })` en `supabase.auth.resend`.

## Verplicht instellen in Supabase
1. Ga naar **Authentication → Providers → Email** en laat **Confirm email** ingeschakeld.
2. Ga naar **Authentication → Email Templates → Confirm signup**.
3. Stel het onderwerp in op: **Mingle | Bevestig je e-mailadres**.
4. Plak de volledige inhoud van [confirm-signup.html](./confirm-signup.html) als HTML-template en sla op. **Belangrijk:** gebruik `{{ .Token }}`, niet `{{ .ConfirmationURL }}`.
5. Controleer onder **Authentication → URL Configuration** of Site URL `https://cozynxis.github.io/Mingle/` is en dezelfde URL in Redirect URLs staat.
6. Configureer onder **Project Settings → Authentication → SMTP Settings** (de exacte menunaam kan verschillen) een **eigen SMTP-provider** met een domein dat je bezit. Zonder werkende SMTP kan geen enkele frontend code garanderen dat een mail wordt verzonden.
7. Configureer SPF, DKIM en DMARC volgens de instructies van je mailprovider. Gebruik een echt afzenderadres, bijvoorbeeld `accounts@jouwdomein.nl`, en test verzending. De template alleen voorkomt geen spamclassificatie.

## Test
Maak een nieuw testaccount aan met een e-mailadres waarop je mail kunt ontvangen. Controleer of de mail aankomt en of de 6 cijfers in Mingle kunnen worden ingevoerd. Controleer bij problemen **Authentication → Logs** en SMTP-providerlogs.

**Let op:** een account dat al bestaat maar nog niet is bevestigd kan een andere registratieflow nodig hebben. Probeer bij dat account opnieuw een bevestigingsmail te versturen of controleer de gebruiker in Supabase Authentication → Users.

**Beveiliging:** stop SMTP-wachtwoorden en Supabase service-role keys nooit in de GitHub Pages frontend of openbare repository.
