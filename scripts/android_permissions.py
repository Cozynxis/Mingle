"""Grant the generated Capacitor app Android camera/microphone declarations for WebRTC."""
from pathlib import Path
p=Path("android/app/src/main/AndroidManifest.xml")
s=p.read_text()
permissions=["android.permission.RECORD_AUDIO","android.permission.CAMERA","android.permission.MODIFY_AUDIO_SETTINGS"]
for permission in permissions:
 line=f'    <uses-permission android:name="{permission}" />'
 if permission not in s:
  s=s.replace("<application",line+"\n    <application",1) if "<application" in s else s.replace("</manifest>",line+"\n</manifest>")
# Some generated Android manifests have <application> nested in <manifest>;
# permissions must be direct children of manifest and precede application.
p.write_text(s)
print("Android camera and microphone manifest permissions configured")
