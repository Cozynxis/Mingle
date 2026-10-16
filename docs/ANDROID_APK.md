# Mingle Android APK en updates

De Android-basis gebruikt Capacitor met de live website https://mingle-app.nl in de Android WebView. De huidige repository bevat nog geen gegenereerde Android Studio-projectmap of ondertekende APK.

## Eerste APK bouwen
1. Installeer Node.js, Java 17 en Android Studio met Android SDK.
2. Voer uit: `npm install`, `npx cap add android`, `npm run android:sync`, `npm run android:open`.
3. Maak in Android Studio een **signed release APK** met een eigen keystore. Bewaar de keystore en wachtwoorden veilig, buiten GitHub.
4. Stel in Android Studio een oplopende `versionCode` in, beginnend bij 1. De code moet bij iedere APK-release hoger zijn dan de vorige.
5. Publiceer de APK als GitHub Release asset op `Cozynxis/Mingle`. Gebruik een rechtstreekse `https://github.com/Cozynxis/Mingle/releases/download/.../mingle.apk`-URL.

## Updates
Wijzig `public/android-update.json` naar bijvoorbeeld:
```json
{
  "versionCode": 2,
  "versionName": "1.1.0",
  "apkUrl": "https://github.com/Cozynxis/Mingle/releases/download/v1.1.0/mingle.apk",
  "releaseNotes": "Nieuwe functies en verbeteringen.",
  "required": false
}
```
De app controleert dit bestand bij openen en wanneer hij weer zichtbaar wordt. Bij een hogere versionCode toont hij de updatepopup. De gebruiker moet de download en Android-installatie bevestigen. **Onderteken iedere volgende APK met exact dezelfde keystore en gebruik hetzelfde package ID**, anders kan Android niet over de bestaande app heen updaten.

## Nog nodig
- Een werkende Android Studio-build en ondertekende release-APK.
- De release-upload en een echte APK-download-URL.
- Testen van APK-installatie en update op een Android-toestel.
- Controleren van de Supabase-login en redirects in de native WebView.

De Android-app laadt de live website `https://mingle-app.nl`. Nieuwe websiteversies verschijnen na herladen of opnieuw openen van de app, zonder nieuwe APK. Native Android-wijzigingen vereisen nog steeds een nieuwe, met dezelfde sleutel ondertekende APK. De app heeft een internetverbinding nodig. Test de Supabase-login, externe links en de Android-updatepopup op een echt toestel voordat je de APK deelt.

## Automatisch bouwen via GitHub Actions (geen Android Studio nodig)
Open **Actions → Build Mingle Android APK → Run workflow**. Bij iedere relevante wijziging op main wordt de workflow ook gestart. Download na een geslaagde run het artifact. Zonder release-sleutel heet dit `Mingle-Android-Test-APK` en bevat het een debug-APK. Een debug-APK is alleen voor eigen tests; deze is niet bedoeld als definitieve distributie.

### Definitieve, ondertekende release (eenmalig instellen)
Een vaste **private keystore** is vereist om nieuwe APK-versies over de oude heen te installeren. Maak de keystore **eenmalig** in een vertrouwde omgeving, bewaar een veilige offline back-up, en zet nooit het keystorebestand of wachtwoorden in de repository. Je kunt de sleutel met Java `keytool` aanmaken; hiervoor is Android Studio niet nodig. GitHub Actions kan vervolgens de ondertekende APK's bouwen.

Voeg in GitHub **Settings → Secrets and variables → Actions → New repository secret** de volgende vier secrets toe:

- `MINGLE_KEYSTORE_B64`: Base64 van het binaire JKS-keystorebestand (één regel)
- `MINGLE_KEYSTORE_PASSWORD`: wachtwoord van de keystore
- `MINGLE_KEY_ALIAS`: alias van de sleutel
- `MINGLE_KEY_PASSWORD`: wachtwoord van de sleutel

De workflow schakelt dan automatisch over naar `assembleRelease` en uploadt het artifact `Mingle-Android-Signed-Release-APK`. **Een nieuwe sleutel per build werkt niet voor upgrades**. Deel deze secrets nooit in een chat, commit of issue.

### Waarschuwingen en veiligheid
Een geldig ondertekende APK is niet automatisch door Google Play Protect goedgekeurd. Android kan bij sideloading toestemming voor onbekende bronnen vragen; dat kan een app niet veilig uitschakelen. Controleer de APK en installeer uitsluitend releases die je zelf hebt gebouwd. Voor een gebruiksvriendelijke installatie zonder sideload-toestemming is Google Play de aanbevolen route.

### Status van het updatesysteem
De bestaande updatepopup is voorbereid, maar automatische release-publicatie, een juiste `versionCode` per release en de verwijzing in `public/android-update.json` moeten nog worden afgerond en op een echte telefoon getest. De APK kan niet zonder bevestiging van de gebruiker worden geïnstalleerd.
