#!/usr/bin/env node
/**
 * Zero-npm-dependency standalone Android APK builder (`releases/viastela-android.apk`).
 * Uses `$ANDROID_HOME` (`aapt2`, `javac`, `d8`, `zipalign`, `apksigner`, `keytool`)
 * to package the exported web bundle (`dist/` or `releases/viastela-web-pwa.zip`)
 * into a native offline Android WebView APK with the Black-Gold Astrolabe icon.
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

function findLatestSubdir(parentDir) {
  if (!existsSync(parentDir)) return null;
  const entries = readdirSync(parentDir).sort();
  return entries.length > 0 ? path.join(parentDir, entries[entries.length - 1]) : null;
}

function main() {
  const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || '';
  const buildToolsDir = findLatestSubdir(path.join(androidHome, 'build-tools'));
  const platformDir = findLatestSubdir(path.join(androidHome, 'platforms'));

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
  const assetsWebDir = path.join(workDir, 'assets', 'www');
  const classesDir = path.join(workDir, 'classes');

  mkdirSync(srcDir, { recursive: true });
  mkdirSync(path.join(resDir, 'mipmap-xxxhdpi'), { recursive: true });
  mkdirSync(path.join(resDir, 'values'), { recursive: true });
  mkdirSync(assetsWebDir, { recursive: true });
  mkdirSync(classesDir, { recursive: true });
  mkdirSync(RELEASES_DIR, { recursive: true });

  // Populate web assets from dist/ or releases/viastela-web-pwa.zip
  const distDir = path.join(ROOT, 'dist');
  const webZip = path.join(RELEASES_DIR, 'viastela-web-pwa.zip');
  if (existsSync(distDir)) {
    cpSync(distDir, assetsWebDir, { recursive: true });
  } else if (existsSync(webZip)) {
    execFileSync('unzip', ['-q', webZip, '-d', assetsWebDir], { stdio: 'inherit' });
  } else {
    throw new Error('Neither dist/ nor releases/viastela-web-pwa.zip found.');
  }

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
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

public class MainActivity extends Activity {
    private WebView webView;

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
                    String assetPath = "www" + relPath;
                    try {
                        InputStream is = getAssets().open(assetPath);
                        Map<String, String> headers = new HashMap<>();
                        headers.put("Access-Control-Allow-Origin", "*");
                        return new WebResourceResponse(guessMime(assetPath), "UTF-8", 200, "OK", headers, is);
                    } catch (Exception e) {
                        try {
                            InputStream htmlIs = getAssets().open("www" + relPath + ".html");
                            return new WebResourceResponse("text/html", "UTF-8", 200, "OK", new HashMap<String, String>(), htmlIs);
                        } catch (Exception e2) {
                            try {
                                InputStream rootIs = getAssets().open("www/index.html");
                                return new WebResourceResponse("text/html", "UTF-8", 200, "OK", new HashMap<String, String>(), rootIs);
                            } catch (Exception ignored) {}
                        }
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
      path.join(workDir, 'assets'),
      compiledResZip,
    ],
    { stdio: 'inherit' },
  );

  execFileSync(
    'javac',
    [
      '--release',
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
