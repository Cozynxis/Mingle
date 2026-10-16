import type {CapacitorConfig} from "@capacitor/cli";

// Live Mingle website inside the Android app.
// Website changes deploy instantly; native changes still require a signed APK update.
const config:CapacitorConfig={
 appId:"nl.mingle.app",
 appName:"Mingle",
 webDir:"dist",
 server:{url:"https://mingle-app.nl",cleartext:false,androidScheme:"https"},
 android:{allowMixedContent:false}
};
export default config;
