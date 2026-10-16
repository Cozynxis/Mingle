"""Generate Android launcher assets from the existing official Mingle SVG logo."""
from pathlib import Path
from io import BytesIO
import cairosvg
from PIL import Image

root=Path("android/app/src/main/res")
svg=Path("public/mingle-logo.svg").read_bytes()
for density,size in [("mdpi",48),("hdpi",72),("xhdpi",96),("xxhdpi",144),("xxxhdpi",192)]:
    folder=root/f"mipmap-{density}"
    folder.mkdir(parents=True,exist_ok=True)
    png=cairosvg.svg2png(bytestring=svg,output_width=size,output_height=size)
    img=Image.open(BytesIO(png)).convert("RGBA")
    img.save(folder/"ic_launcher.png")
    img.save(folder/"ic_launcher_round.png")
    # Capacitor's adaptive icon uses a separate foreground asset.
    canvas=Image.new("RGBA",(size,size),(0,0,0,0))
    inset=round(size*.14)
    logo=img.resize((size-2*inset,size-2*inset),Image.Resampling.LANCZOS)
    canvas.alpha_composite(logo,(inset,inset))
    canvas.save(folder/"ic_launcher_foreground.png")
print("Generated Mingle launcher icons for all Android densities.")
