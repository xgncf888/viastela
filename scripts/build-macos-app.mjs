#!/usr/bin/env node
/**
 * Builds the native macOS desktop bundle (`Viastela Studio.app` + `.zip` / `.dmg`)
 * wrapping the exported Web bundle (`dist/`) in a native Cocoa + WKWebView vibrancy shell.
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.resolve(process.env.MACOS_OUT_DIR ?? path.join(ROOT, 'build', 'macos'));
const APP_NAME = 'Viastela Studio.app';
const APP_BUNDLE = path.join(OUT_DIR, APP_NAME);
const CONTENTS = path.join(APP_BUNDLE, 'Contents');
const MACOS_DIR = path.join(CONTENTS, 'MacOS');
const RESOURCES_DIR = path.join(CONTENTS, 'Resources');
const WEB_DEST = path.join(RESOURCES_DIR, 'web');

const INFO_PLIST = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key>
  <string>ViastelaStudio</string>
  <key>CFBundleIdentifier</key>
  <string>com.viastela.studio.mac</string>
  <key>CFBundleName</key>
  <string>Viastela Studio</string>
  <key>CFBundleDisplayName</key>
  <string>Viastela Studio</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>2.0.0</string>
  <key>LSMinimumSystemVersion</key>
  <string>12.0</string>
  <key>NSHighResolutionCapable</key>
  <true/>
  <key>NSAppTransportSecurity</key>
  <dict>
    <key>NSAllowsArbitraryLoads</key>
    <true/>
  </dict>
</dict>
</plist>
`;

const SWIFT_SOURCE = `import Cocoa
import WebKit

class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate {
    var window: NSWindow!
    var webView: WKWebView!

    func applicationDidFinishLaunching(_ notification: Notification) {
        let screenRect = NSScreen.main?.visibleFrame ?? NSRect(x: 0, y: 0, width: 1440, height: 900)
        let width: CGFloat = min(1440, screenRect.width * 0.92)
        let height: CGFloat = min(900, screenRect.height * 0.90)
        let frame = NSRect(
            x: screenRect.origin.x + (screenRect.width - width) / 2,
            y: screenRect.origin.y + (screenRect.height - height) / 2,
            width: width,
            height: height
        )

        window = NSWindow(
            contentRect: frame,
            styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        window.title = "Viastela Studio"
        window.titleVisibility = .hidden
        window.titlebarAppearsTransparent = true
        window.appearance = NSAppearance(named: .darkAqua)
        window.backgroundColor = NSColor(calibratedRed: 0.067, green: 0.071, blue: 0.082, alpha: 1.0)
        window.minSize = NSSize(width: 960, height: 640)

        let visualEffect = NSVisualEffectView(frame: window.contentView!.bounds)
        visualEffect.autoresizingMask = [.width, .height]
        visualEffect.material = .underWindowBackground
        visualEffect.blendingMode = .behindWindow
        visualEffect.state = .active

        let config = WKWebViewConfiguration()
        config.preferences.setValue(true, forKey: "developerExtrasEnabled")

        webView = WKWebView(frame: visualEffect.bounds, configuration: config)
        webView.autoresizingMask = [.width, .height]
        webView.navigationDelegate = self
        webView.setValue(false, forKey: "drawsBackground")

        visualEffect.addSubview(webView)
        window.contentView = visualEffect
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)

        if let indexURL = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "web") {
            webView.loadFileURL(indexURL, allowingReadAccessTo: indexURL.deletingLastPathComponent())
        } else {
            webView.load(URLRequest(url: URL(string: "http://127.0.0.1:4173")!))
        }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return true
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
`;

function main() {
  if (process.platform !== 'darwin') {
    console.log('Skipping macOS native bundle compilation on non-darwin platform.');
    return;
  }

  rmSync(APP_BUNDLE, { recursive: true, force: true });
  mkdirSync(MACOS_DIR, { recursive: true });
  mkdirSync(RESOURCES_DIR, { recursive: true });
  writeFileSync(path.join(CONTENTS, 'Info.plist'), INFO_PLIST, 'utf8');

  const iconSrc = path.join(ROOT, 'public', 'icons', 'icon-512.png');
  if (existsSync(iconSrc)) {
    copyFileSync(iconSrc, path.join(RESOURCES_DIR, 'AppIcon.png'));
  }

  const distDir = path.join(ROOT, 'dist');
  if (existsSync(distDir)) {
    execFileSync('cp', ['-R', distDir, WEB_DEST], { stdio: 'inherit' });
  }

  const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'viastela-macos-'));
  const swiftFile = path.join(tmpDir, 'ViastelaStudio.swift');
  const binPath = path.join(MACOS_DIR, 'ViastelaStudio');
  try {
    writeFileSync(swiftFile, SWIFT_SOURCE, 'utf8');
    execFileSync('swiftc', ['-O', swiftFile, '-framework', 'Cocoa', '-framework', 'WebKit', '-o', binPath], {
      stdio: 'inherit',
    });
    execFileSync('codesign', ['--force', '--deep', '--sign', '-', APP_BUNDLE], { stdio: 'inherit' });
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }

  const zipPath = path.join(OUT_DIR, 'Viastela-Studio-macOS.zip');
  rmSync(zipPath, { force: true });
  execFileSync('ditto', ['-c', '-k', '--keepParent', APP_BUNDLE, zipPath], { stdio: 'inherit' });

  const dmgPath = path.join(OUT_DIR, 'Viastela-Studio-macOS.dmg');
  rmSync(dmgPath, { force: true });
  execFileSync(
    'hdiutil',
    ['create', '-volname', 'Viastela Studio', '-srcfolder', APP_BUNDLE, '-ov', '-format', 'UDZO', dmgPath],
    { stdio: 'inherit' },
  );

  console.log(\`Built macOS packages in \${OUT_DIR}:\`);
  console.log(\`  - \${APP_BUNDLE}\`);
  console.log(\`  - \${zipPath}\`);
  console.log(\`  - \${dmgPath}\`);
}

main();
