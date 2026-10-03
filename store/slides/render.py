"""Photograph store/slides/slides.html into App Store screenshots.

    python store/slides/render.py            both languages, iPhone
    python store/slides/render.py en phone   one set
    python store/slides/render.py pad        the iPad set, if the app ever
                                             targets iPad again

Out: store/slides/screenshots/<lang>/<device>/01.png ... 07.png, and a
contact sheet per set beside them.

  phone  440 x 956 at 3x  = 1320 x 2868   (iPhone 6.9", the one size the
                                           App Store asks an iPhone app for)
  pad   1032 x 1376 at 2x = 2064 x 2752   (iPad 13", not needed while the
                                           app is iPhone only)

Before anything is photographed this writes raw/meta.js: for each screen
capture.js took, the colour of its top edge and whether that is dark, so
the status bar drawn above it in the frame continues the screen rather
than sitting on it as a white strip. The app icon is copied in beside it.

Every PNG is flattened to RGB (the App Store refuses an alpha channel)
and checked against the exact size; a wrong one stops the run.
"""
import glob
import json
import os
import shutil
import subprocess
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "raw")
OUT = os.path.join(HERE, "screenshots")
ICON = os.path.join(HERE, "..", "..", "ios", "App", "App", "Assets.xcassets",
                    "AppIcon.appiconset", "AppIcon-512@2x.png")
DEVICES = {
    "phone": {"css": (440, 956), "scale": 3, "px": (1320, 2868)},
    "pad": {"css": (1032, 1376), "scale": 2, "px": (2064, 2752)},
}
BROWSERS = [
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/chromium", "/usr/bin/google-chrome",
]


def browser():
    for b in BROWSERS:
        if os.path.exists(b):
            return b
    sys.exit("no Edge or Chrome found; add its path to BROWSERS")


def prepare():
    """raw/meta.js and raw/icon.png"""
    meta = {}
    for f in sorted(glob.glob(os.path.join(RAW, "*-*-*.png"))):
        name = os.path.splitext(os.path.basename(f))[0]
        if name.startswith("pet-"):
            continue
        im = Image.open(f).convert("RGB")
        w, _ = im.size
        # the top edge, sampled across its width and away from the corners
        pts = [im.getpixel((int(w * k), 3)) for k in (.06, .2, .5, .8, .94)]
        r, g, b = (sorted(p[i] for p in pts)[2] for i in range(3))
        lum = .2126 * r + .7152 * g + .0722 * b
        meta[name] = {"top": "#%02x%02x%02x" % (r, g, b), "dark": lum < 128}
    with open(os.path.join(RAW, "meta.js"), "w", encoding="utf-8", newline="\n") as fh:
        fh.write("window.RAW_META = " + json.dumps(meta, indent=1) + ";\n")
    icon = Image.open(ICON).convert("RGB").resize((204, 204), Image.LANCZOS)
    icon.save(os.path.join(RAW, "icon.png"))
    return meta


def count():
    src = open(os.path.join(HERE, "slides.html"), encoding="utf-8").read()
    return src.count("{ screen: '")


def render(lang, dev):
    d = DEVICES[dev]
    out = os.path.join(OUT, lang, dev)
    os.makedirs(out, exist_ok=True)
    url = "file:///" + os.path.join(HERE, "slides.html").replace("\\", "/")
    profile = os.path.join(HERE, ".render-profile")
    shots = []
    for i in range(1, count() + 1):
        png = os.path.join(out, "%02d.png" % i)
        if os.path.exists(png):
            os.remove(png)
        suffix = "-pad" if dev == "pad" else ""
        subprocess.run([
            browser(), "--headless=new", "--disable-gpu", "--hide-scrollbars",
            "--allow-file-access-from-files", "--no-first-run", "--no-default-browser-check",
            "--user-data-dir=" + profile,
            "--force-device-scale-factor=%d" % d["scale"],
            "--window-size=%d,%d" % d["css"], "--virtual-time-budget=5000",
            "--screenshot=" + png, "%s#%s-%d%s" % (url, lang, i, suffix),
        ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=120)
        im = Image.open(png).convert("RGB")
        if im.size != d["px"]:
            sys.exit("%s is %s, wanted %s" % (png, im.size, d["px"]))
        im.save(png)
        shots.append(im)
        print("  %s/%s/%02d.png  %dx%d" % (lang, dev, i, *im.size))
    # the whole set side by side, the way the store shows it
    tw = 330 if dev == "phone" else 400
    th = round(d["px"][1] * tw / d["px"][0])
    sheet = Image.new("RGB", (tw * len(shots) + 10 * (len(shots) + 1), th + 20), (24, 20, 16))
    for k, im in enumerate(shots):
        sheet.paste(im.resize((tw, th), Image.LANCZOS), (10 + k * (tw + 10), 10))
    sheet.save(os.path.join(OUT, "sheet-%s-%s.png" % (lang, dev)))
    shutil.rmtree(profile, ignore_errors=True)


if __name__ == "__main__":
    langs = [a for a in sys.argv[1:] if a in ("en", "tr")] or ["en", "tr"]
    # the phone unless asked: the app ships for iPhone only
    devs = [a for a in sys.argv[1:] if a in DEVICES] or ["phone"]
    have = prepare()
    for lang in langs:
        for dev in devs:
            if not any(k.startswith(dev + "-" + lang + "-") for k in have):
                print("  no captures for %s %s; run capture.js first" % (lang, dev))
                continue
            print("%s %s" % (lang, dev))
            render(lang, dev)
