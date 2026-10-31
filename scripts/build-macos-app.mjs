#!/usr/bin/env node
/**
 * Builds the native macOS desktop bundle (`Viastela Studio.app` + `.zip` / `.dmg`)
 * wrapping the exported Web bundle (`dist/`) in a native Cocoa + WKWebView vibrancy shell
 * with the custom Astrolabe Star-V 1024px macOS icon.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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
  <key>CFBundleIconFile</key>
  <string>AppIcon.png</string>
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

const ICON_SWIFT = `import Cocoa

func drawAstrolabeIcon(size: Int) -> Data? {
    let s = CGFloat(size)
    guard let rep = NSBitmapImageRep(
        bitmapDataPlanes: nil,
        pixelsWide: size,
        pixelsHigh: size,
        bitsPerSample: 8,
        samplesPerPixel: 4,
        hasAlpha: true,
        isPlanar: false,
        colorSpaceName: .deviceRGB,
        bytesPerRow: 0,
        bitsPerPixel: 0
    ) else { return nil }

    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
    guard let ctx = NSGraphicsContext.current?.cgContext else { return nil }

    let inset = s * 0.088
    let box = CGRect(x: inset, y: inset, width: s - inset * 2, height: s - inset * 2)
    let radius = box.width * 0.225
    let squircle = CGPath(roundedRect: box, cornerWidth: radius, cornerHeight: radius, transform: nil)

    ctx.saveGState()
    ctx.setShadow(offset: CGSize(width: 0, height: -s * 0.018), blur: s * 0.04, color: NSColor(calibratedWhite: 0, alpha: 0.35).cgColor)
    ctx.addPath(squircle)
    ctx.setFillColor(NSColor(calibratedRed: 0.969, green: 0.957, blue: 0.925, alpha: 1.0).cgColor)
    ctx.fillPath()
    ctx.restoreGState()

    ctx.saveGState()
    ctx.addPath(squircle)
    ctx.clip()
    let colorSpace = CGColorSpaceCreateDeviceRGB()
    let paperColors = [
        NSColor(calibratedRed: 0.976, green: 0.965, blue: 0.937, alpha: 1.0).cgColor,
        NSColor(calibratedRed: 0.918, green: 0.898, blue: 0.851, alpha: 1.0).cgColor
    ] as CFArray
    if let grad = CGGradient(colorsSpace: colorSpace, colors: paperColors, locations: [0.0, 1.0]) {
        ctx.drawLinearGradient(grad, start: CGPoint(x: s * 0.5, y: box.maxY), end: CGPoint(x: s * 0.5, y: box.minY), options: [])
    }
    ctx.addPath(squircle)
    ctx.setStrokeColor(NSColor(calibratedRed: 0.85, green: 0.82, blue: 0.76, alpha: 0.9).cgColor)
    ctx.setLineWidth(s * 0.008)
    ctx.strokePath()
    ctx.restoreGState()

    let center = CGPoint(x: s * 0.5, y: s * 0.5)
    let medRadius = s * 0.345
    let medRect = CGRect(x: center.x - medRadius, y: center.y - medRadius, width: medRadius * 2, height: medRadius * 2)

    ctx.saveGState()
    ctx.setShadow(offset: CGSize(width: 0, height: -s * 0.012), blur: s * 0.025, color: NSColor(calibratedWhite: 0, alpha: 0.42).cgColor)
    ctx.fillEllipse(in: medRect)
    ctx.restoreGState()

    ctx.saveGState()
    ctx.addEllipse(in: medRect)
    ctx.clip()
    let medColors = [
        NSColor(calibratedRed: 0.13, green: 0.135, blue: 0.155, alpha: 1.0).cgColor,
        NSColor(calibratedRed: 0.075, green: 0.078, blue: 0.09, alpha: 1.0).cgColor
    ] as CFArray
    if let medGrad = CGGradient(colorsSpace: colorSpace, colors: medColors, locations: [0.0, 1.0]) {
        ctx.drawLinearGradient(medGrad, start: CGPoint(x: center.x, y: medRect.maxY), end: CGPoint(x: center.x, y: medRect.minY), options: [])
    }
    ctx.restoreGState()

    let outerRingR = s * 0.295
    let innerRingR = s * 0.265
    let goldStroke = NSColor(calibratedRed: 0.86, green: 0.72, blue: 0.56, alpha: 0.55).cgColor
    ctx.setStrokeColor(goldStroke)
    ctx.setLineWidth(max(1.0, s * 0.003))
    ctx.strokeEllipse(in: CGRect(x: center.x - outerRingR, y: center.y - outerRingR, width: outerRingR * 2, height: outerRingR * 2))
    ctx.strokeEllipse(in: CGRect(x: center.x - innerRingR, y: center.y - innerRingR, width: innerRingR * 2, height: innerRingR * 2))

    for i in 0..<72 {
        let angle = CGFloat(i) * (.pi * 2.0 / 72.0)
        let isMajor = (i % 6 == 0)
        let isCardinal = (i % 18 == 0)
        let r1 = isCardinal ? (innerRingR - s * 0.012) : innerRingR
        let r2 = isCardinal ? (outerRingR + s * 0.012) : (isMajor ? outerRingR : (innerRingR + (outerRingR - innerRingR) * 0.55))
        ctx.setLineWidth(isCardinal ? max(1.5, s * 0.0045) : max(1.0, s * 0.0022))
        ctx.setStrokeColor(NSColor(calibratedRed: 0.88, green: 0.74, blue: 0.58, alpha: isCardinal ? 0.85 : (isMajor ? 0.55 : 0.32)).cgColor)
        ctx.move(to: CGPoint(x: center.x + cos(angle) * r1, y: center.y + sin(angle) * r1))
        ctx.addLine(to: CGPoint(x: center.x + cos(angle) * r2, y: center.y + sin(angle) * r2))
        ctx.strokePath()
    }

    let vPath = CGMutablePath()
    vPath.move(to: CGPoint(x: s * 0.355, y: s * 0.595))
    vPath.addLine(to: CGPoint(x: s * 0.500, y: s * 0.335))
    vPath.addLine(to: CGPoint(x: s * 0.645, y: s * 0.595))
    ctx.saveGState()
    ctx.setShadow(offset: CGSize(width: 0, height: -s * 0.006), blur: s * 0.015, color: NSColor(calibratedWhite: 0, alpha: 0.5).cgColor)
    ctx.addPath(vPath)
    ctx.setStrokeColor(NSColor(calibratedRed: 0.969, green: 0.957, blue: 0.925, alpha: 1.0).cgColor)
    ctx.setLineWidth(s * 0.044)
    ctx.setLineCap(.round)
    ctx.setLineJoin(.round)
    ctx.strokePath()
    ctx.restoreGState()

    let starCenter = CGPoint(x: s * 0.500, y: s * 0.635)
    let outerS = s * 0.068
    let innerS = s * 0.021
    let starPath = CGMutablePath()
    for i in 0..<8 {
        let angle = CGFloat(i) * (.pi / 4.0) + (.pi / 2.0)
        let r = (i % 2 == 0) ? outerS : innerS
        let pt = CGPoint(x: starCenter.x + cos(angle) * r, y: starCenter.y + sin(angle) * r)
        if i == 0 { starPath.move(to: pt) } else { starPath.addLine(to: pt) }
    }
    starPath.closeSubpath()

    ctx.saveGState()
    ctx.setShadow(offset: .zero, blur: s * 0.032, color: NSColor(calibratedRed: 0.80, green: 0.47, blue: 0.36, alpha: 0.85).cgColor)
    ctx.addPath(starPath)
    ctx.setFillColor(NSColor(calibratedRed: 0.80, green: 0.47, blue: 0.36, alpha: 1.0).cgColor)
    ctx.fillPath()
    ctx.restoreGState()

    NSGraphicsContext.restoreGraphicsState()
    return rep.representation(using: .png, properties: [:])
}

if let data = drawAstrolabeIcon(size: 1024) {
    try? data.write(to: URL(fileURLWithPath: CommandLine.arguments[1]))
}
`;

const SWIFT_SOURCE = `import Cocoa
import WebKit

class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate {
    var window: NSWindow!
    var webView: WKWebView!

    func applicationDidFinishLaunching(_ notification: Notification) {
        if let iconURL = Bundle.main.url(forResource: "AppIcon", withExtension: "png"),
           let iconImage = NSImage(contentsOf: iconURL) {
            NSApp.applicationIconImage = iconImage
        }

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

  const distDir = path.join(ROOT, 'dist');
  if (existsSync(distDir)) {
    execFileSync('cp', ['-R', distDir, WEB_DEST], { stdio: 'inherit' });
  }

  const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'viastela-macos-'));
  const iconSwiftFile = path.join(tmpDir, 'RenderIcon.swift');
  const swiftFile = path.join(tmpDir, 'ViastelaStudio.swift');
  const binPath = path.join(MACOS_DIR, 'ViastelaStudio');
  const iconOutPath = path.join(RESOURCES_DIR, 'AppIcon.png');
  try {
    writeFileSync(iconSwiftFile, ICON_SWIFT, 'utf8');
    execFileSync('swift', [iconSwiftFile, iconOutPath], { stdio: 'inherit' });
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
  try {
    execFileSync(
      'hdiutil',
      ['create', '-volname', 'Viastela Studio', '-srcfolder', APP_BUNDLE, '-ov', '-format', 'UDZO', dmgPath],
      { stdio: 'inherit' },
    );
  } catch {
    console.log('Note: hdiutil .dmg creation skipped in restricted environment; .app and .zip are ready.');
  }

  console.log(`Built macOS packages in ${OUT_DIR}:`);
  console.log(`  - ${APP_BUNDLE}`);
  console.log(`  - ${zipPath}`);
  if (existsSync(dmgPath)) console.log(`  - ${dmgPath}`);
}

main();
