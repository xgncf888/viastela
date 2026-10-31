#!/usr/bin/env node
/**
 * Builds native iOS installation packages into `releases/`:
 * 1. `releases/viastela-ios.mobileconfig`: Direct 1-tap iPhone/iPad Configuration Profile
 *    (installs the Black-Gold Astrolabe icon & full-screen standalone app directly on iOS without jailbreak/AltStore).
 * 2. `releases/viastela-ios-unsigned.ipa`: Native iOS ARM64 `WKWebView` bundle (when Xcode iphoneos SDK is available).
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

function buildMobileConfig(displayName) {
  const iconB64 = readFileSync(path.join(ROOT, 'public', 'icons', 'apple-touch-icon.png')).toString('base64');
  const appUrl = process.env.VIASTELA_WEB_URL || 'https://xgncf888.github.io/viastela/';
  const mobileConfig = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>PayloadContent</key>
  <array>
    <dict>
      <key>FullScreen</key>
      <true/>
      <key>Icon</key>
      <data>${iconB64}</data>
      <key>IgnoreManifestScope</key>
      <true/>
      <key>IsRemovable</key>
      <true/>
      <key>Label</key>
      <string>${displayName}</string>
      <key>PayloadDescription</key>
      <string>Installs ${displayName} Personal Workbench onto the iOS Home Screen</string>
      <key>PayloadDisplayName</key>
      <string>${displayName} WebClip</string>
      <key>PayloadIdentifier</key>
      <string>app.viastela.webclip</string>
      <key>PayloadType</key>
      <string>com.apple.webClip.managed</string>
      <key>PayloadUUID</key>
      <string>8A9D547E-3B2F-4E91-9A11-7C64E8120001</string>
      <key>PayloadVersion</key>
      <integer>1</integer>
      <key>Precomposed</key>
      <true/>
      <key>URL</key>
      <string>${appUrl}</string>
    </dict>
  </array>
  <key>PayloadDescription</key>
  <string>${displayName} iOS Direct Home Screen Installer (Black-Gold Astrolabe Edition)</string>
  <key>PayloadDisplayName</key>
  <string>${displayName} (${displayName} 星途工作台)</string>
  <key>PayloadIdentifier</key>
  <string>app.viastela.profile</string>
  <key>PayloadOrganization</key>
  <string>${displayName}</string>
  <key>PayloadRemovalDisallowed</key>
  <false/>
  <key>PayloadType</key>
  <string>Configuration</string>
  <key>PayloadUUID</key>
  <string>8A9D547E-3B2F-4E91-9A11-7C64E8120000</string>
  <key>PayloadVersion</key>
  <integer>1</integer>
</dict>
</plist>
`;
  const outPath = path.join(RELEASES_DIR, 'viastela-ios.mobileconfig');
  writeFileSync(outPath, mobileConfig, 'utf8');
  console.log(`Built iOS direct installer profile: ${outPath}`);
}

function buildUnsignedIpa(displayName) {
  let sdkPath = '';
  try {
    sdkPath = execFileSync('xcrun', ['--sdk', 'iphoneos', '--show-sdk-path'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    console.log('Skipping native iOS .ipa compilation (full Xcode iphoneos SDK not installed on this machine).');
    return;
  }
  if (!sdkPath) return;

  const workDir = path.join(os.tmpdir(), `viastela-ipa-${Date.now()}`);
  const appDir = path.join(workDir, 'Payload', `${displayName}.app`);
  const webRoot = path.join(appDir, 'web');
  mkdirSync(webRoot, { recursive: true });

  const distDir = path.join(ROOT, 'dist');
  const webZip = path.join(RELEASES_DIR, 'viastela-web-pwa.zip');
  if (existsSync(distDir)) {
    cpSync(distDir, webRoot, { recursive: true });
  } else if (existsSync(webZip)) {
    execFileSync('ditto', ['-x', '-k', webZip, webRoot], { stdio: 'inherit' });
  }

  cpSync(path.join(ROOT, 'assets', 'icon.png'), path.join(appDir, 'AppIcon60x60@3x.png'));

  writeFileSync(
    path.join(appDir, 'Info.plist'),
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDisplayName</key>
  <string>${displayName}</string>
  <key>CFBundleExecutable</key>
  <string>${displayName}</string>
  <key>CFBundleIdentifier</key>
  <string>app.viastela</string>
  <key>CFBundleName</key>
  <string>${displayName}</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>1.0.0</string>
  <key>CFBundleVersion</key>
  <string>1</string>
  <key>LSRequiresIPhoneOS</key>
  <true/>
  <key>UIDeviceFamily</key>
  <array>
    <integer>1</integer>
    <integer>2</integer>
  </array>
  <key>UILaunchScreen</key>
  <dict/>
  <key>UIRequiredDeviceCapabilities</key>
  <array>
    <string>arm64</string>
  </array>
  <key>UIStatusBarStyle</key>
  <string>UIStatusBarStyleLightContent</string>
</dict>
</plist>
`,
    'utf8',
  );

  // Name the file main.swift and invoke UIApplicationMain directly at top-level
  // (avoids Swift's `'main' attribute cannot be used in a module that contains top-level code` error).
  const swiftSrc = path.join(workDir, 'main.swift');
  writeFileSync(
    swiftSrc,
    `import UIKit
import WebKit

final class LocalSchemeHandler: NSObject, WKURLSchemeHandler {
    let webRoot: URL
    init(webRoot: URL) { self.webRoot = webRoot }

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url else { return }
        var relPath = url.path
        if relPath.isEmpty || relPath == "/" { relPath = "/index.html" }
        let cleanRel = String(relPath.dropFirst())
        var target = webRoot.appendingPathComponent(cleanRel)
        let fm = FileManager.default
        var isDir: ObjCBool = false
        if !fm.fileExists(atPath: target.path, isDirectory: &isDir) || isDir.boolValue {
            let htmlCandidate = webRoot.appendingPathComponent(cleanRel + ".html")
            if fm.fileExists(atPath: htmlCandidate.path) {
                target = htmlCandidate
            } else {
                target = webRoot.appendingPathComponent("index.html")
            }
        }
        guard let data = try? Data(contentsOf: target) else { return }
        let ext = target.pathExtension.lowercased()
        let mime: String
        switch ext {
        case "html": mime = "text/html; charset=utf-8"
        case "js", "mjs": mime = "application/javascript; charset=utf-8"
        case "css": mime = "text/css; charset=utf-8"
        case "json", "webmanifest": mime = "application/json; charset=utf-8"
        case "svg": mime = "image/svg+xml"
        case "png": mime = "image/png"
        default: mime = "application/octet-stream"
        }
        if let resp = HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: ["Content-Type": mime, "Access-Control-Allow-Origin": "*"]) {
            urlSchemeTask.didReceive(resp)
            urlSchemeTask.didReceive(data)
            urlSchemeTask.didFinish()
        }
    }
    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {}
}

final class RootVC: UIViewController {
    var webView: WKWebView!
    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }
    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.09, green: 0.08, blue: 0.07, alpha: 1.0)
        let cfg = WKWebViewConfiguration()
        if let webRoot = Bundle.main.resourceURL?.appendingPathComponent("web") {
            cfg.setURLSchemeHandler(LocalSchemeHandler(webRoot: webRoot), forURLScheme: "viastela-local")
        }
        webView = WKWebView(frame: view.bounds, configuration: cfg)
        webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        webView.isOpaque = false
        webView.backgroundColor = view.backgroundColor
        view.addSubview(webView)
        if let startURL = URL(string: "viastela-local://app/index.html") {
            webView.load(URLRequest(url: startURL))
        }
    }
}

class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        let win = UIWindow(frame: UIScreen.main.bounds)
        win.rootViewController = RootVC()
        win.makeKeyAndVisible()
        self.window = win
        return true
    }
}

let _ = UIApplicationMain(
    CommandLine.argc,
    CommandLine.unsafeArgv,
    nil,
    NSStringFromClass(AppDelegate.self)
)
`,
    'utf8',
  );

  execFileSync(
    'xcrun',
    [
      '--sdk',
      'iphoneos',
      'swiftc',
      '-O',
      '-sdk',
      sdkPath,
      '-target',
      'arm64-apple-ios15.0',
      swiftSrc,
      '-o',
      path.join(appDir, displayName),
    ],
    { stdio: 'inherit' },
  );

  try {
    execFileSync('codesign', ['--force', '--sign', '-', appDir], { stdio: 'pipe' });
  } catch {
    // Unsigned bundle is fine for sideloading tools
  }

  const ipaOut = path.join(RELEASES_DIR, 'viastela-ios-unsigned.ipa');
  rmSync(ipaOut, { force: true });
  execFileSync('ditto', ['-c', '-k', '--keepParent', path.join(workDir, 'Payload'), ipaOut], { stdio: 'inherit' });
  rmSync(workDir, { recursive: true, force: true });
  console.log(`Built native iOS IPA: ${ipaOut}`);
}

function main() {
  mkdirSync(RELEASES_DIR, { recursive: true });
  const displayName = readDisplayName();
  buildMobileConfig(displayName);
  if (process.platform === 'darwin') {
    buildUnsignedIpa(displayName);
  }
}

main();
