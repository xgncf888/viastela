#!/usr/bin/env python3
"""Rebuild the web serif subset from the pinned Noto Serif CJK release.

The source font is not committed. This script downloads the official
notofonts Serif 2.003 Simplified Chinese zip, checks sha256, and writes:

  public/fonts/viastela-serif-600.v1.woff2
  public/fonts/OFL.txt

Glyphs come from src/ui/serif-glyphs.ts. Needs fontTools with woff2
(brotli). Fails if the subset is larger than 200 KiB.
"""

from __future__ import annotations

import hashlib
import io
import re
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[2]
GLYPH_FILE = ROOT / "src/ui/serif-glyphs.ts"
OUT_FONT = ROOT / "public/fonts/viastela-serif-600.v1.woff2"
OUT_LICENSE = ROOT / "public/fonts/OFL.txt"

RELEASE = "Serif2.003"
ZIP_URL = f"https://github.com/notofonts/noto-cjk/releases/download/{RELEASE}/09_NotoSerifCJKsc.zip"
ZIP_SHA256 = "4bcdbff95cedfb6a4c0640403f0de8b69480d869331c24c8eff91f7bb834df04"
OTF_NAME = "OTF/SimplifiedChinese/NotoSerifCJKsc-SemiBold.otf"
OTF_SHA256 = "d627b53dbcde61e07de1498d2623a8b287f78585ffbc90cc0618d0caaa2ed6b0"
LICENSE_NAME = "LICENSE"
LICENSE_SHA256 = "6a73f9541c2de74158c0e7cf6b0a58ef774f5a780bf191f2d7ec9cc53efe2bf2"
# Name ID 0 of the SemiBold face. The upstream LICENSE file does not repeat it.
COPYRIGHT = "© 2017-2024 Adobe (http://www.adobe.com/).\n\n"
MAX_BYTES = 200 * 1024


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def read_glyphs() -> str:
    text = GLYPH_FILE.read_text(encoding="utf-8")
    match = re.search(r"export const SERIF_GLYPHS =\s+'([^']+)'", text)
    if not match:
        raise SystemExit(f"SERIF_GLYPHS missing in {GLYPH_FILE}")
    glyphs = match.group(1)
    if len(glyphs) != 46 or len(set(glyphs)) != 46:
        raise SystemExit(f"expected 46 unique glyphs, found {len(glyphs)} / {len(set(glyphs))}")
    return glyphs


def download_zip() -> bytes:
    with urlopen(ZIP_URL) as response:
        data = response.read()
    digest = sha256(data)
    if digest != ZIP_SHA256:
        raise SystemExit(f"zip sha256 {digest} != {ZIP_SHA256}")
    return data


def subset(otf_path: Path, glyphs: str, dest: Path) -> None:
    unicodes = ",".join(f"U+{ord(char):04X}" for char in sorted(set(glyphs)))
    subprocess.check_call(
        [
            sys.executable,
            "-m",
            "fontTools.subset",
            str(otf_path),
            f"--unicodes={unicodes}",
            "--layout-features=",
            "--flavor=woff2",
            "--no-hinting",
            "--desubroutinize",
            "--drop-tables+=GSUB,GPOS,GDEF,BASE,VORG,vhea,vmtx,DSIG",
            f"--output-file={dest}",
        ]
    )


def check_cmap(font_path: Path, glyphs: str) -> None:
    from fontTools.ttLib import TTFont

    font = TTFont(font_path)
    found = "".join(chr(code) for code in sorted(font.getBestCmap()))
    expected = "".join(sorted(set(glyphs)))
    if found != expected:
        raise SystemExit(f"cmap mismatch\n found {found}\n want  {expected}")
    if font["OS/2"].usWeightClass != 600:
        raise SystemExit(f"expected weight 600, found {font['OS/2'].usWeightClass}")


def main() -> None:
    glyphs = read_glyphs()
    payload = download_zip()
    with zipfile.ZipFile(io.BytesIO(payload)) as archive:
        otf = archive.read(OTF_NAME)
        license_text = archive.read(LICENSE_NAME)
    if sha256(otf) != OTF_SHA256:
        raise SystemExit(f"otf sha256 {sha256(otf)} != {OTF_SHA256}")
    if sha256(license_text) != LICENSE_SHA256:
        raise SystemExit(f"license sha256 {sha256(license_text)} != {LICENSE_SHA256}")
    OUT_FONT.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        otf_path = Path(tmp) / "NotoSerifCJKsc-SemiBold.otf"
        otf_path.write_bytes(otf)
        subset(otf_path, glyphs, OUT_FONT)
    size = OUT_FONT.stat().st_size
    if size > MAX_BYTES:
        OUT_FONT.unlink(missing_ok=True)
        raise SystemExit(f"subset is {size} bytes, over the {MAX_BYTES} byte cap")
    check_cmap(OUT_FONT, glyphs)
    notice = COPYRIGHT + license_text.decode("utf-8")
    if not notice.endswith("\n"):
        notice += "\n"
    OUT_LICENSE.write_text(notice, encoding="utf-8")
    print(f"wrote {OUT_FONT.relative_to(ROOT)} ({size} bytes) and {OUT_LICENSE.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
