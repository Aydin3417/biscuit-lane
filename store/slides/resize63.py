"""The same slides at the size App Store Connect now asks for first.

    python store/slides/resize63.py        ->  store/slides/screenshots/<lang>/phone63/

On 31 Oct 2026 App Store Connect's required iPhone slot was "iPhone with
Dynamic Island (medium display)", which takes 1206 x 2622 and refuses
the 1320 x 2868 the slides render at; the 6.9" slot had become optional.
The two sizes differ in aspect by six hundredths of a percent, so a plain
resize is exact enough: these go in the required slot, the originals in
the optional large-display slot, and each locale carries both.
"""
import glob, os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
for lang in ("en", "tr"):
    src = sorted(glob.glob(os.path.join(HERE, "screenshots", lang, "phone", "0*.png")))
    out = os.path.join(HERE, "screenshots", lang, "phone63")
    os.makedirs(out, exist_ok=True)
    for f in src:
        Image.open(f).convert("RGB").resize((1206, 2622), Image.LANCZOS).save(os.path.join(out, os.path.basename(f)))
    print(lang, len(src), "->", out)
