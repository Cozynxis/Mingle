"""Set a stable, explicit Android version for the consolidated Mingle test APK."""
# MINGLE_UPDATE_TEST_MARKER_1: harmless temporary marker; remove for version 1.2.1.
from pathlib import Path
import re
p=Path("android/app/build.gradle")
source=p.read_text()
source,count=re.subn(r"\bversionCode\s+\d+", "versionCode 3", source, count=1)
if count != 1: raise SystemExit("Could not set Android versionCode")
source,count=re.subn(r'\bversionName\s+"[^"]+"', 'versionName "1.2.0"', source, count=1)
if count != 1: raise SystemExit("Could not set Android versionName")
p.write_text(source)
print("Android versionCode=3, versionName=1.2.0")
