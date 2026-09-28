"""Rewrite an APK so every stored (uncompressed) entry starts on a 4-byte boundary, like zipalign."""
import sys, zipfile
src, dst = sys.argv[1], sys.argv[2]
zin = zipfile.ZipFile(src)
with zipfile.ZipFile(dst, 'w') as zout:
    for info in zin.infolist():
        data = zin.read(info.filename)
        ni = zipfile.ZipInfo(info.filename, date_time=(2026, 1, 1, 0, 0, 0))
        ni.compress_type = info.compress_type
        ni.external_attr = info.external_attr
        if ni.compress_type == zipfile.ZIP_STORED:
            start = zout.fp.tell() + 30 + len(ni.filename.encode())
            ni.extra = b'\0' * ((-start) % 4)
        zout.writestr(ni, data)
