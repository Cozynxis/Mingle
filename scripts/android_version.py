"""Set a stable, explicit Android version for the consolidated Mingle test APK."""
from pathlib import Path
import re
p=Path("android/app/build.gradle")
source=p.read_text()
source,count=re.subn(r"\bversionCode\s+\d+", "versionCode 13", source, count=1)
if count != 1: raise SystemExit("Could not set Android versionCode")
source,count=re.subn(r'\bversionName\s+"[^"]+"', 'versionName "2.0.1"', source, count=1)
if count != 1: raise SystemExit("Could not set Android versionName")
p.write_text(source)
print("Android versionCode=13, versionName=2.0.1")
