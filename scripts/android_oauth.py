from pathlib import Path
from xml.etree import ElementTree as ET

path = Path("android/app/src/main/AndroidManifest.xml")
ET.register_namespace("android", "http://schemas.android.com/apk/res/android")
ns = "{http://schemas.android.com/apk/res/android}"
tree = ET.parse(path)
root = tree.getroot()
application = root.find("application")
if application is None:
    raise RuntimeError("Missing Android application manifest")
activity = next((a for a in application.findall("activity") if a.get(ns+"name") in (".MainActivity","nl.mingle.app.MainActivity")),None)
if activity is None:
    raise RuntimeError("Missing Capacitor MainActivity")
filter_ = ET.SubElement(activity,"intent-filter")
ET.SubElement(filter_,"action",{ns+"name":"android.intent.action.VIEW"})
ET.SubElement(filter_,"category",{ns+"name":"android.intent.category.DEFAULT"})
ET.SubElement(filter_,"category",{ns+"name":"android.intent.category.BROWSABLE"})
ET.SubElement(filter_,"data",{ns+"scheme":"mingle",ns+"host":"auth",ns+"path":"/callback"})
tree.write(path,encoding="utf-8",xml_declaration=True)
