#!/usr/bin/env node
/**
 * Zero-npm-dependency standalone Android APK builder (`releases/viastela-android.apk`).
 * Uses `$ANDROID_HOME` (`aapt2`, `javac`, `d8`, `zipalign`, `apksigner`, `keytool`)
 * to package `releases/viastela-web-pwa.zip` into a native offline Android WebView APK
 * (`assets/webbundle.bin`, preserving `_expo/` JS bundles intact) with the Black-Gold icon.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RELEASES_DIR = path.join(ROOT, 'releases');

function readDisplayName() {
  const brandSrc = readFileSync(path.join(ROOT, 'src', 'config', 'brand.ts'), 'utf8');
  const match = brandSrc.match(/displayName:\s*'([^']+)'/);
  return match ? match[1] : 'App';
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
  const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || '';
  const buildToolsDir = findBuildToolsDir(path.join(androidHome, 'build-tools'));
  const platformDir = findPlatformDir(path.join(androidHome, 'platforms'));

  if (!buildToolsDir || !platformDir) {
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
  // Store as webbundle.bin so aapt2 never strips `_expo/` directories
  cpSync(webZip, path.join(assetsDir, 'webbundle.bin'));
  cpSync(path.join(ROOT, 'assets', 'icon.png'), path.join(resDir, 'mipmap-xxxhdpi', 'ic_launcher.png'));

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
    android:versionCode="100"
    android:versionName="1.0.0">
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
        wwwRoot = new File(getFilesDir(), "www-v1");
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
            window.setStatusBarColor(Color.parseColor("#171512"));
            window.setNavigationBarColor(Color.parseColor("#171512"));
        }

        webView = new WebView(this);
        webView.setBackgroundColor(Color.parseColor("#171512"));
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

  const finalApk = path.join(RELEASES_DIR, 'viastela-android.apk');
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
