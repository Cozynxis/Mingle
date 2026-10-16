"""Configure Capacitor Android's generated Gradle project for signed release builds.
The keystore is provided by GitHub Actions secrets, never committed.
"""
from pathlib import Path

p=Path("android/app/build.gradle")
source=p.read_text()
if "mingleReleaseSigning" in source:
    raise SystemExit("Signing configuration already present")
marker="android {"
if marker not in source:
    raise SystemExit("Unsupported Capacitor Gradle template: android block missing")
signing="""android {
    signingConfigs {
        mingleReleaseSigning {
            storeFile file(System.getenv("MINGLE_KEYSTORE_FILE"))
            storePassword System.getenv("MINGLE_KEYSTORE_PASSWORD")
            keyAlias System.getenv("MINGLE_KEY_ALIAS")
            keyPassword System.getenv("MINGLE_KEY_PASSWORD")
        }
    }
"""
source=source.replace(marker,signing,1)
release_marker="release {"
if release_marker not in source:
    raise SystemExit("Unsupported Capacitor Gradle template: release block missing")
source=source.replace(release_marker,"release {\n            signingConfig signingConfigs.mingleReleaseSigning",1)
p.write_text(source)
print("Release signing configured (credentials remain in environment).")
