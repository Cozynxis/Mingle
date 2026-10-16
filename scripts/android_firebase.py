"""Enable Firebase Messaging Gradle integration in generated Capacitor Android project."""
from pathlib import Path
import json
config=Path("android/app/google-services.json")
data=json.loads(config.read_text())
packages=[a.get("client_info",{}).get("android_client_info",{}).get("package_name") for a in data.get("client",[])]
if "nl.mingle.app" not in packages:
 raise SystemExit("Firebase config does not contain Android package nl.mingle.app")
project=Path("android/build.gradle")
source=project.read_text()
plugin="classpath 'com.google.gms:google-services:4.4.2'"
if plugin not in source:
 source=source.replace("dependencies {","dependencies {\n        "+plugin,1)
project.write_text(source)
app=Path("android/app/build.gradle")
source=app.read_text()
line="apply plugin: 'com.google.gms.google-services'"
if line not in source: source+="\n"+line+"\n"
app.write_text(source)
print("Firebase Android configuration enabled")
