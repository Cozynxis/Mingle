# Mingle Android APK en updates

De Android-basis gebruikt Capacitor. De huidige repository bevat nog geen gegenereerde Android Studio-projectmap of ondertekende APK.

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

Webupdates van `mingle-app.nl` worden niet automatisch ingeladen in de Capacitor-app met gebundelde assets. Voor die aanpak is een afzonderlijk veilig live-updateproces nodig; de huidige APK vereist voor codewijzigingen een nieuwe release.
