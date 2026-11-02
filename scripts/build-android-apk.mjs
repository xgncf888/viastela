#!/usr/bin/env node
/**
 * Zero-npm-dependency standalone Android APK builder (`releases/viastela-android.apk`).
 * - When `$ANDROID_HOME` is available, compiles from Java/XML source using `aapt2`/`javac`/`d8`/`zipalign`/`apksigner`.
 * - When `$ANDROID_HOME` is not installed on this machine, repackages the prebuilt APK shell with the latest
 *   `releases/viastela-web-pwa.zip` (`assets/webbundle.bin`), the full-bleed Black-Gold Astrolabe Crest icon
 *   (`res/mipmap-xxxhdpi-v4/ic_launcher.png`), 4-byte `zipalign`, and APK Signature Scheme v1 & v2 signing!
 */
import { execFileSync } from 'node:child_process';
import crypto, { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RELEASES_DIR = path.join(ROOT, 'releases');

function readDisplayName() {
  const brandSrc = readFileSync(path.join(ROOT, 'src', 'config', 'brand.ts'), 'utf8');
  const match = brandSrc.match(/displayName:\s*'([^']+)'/);
  return match ? match[1] : 'App';
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC32_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function lengthPrefixed(buf) {
  const len = Buffer.alloc(4);
  len.writeUInt32LE(buf.length, 0);
  return Buffer.concat([len, buf]);
}

function computeApkV2OneMbChunkDigest(sections) {
  const CHUNK_SIZE = 1024 * 1024;
  const chunkDigests = [];
  for (const section of sections) {
    let offset = 0;
    while (offset < section.length) {
      const end = Math.min(offset + CHUNK_SIZE, section.length);
      const chunk = section.subarray(offset, end);
      const header = Buffer.alloc(5);
      header[0] = 0xa5;
      header.writeUInt32LE(chunk.length, 1);
      const digest = createHash('sha256').update(header).update(chunk).digest();
      chunkDigests.push(digest);
      offset = end;
    }
  }
  const topHeader = Buffer.alloc(5);
  topHeader[0] = 0x5a;
  topHeader.writeUInt32LE(chunkDigests.length, 1);
  return createHash('sha256')
    .update(topHeader)
    .update(Buffer.concat(chunkDigests))
    .digest();
}

function buildZipAlignedAndV2SignedApk(entries, keyPem, certDer, spkiDer) {
  const localParts = [];
  const centralParts = [];
  let currentOffset = 0;

  for (const item of entries) {
    const nameBuf = Buffer.from(item.name, 'utf8');
    const rawData = item.data;
    const uncompressedSize = rawData.length;
    const fileCrc = crc32(rawData);
    const storeUncompressed = Boolean(item.store);
    const compressedData = storeUncompressed ? rawData : zlib.deflateRawSync(rawData, { level: 6 });
    const compressionMethod = storeUncompressed ? 0 : 8;

    let extraLen = 0;
    if (storeUncompressed) {
      const dataStartWithoutExtra = currentOffset + 30 + nameBuf.length;
      const remainder = dataStartWithoutExtra % 4;
      if (remainder !== 0) {
        extraLen = 4 - remainder;
      }
    }
    const extraBuf = Buffer.alloc(extraLen, 0);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(compressionMethod, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0x21, 12);
    localHeader.writeUInt32LE(fileCrc, 14);
    localHeader.writeUInt32LE(compressedData.length, 18);
    localHeader.writeUInt32LE(uncompressedSize, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(extraBuf.length, 28);

    const localEntryOffset = currentOffset;
    localParts.push(localHeader, nameBuf, extraBuf, compressedData);
    currentOffset += localHeader.length + nameBuf.length + extraBuf.length + compressedData.length;

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(compressionMethod, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0x21, 14);
    centralHeader.writeUInt32LE(fileCrc, 16);
    centralHeader.writeUInt32LE(compressedData.length, 20);
    centralHeader.writeUInt32LE(uncompressedSize, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(localEntryOffset, 42);

    centralParts.push(centralHeader, nameBuf);
  }

  const beforeCentralDir = Buffer.concat(localParts);
  const centralDir = Buffer.concat(centralParts);
  const originalCentralDirOffset = beforeCentralDir.length;

  const eocdForDigest = Buffer.alloc(22);
  eocdForDigest.writeUInt32LE(0x06054b50, 0);
  eocdForDigest.writeUInt16LE(0, 4);
  eocdForDigest.writeUInt16LE(0, 6);
  eocdForDigest.writeUInt16LE(entries.length, 8);
  eocdForDigest.writeUInt16LE(entries.length, 10);
  eocdForDigest.writeUInt32LE(centralDir.length, 12);
  eocdForDigest.writeUInt32LE(originalCentralDirOffset, 16);
  eocdForDigest.writeUInt16LE(0, 20);

  const topDigest = computeApkV2OneMbChunkDigest([beforeCentralDir, centralDir, eocdForDigest]);
  const algIdBuf = Buffer.alloc(4);
  algIdBuf.writeUInt32LE(0x0103, 0);

  const digestEntry = lengthPrefixed(Buffer.concat([algIdBuf, lengthPrefixed(topDigest)]));
  const digestsSeq = lengthPrefixed(digestEntry);
  const certsSeq = lengthPrefixed(lengthPrefixed(certDer));
  const emptyAttrs = Buffer.alloc(4, 0);
  const signedData = Buffer.concat([digestsSeq, certsSeq, emptyAttrs]);

  const signatureBytes = crypto.sign('sha256', signedData, keyPem);
  const sigEntry = lengthPrefixed(Buffer.concat([algIdBuf, lengthPrefixed(signatureBytes)]));
  const signaturesSeq = lengthPrefixed(sigEntry);

  const signerBlock = Buffer.concat([
    lengthPrefixed(signedData),
    signaturesSeq,
    lengthPrefixed(spkiDer),
  ]);
  const v2BlockValue = lengthPrefixed(lengthPrefixed(signerBlock));

  const v2IdBuf = Buffer.alloc(4);
  v2IdBuf.writeUInt32LE(0x7109871a, 0);
  const v2PairPayload = Buffer.concat([v2IdBuf, v2BlockValue]);
  const v2PairLen = Buffer.alloc(8);
  v2PairLen.writeBigUInt64LE(BigInt(v2PairPayload.length), 0);
  const v2Pair = Buffer.concat([v2PairLen, v2PairPayload]);

  const blockValueSize = BigInt(v2Pair.length + 8 + 16);
  const sizeLeading = Buffer.alloc(8);
  sizeLeading.writeBigUInt64LE(blockValueSize, 0);
  const sizeTrailing = Buffer.alloc(8);
  sizeTrailing.writeBigUInt64LE(blockValueSize, 0);
  const magic = Buffer.from('APK Sig Block 42', 'ascii');

  const apkSigningBlock = Buffer.concat([sizeLeading, v2Pair, sizeTrailing, magic]);

  const finalEocd = Buffer.from(eocdForDigest);
  finalEocd.writeUInt32LE(originalCentralDirOffset + apkSigningBlock.length, 16);

  return Buffer.concat([beforeCentralDir, apkSigningBlock, centralDir, finalEocd]);
}

function repackageExistingApkWithLatestWebBundleAndIcon(apkPath) {
  const webZip = path.join(RELEASES_DIR, 'viastela-web-pwa.zip');
  const icon512 = path.join(ROOT, 'public', 'icons', 'icon-512.png');
  if (!existsSync(apkPath) || !existsSync(webZip)) return false;

  const apkWorkDir = mkdtempSync(path.join(os.tmpdir(), 'viastela-apk-repack-'));
  try {
    const unpackDir = path.join(apkWorkDir, 'unpacked');
    mkdirSync(unpackDir, { recursive: true });
    execFileSync('unzip', ['-q', apkPath, '-d', unpackDir]);
    rmSync(path.join(unpackDir, 'META-INF'), { recursive: true, force: true });

    // Inject latest web bundle
    const webBundleDest = path.join(unpackDir, 'assets', 'webbundle.bin');
    mkdirSync(path.dirname(webBundleDest), { recursive: true });
    cpSync(webZip, webBundleDest);

    // Inject updated full-bleed Black-Gold Astrolabe icon into all mipmap launcher slots
    if (existsSync(icon512)) {
      const mipmapDirs = ['mipmap-xxxhdpi-v4', 'mipmap-xxxhdpi'];
      for (const dirName of mipmapDirs) {
        const slot = path.join(unpackDir, 'res', dirName, 'ic_launcher.png');
        if (existsSync(path.dirname(slot))) {
          cpSync(icon512, slot);
        }
      }
    }

    const listAllFiles = (dir, prefix = '') => {
      const out = [];
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (rel.startsWith('META-INF')) continue;
        if (entry.isDirectory()) {
          out.push(...listAllFiles(path.join(dir, entry.name), rel));
        } else {
          out.push(rel);
        }
      }
      return out;
    };

    const payloadRelPaths = listAllFiles(unpackDir).sort();
    const metaInfDir = path.join(unpackDir, 'META-INF');
    mkdirSync(metaInfDir, { recursive: true });
    const mfLines = ['Manifest-Version: 1.0', 'Created-By: App Bundler', ''];
    const sfSections = [];

    for (const relPath of payloadRelPaths) {
      const fileBytes = readFileSync(path.join(unpackDir, relPath));
      const digestB64 = createHash('sha256').update(fileBytes).digest('base64');
      const section = `Name: ${relPath}\r\nSHA-256-Digest: ${digestB64}\r\n\r\n`;
      mfLines.push(`Name: ${relPath}`, `SHA-256-Digest: ${digestB64}`, '');
      const secDigestB64 = createHash('sha256').update(Buffer.from(section, 'utf8')).digest('base64');
      sfSections.push(`Name: ${relPath}`, `SHA-256-Digest: ${secDigestB64}`, '');
    }

    const mfContent = mfLines.join('\r\n') + '\r\n';
    writeFileSync(path.join(metaInfDir, 'MANIFEST.MF'), mfContent, 'utf8');
    const mfFullDigestB64 = createHash('sha256').update(Buffer.from(mfContent, 'utf8')).digest('base64');
    const sfContent = [
      'Signature-Version: 1.0',
      'Created-By: App Bundler',
      `SHA-256-Digest-Manifest: ${mfFullDigestB64}`,
      '',
      ...sfSections,
    ].join('\r\n') + '\r\n';
    const sfPath = path.join(metaInfDir, 'VIASTELA.SF');
    writeFileSync(sfPath, sfContent, 'utf8');

    const keyPemPath = path.join(apkWorkDir, 'key.pem');
    const certPemPath = path.join(apkWorkDir, 'cert.pem');
    const certDerPath = path.join(apkWorkDir, 'cert.der');
    const rsaPath = path.join(metaInfDir, 'VIASTELA.RSA');
    execFileSync(
      'openssl',
      [
        'req',
        '-x509',
        '-newkey',
        'rsa:2048',
        '-nodes',
        '-keyout',
        keyPemPath,
        '-out',
        certPemPath,
        '-days',
        '10000',
        '-subj',
        '/CN=App/OU=Studio/O=App/L=SG/C=SG',
      ],
      { stdio: 'ignore' },
    );
    execFileSync('openssl', ['x509', '-in', certPemPath, '-outform', 'DER', '-out', certDerPath], {
      stdio: 'ignore',
    });
    execFileSync(
      'openssl',
      [
        'smime',
        '-sign',
        '-in',
        sfPath,
        '-signer',
        certPemPath,
        '-inkey',
        keyPemPath,
        '-outform',
        'DER',
        '-binary',
        '-noattr',
        '-md',
        'sha256',
        '-out',
        rsaPath,
      ],
      { stdio: 'ignore' },
    );

    const keyPem = readFileSync(keyPemPath, 'utf8');
    const certDer = readFileSync(certDerPath);
    const spkiDer = crypto.createPublicKey(keyPem).export({ type: 'spki', format: 'der' });

    const allRelPaths = [...payloadRelPaths, 'META-INF/MANIFEST.MF', 'META-INF/VIASTELA.SF', 'META-INF/VIASTELA.RSA'];
    const zipEntries = allRelPaths.map((relPath) => ({
      name: relPath,
      data: readFileSync(path.join(unpackDir, relPath)),
      store: relPath === 'resources.arsc' || relPath === 'assets/webbundle.bin' || relPath.endsWith('.png'),
    }));

    const signedApkBuffer = buildZipAlignedAndV2SignedApk(zipEntries, keyPem, certDer, spkiDer);
    writeFileSync(apkPath, signedApkBuffer);
    console.log(`Updated & v1+v2 signed Android APK with latest web bundle & Black-Gold icon: ${apkPath}`);
    return true;
  } finally {
    rmSync(apkWorkDir, { recursive: true, force: true });
  }
}

function findBuildToolsDir(parentDir) {
  if (!existsSync(parentDir)) return null;
  const entries = readdirSync(parentDir)
    .filter((e) => /^\d+\.\d+\.\d+$/.test(e))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return entries.length > 0 ? path.join(parentDir, entries[entries.length - 1]) : null;
}

function findPlatformDir(parentDir) {
  if (!existsSync(parentDir)) return null;
  const entries = readdirSync(parentDir)
    .filter((e) => /^android-\d+$/.test(e))
    .sort((a, b) => Number(a.split('-')[1]) - Number(b.split('-')[1]));
  if (entries.length === 0) return null;
  const preferred = entries.find((e) => e === 'android-34') || entries[entries.length - 1];
  return path.join(parentDir, preferred);
}

function main() {
  const finalApk = path.join(RELEASES_DIR, 'viastela-android.apk');
  const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || '';
  const buildToolsDir = findBuildToolsDir(path.join(androidHome, 'build-tools'));
  const platformDir = findPlatformDir(path.join(androidHome, 'platforms'));

  if (!buildToolsDir || !platformDir) {
    if (repackageExistingApkWithLatestWebBundleAndIcon(finalApk)) return;
    console.log('Skipping local Android APK build (ANDROID_HOME build-tools/platforms not installed on this machine).');
    return;
  }

  const displayName = readDisplayName();
  const aapt2 = path.join(buildToolsDir, 'aapt2');
  const d8 = path.join(buildToolsDir, 'd8');
  const zipalign = path.join(buildToolsDir, 'zipalign');
  const apksigner = path.join(buildToolsDir, 'apksigner');
  const androidJar = path.join(platformDir, 'android.jar');

  const workDir = path.join(os.tmpdir(), `viastela-apk-${Date.now()}`);
  const srcDir = path.join(workDir, 'src', 'app', 'viastela');
  const resDir = path.join(workDir, 'res');
  const assetsDir = path.join(workDir, 'assets');
  const classesDir = path.join(workDir, 'classes');

  mkdirSync(srcDir, { recursive: true });
  mkdirSync(path.join(resDir, 'mipmap-xxxhdpi'), { recursive: true });
  mkdirSync(path.join(resDir, 'values'), { recursive: true });
  mkdirSync(assetsDir, { recursive: true });
  mkdirSync(classesDir, { recursive: true });
  mkdirSync(RELEASES_DIR, { recursive: true });

  const webZip = path.join(RELEASES_DIR, 'viastela-web-pwa.zip');
  if (!existsSync(webZip)) {
    throw new Error('releases/viastela-web-pwa.zip not found.');
  }
  cpSync(webZip, path.join(assetsDir, 'webbundle.bin'));
  cpSync(path.join(ROOT, 'public', 'icons', 'icon-512.png'), path.join(resDir, 'mipmap-xxxhdpi', 'ic_launcher.png'));

  writeFileSync(
    path.join(resDir, 'values', 'strings.xml'),
    `<?xml version="1.0" encoding="utf-8"?>
<resources>
  <string name="app_name">${displayName}</string>
</resources>
`,
    'utf8',
  );

  const manifestXml = path.join(workDir, 'AndroidManifest.xml');
  writeFileSync(
    manifestXml,
    `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="app.viastela"
    android:versionCode="101"
    android:versionName="1.0.1">
  <uses-sdk android:minSdkVersion="24" android:targetSdkVersion="34" />
  <uses-permission android:name="android.permission.INTERNET" />
  <application
      android:label="@string/app_name"
      android:icon="@mipmap/ic_launcher"
      android:usesCleartextTraffic="true"
      android:hardwareAccelerated="true"
      android:theme="@android:style/Theme.DeviceDefault.NoActionBar">
    <activity
        android:name="app.viastela.MainActivity"
        android:exported="true"
        android:configChanges="orientation|screenSize|keyboardHidden|smallestScreenSize|screenLayout">
      <intent-filter>
        <action android:name="android.intent.action.MAIN" />
        <category android:name="android.intent.category.LAUNCHER" />
      </intent-filter>
    </activity>
  </application>
</manifest>
`,
    'utf8',
  );

  writeFileSync(
    path.join(srcDir, 'MainActivity.java'),
    `package app.viastela;

import android.app.Activity;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.Window;
import android.webkit.MimeTypeMap;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

public class MainActivity extends Activity {
    private WebView webView;
    private File wwwRoot;

    private void ensureWebBundleExtracted() {
        wwwRoot = new File(getFilesDir(), "www-v2");
        File indexHtml = new File(wwwRoot, "index.html");
        if (indexHtml.exists()) return;
        try (InputStream raw = getAssets().open("webbundle.bin");
             ZipInputStream zis = new ZipInputStream(raw)) {
            ZipEntry entry;
            byte[] buf = new byte[8192];
            while ((entry = zis.getNextEntry()) != null) {
                File out = new File(wwwRoot, entry.getName());
                if (entry.isDirectory()) {
                    out.mkdirs();
                } else {
                    File parent = out.getParentFile();
                    if (parent != null) parent.mkdirs();
                    try (FileOutputStream fos = new FileOutputStream(out)) {
                        int n;
                        while ((n = zis.read(buf)) > 0) {
                            fos.write(buf, 0, n);
                        }
                    }
                }
                zis.closeEntry();
            }
        } catch (Exception ignored) {}
    }

    private static String guessMime(String path) {
        if (path.endsWith(".html")) return "text/html";
        if (path.endsWith(".js") || path.endsWith(".mjs")) return "application/javascript";
        if (path.endsWith(".css")) return "text/css";
        if (path.endsWith(".json") || path.endsWith(".webmanifest")) return "application/json";
        if (path.endsWith(".svg")) return "image/svg+xml";
        if (path.endsWith(".png")) return "image/png";
        if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
        if (path.endsWith(".woff2")) return "font/woff2";
        if (path.endsWith(".ttf")) return "font/ttf";
        String ext = MimeTypeMap.getFileExtensionFromUrl(path);
        String mime = MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext);
        return mime != null ? mime : "application/octet-stream";
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        ensureWebBundleExtracted();

        Window window = getWindow();
        if (window != null) {
            window.setStatusBarColor(Color.parseColor("#121110"));
            window.setNavigationBarColor(Color.parseColor("#121110"));
        }

        webView = new WebView(this);
        webView.setBackgroundColor(Color.parseColor("#121110"));
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (uri != null && "appassets.androidplatform.net".equals(uri.getHost())) {
                    String relPath = uri.getPath();
                    if (relPath == null || relPath.isEmpty() || "/".equals(relPath)) {
                        relPath = "/index.html";
                    }
                    File target = new File(wwwRoot, relPath.startsWith("/") ? relPath.substring(1) : relPath);
                    if (!target.exists() || target.isDirectory()) {
                        File htmlCandidate = new File(wwwRoot, (relPath.startsWith("/") ? relPath.substring(1) : relPath) + ".html");
                        if (htmlCandidate.exists()) {
                            target = htmlCandidate;
                        } else {
                            target = new File(wwwRoot, "index.html");
                        }
                    }
                    if (target.exists() && target.isFile()) {
                        try {
                            InputStream is = new FileInputStream(target);
                            Map<String, String> headers = new HashMap<>();
                            headers.put("Access-Control-Allow-Origin", "*");
                            return new WebResourceResponse(guessMime(target.getName()), "UTF-8", 200, "OK", headers, is);
                        } catch (Exception ignored) {}
                    }
                }
                return super.shouldInterceptRequest(view, request);
            }
        });

        setContentView(webView);
        webView.loadUrl("https://appassets.androidplatform.net/index.html");
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
`,
    'utf8',
  );

  const compiledResZip = path.join(workDir, 'compiled-res.zip');
  execFileSync(aapt2, ['compile', '--dir', resDir, '-o', compiledResZip], { stdio: 'inherit' });

  const unsignedApk = path.join(workDir, 'unaligned.apk');
  execFileSync(
    aapt2,
    [
      'link',
      '-o',
      unsignedApk,
      '-I',
      androidJar,
      '--manifest',
      manifestXml,
      '--java',
      path.join(workDir, 'src'),
      '-A',
      assetsDir,
      '-0',
      '.bin',
      compiledResZip,
    ],
    { stdio: 'inherit' },
  );

  execFileSync(
    'javac',
    [
      '-source',
      '11',
      '-target',
      '11',
      '-cp',
      androidJar,
      '-d',
      classesDir,
      path.join(srcDir, 'MainActivity.java'),
      path.join(srcDir, 'R.java'),
    ],
    { stdio: 'inherit' },
  );

  const classFiles = readdirSync(path.join(classesDir, 'app', 'viastela')).map((f) =>
    path.join(classesDir, 'app', 'viastela', f),
  );
  execFileSync(d8, ['--lib', androidJar, '--output', workDir, ...classFiles], { stdio: 'inherit' });

  execFileSync('zip', ['-j', unsignedApk, path.join(workDir, 'classes.dex')], { stdio: 'inherit' });

  const alignedApk = path.join(workDir, 'aligned.apk');
  execFileSync(zipalign, ['-f', '4', unsignedApk, alignedApk], { stdio: 'inherit' });

  const keystorePath = path.join(workDir, 'release.keystore');
  execFileSync(
    'keytool',
    [
      '-genkeypair',
      '-v',
      '-keystore',
      keystorePath,
      '-alias',
      'viastela',
      '-keyalg',
      'RSA',
      '-keysize',
      '2048',
      '-validity',
      '10000',
      '-storepass',
      'viastela123',
      '-keypass',
      'viastela123',
      '-dname',
      'CN=App, OU=Engineering, O=Studio, L=SG, S=SG, C=SG',
    ],
    { stdio: 'inherit' },
  );

  execFileSync(
    apksigner,
    [
      'sign',
      '--ks',
      keystorePath,
      '--ks-pass',
      'pass:viastela123',
      '--key-pass',
      'pass:viastela123',
      '--out',
      finalApk,
      alignedApk,
    ],
    { stdio: 'inherit' },
  );

  rmSync(workDir, { recursive: true, force: true });
  console.log(`Built signed Android APK: ${finalApk}`);
}

main();
