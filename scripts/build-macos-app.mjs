#!/usr/bin/env node
/**
 * Builds the native macOS desktop bundle (`.app` + `.zip` / `.dmg`)
 * wrapping the exported Web bundle (`dist/`) in a native Cocoa + WKWebView vibrancy shell
 * with the custom Astrolabe Star-V 1024px macOS icon.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const brandSource = readFileSync(path.join(ROOT, 'src', 'config', 'brand.ts'), 'utf8');
const displayName = brandSource.match(/displayName:\s*'([^']+)'/)?.[1] ?? 'App';

const OUT_DIR = path.resolve(process.env.MACOS_OUT_DIR ?? path.join(ROOT, 'web-build', 'macos'));
const APP_TITLE = displayName;
const APP_NAME = `${APP_TITLE}.app`;
const EXEC_NAME = displayName;
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
  <string>${EXEC_NAME}</string>
  <key>CFBundleIconFile</key>
  <string>AppIcon.png</string>
  <key>CFBundleIdentifier</key>
  <string>com.viastela.app.mac</string>
  <key>CFBundleName</key>
  <string>${APP_TITLE}</string>
  <key>CFBundleDisplayName</key>
  <string>${APP_TITLE}</string>
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

class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, NSWindowDelegate {
    var window: NSWindow!
    var webView: WKWebView!
    var statusItem: NSStatusItem!

    func applicationDidFinishLaunching(_ notification: Notification) {
        if let iconURL = Bundle.main.url(forResource: "AppIcon", withExtension: "png"),
           let iconImage = NSImage(contentsOf: iconURL) {
            NSApp.applicationIconImage = iconImage
        }

        setupMainMenu()
        setupStatusItem()

        let screenRect = NSScreen.main?.visibleFrame ?? NSRect(x: 0, y: 0, width: 1440, height: 900)
        let width: CGFloat = min(1320, screenRect.width * 0.90)
        let height: CGFloat = min(860, screenRect.height * 0.88)
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
        window.title = "${APP_TITLE}"
        window.titleVisibility = .hidden
        window.titlebarAppearsTransparent = true
        if #available(macOS 11.0, *) {
            window.toolbarStyle = .unifiedCompact
            window.titlebarSeparatorStyle = .none
        }
        window.isMovableByWindowBackground = false
        window.backgroundColor = NSColor(calibratedRed: 0.969, green: 0.957, blue: 0.925, alpha: 1.0)
        window.minSize = NSSize(width: 390, height: 640)
        window.delegate = self
        window.setFrameAutosaveName("AppMainWindow")

        let visualEffect = NSVisualEffectView(frame: window.contentView!.bounds)
        visualEffect.autoresizingMask = [.width, .height]
        visualEffect.material = .underWindowBackground
        visualEffect.blendingMode = .behindWindow
        visualEffect.state = .followsWindowActiveState

        let config = WKWebViewConfiguration()
        config.preferences.setValue(true, forKey: "developerExtrasEnabled")
        let injectCSS = """
        document.documentElement.style.overscrollBehavior = 'none';
        document.body.style.overscrollBehavior = 'none';
        document.body.style.webkitUserSelect = 'none';
        """
        let userScript = WKUserScript(source: injectCSS, injectionTime: .atDocumentEnd, forMainFrameOnly: true)
        config.userContentController.addUserScript(userScript)

        webView = WKWebView(frame: visualEffect.bounds, configuration: config)
        webView.autoresizingMask = [.width, .height]
        webView.navigationDelegate = self
        webView.setValue(false, forKey: "drawsBackground")

        visualEffect.addSubview(webView)
        window.contentView = visualEffect
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)

        loadAppBundle()
    }

    func loadAppBundle() {
        if let indexURL = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "web") {
            webView.loadFileURL(indexURL, allowingReadAccessTo: indexURL.deletingLastPathComponent())
        } else {
            webView.load(URLRequest(url: URL(string: "http://127.0.0.1:4173")!))
        }
    }

    func setupMainMenu() {
        let mainMenu = NSMenu()

        // App Menu
        let appMenuItem = NSMenuItem()
        mainMenu.addItem(appMenuItem)
        let appMenu = NSMenu()
        appMenuItem.submenu = appMenu
        appMenu.addItem(withTitle: "关于 ${APP_TITLE}", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(NSMenuItem.separator())
        let quickRecordItem = NSMenuItem(title: "快速记录…", action: #selector(openQuickRecord), keyEquivalent: "n")
        quickRecordItem.target = self
        appMenu.addItem(quickRecordItem)
        appMenu.addItem(NSMenuItem.separator())
        appMenu.addItem(withTitle: "隐藏 ${APP_TITLE}", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        let hideOthers = NSMenuItem(title: "隐藏其他", action: #selector(NSApplication.hideOtherApplications(_:)), keyEquivalent: "h")
        hideOthers.keyEquivalentModifierMask = [.command, .option]
        appMenu.addItem(hideOthers)
        appMenu.addItem(withTitle: "全部显示", action: #selector(NSApplication.unhideAllApplications(_:)), keyEquivalent: "")
        appMenu.addItem(NSMenuItem.separator())
        appMenu.addItem(withTitle: "退出 ${APP_TITLE}", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")

        // Edit Menu (essential for WKWebView Cmd+C/V/X/A/Z)
        let editMenuItem = NSMenuItem()
        mainMenu.addItem(editMenuItem)
        let editMenu = NSMenu(title: "编辑")
        editMenuItem.submenu = editMenu
        editMenu.addItem(withTitle: "撤销", action: Selector(("undo:")), keyEquivalent: "z")
        editMenu.addItem(withTitle: "重做", action: Selector(("redo:")), keyEquivalent: "Z")
        editMenu.addItem(NSMenuItem.separator())
        editMenu.addItem(withTitle: "剪切", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        editMenu.addItem(withTitle: "拷贝", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        editMenu.addItem(withTitle: "粘贴", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        editMenu.addItem(withTitle: "全选", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")

        // Navigate / View Menu
        let navMenuItem = NSMenuItem()
        mainMenu.addItem(navMenuItem)
        let navMenu = NSMenu(title: "视图")
        navMenuItem.submenu = navMenu
        let tabs: [(String, String, Selector)] = [
            ("今日", "1", #selector(navToday)),
            ("资产", "2", #selector(navAssets)),
            ("趋势", "3", #selector(navTrend)),
            ("时间线", "4", #selector(navTimeline)),
            ("我的", "5", #selector(navMe))
        ]
        for (title, key, sel) in tabs {
            let item = NSMenuItem(title: title, action: sel, keyEquivalent: key)
            item.target = self
            navMenu.addItem(item)
        }
        navMenu.addItem(NSMenuItem.separator())
        let reloadItem = NSMenuItem(title: "重新加载", action: #selector(reloadWebView), keyEquivalent: "r")
        reloadItem.target = self
        navMenu.addItem(reloadItem)

        // Window Menu
        let windowMenuItem = NSMenuItem()
        mainMenu.addItem(windowMenuItem)
        let windowMenu = NSMenu(title: "窗口")
        windowMenuItem.submenu = windowMenu
        windowMenu.addItem(withTitle: "最小化", action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m")
        windowMenu.addItem(withTitle: "缩放", action: #selector(NSWindow.performZoom(_:)), keyEquivalent: "")
        let closeItem = NSMenuItem(title: "关闭窗口", action: #selector(hideWindow), keyEquivalent: "w")
        closeItem.target = self
        windowMenu.addItem(closeItem)

        NSApp.mainMenu = mainMenu
        NSApp.windowsMenu = windowMenu
    }

    func setupStatusItem() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        if let button = statusItem.button {
            button.title = "✦"
            button.toolTip = "${APP_TITLE} — 点击打开或快速记录"
        }
        let menu = NSMenu()
        let showItem = NSMenuItem(title: "打开主窗口", action: #selector(showMainWindow), keyEquivalent: "")
        showItem.target = self
        menu.addItem(showItem)
        menu.addItem(NSMenuItem.separator())

        let recWeight = NSMenuItem(title: "记体重…", action: #selector(openQuickRecord), keyEquivalent: "k")
        recWeight.target = self
        menu.addItem(recWeight)

        let recTrain = NSMenuItem(title: "记训练…", action: #selector(openQuickTraining), keyEquivalent: "")
        recTrain.target = self
        menu.addItem(recTrain)

        let recStudy = NSMenuItem(title: "记学习…", action: #selector(openQuickStudy), keyEquivalent: "")
        recStudy.target = self
        menu.addItem(recStudy)

        let recBlock = NSMenuItem(title: "记时间块 / 随手记…", action: #selector(openQuickBlock), keyEquivalent: "")
        recBlock.target = self
        menu.addItem(recBlock)

        menu.addItem(NSMenuItem.separator())
        menu.addItem(withTitle: "退出", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        statusItem.menu = menu
    }

    @objc func showMainWindow() {
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    @objc func hideWindow() {
        window.orderOut(nil)
    }

    @objc func reloadWebView() {
        webView.reload()
    }

    func invokeBridge(_ js: String) {
        showMainWindow()
        webView.evaluateJavaScript(js, completionHandler: nil)
    }

    @objc func openQuickRecord() {
        invokeBridge("window.__viastelaDesktop && window.__viastelaDesktop.openRecord('weight');")
    }

    @objc func openQuickTraining() {
        invokeBridge("window.__viastelaDesktop && window.__viastelaDesktop.openRecord('training');")
    }

    @objc func openQuickStudy() {
        invokeBridge("window.__viastelaDesktop && window.__viastelaDesktop.openRecord('study');")
    }

    @objc func openQuickBlock() {
        invokeBridge("window.__viastelaDesktop && window.__viastelaDesktop.openRecord('block');")
    }

    @objc func navToday() { invokeBridge("window.__viastelaDesktop && window.__viastelaDesktop.navigate('today');") }
    @objc func navAssets() { invokeBridge("window.__viastelaDesktop && window.__viastelaDesktop.navigate('assets');") }
    @objc func navTrend() { invokeBridge("window.__viastelaDesktop && window.__viastelaDesktop.navigate('trend');") }
    @objc func navTimeline() { invokeBridge("window.__viastelaDesktop && window.__viastelaDesktop.navigate('timeline');") }
    @objc func navMe() { invokeBridge("window.__viastelaDesktop && window.__viastelaDesktop.navigate('me');") }

    func windowShouldClose(_ sender: NSWindow) -> Bool {
        window.orderOut(nil)
        return false
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        if !flag {
            showMainWindow()
        }
        return true
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return false
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
  const swiftFile = path.join(tmpDir, 'AppHost.swift');
  const binPath = path.join(MACOS_DIR, EXEC_NAME);
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

  const zipPath = path.join(OUT_DIR, 'viastela-macos.zip');
  rmSync(zipPath, { force: true });
  execFileSync('ditto', ['-c', '-k', '--keepParent', APP_BUNDLE, zipPath], { stdio: 'inherit' });

  const dmgPath = path.join(OUT_DIR, 'viastela-macos.dmg');
  rmSync(dmgPath, { force: true });
  try {
    execFileSync(
      'hdiutil',
      ['create', '-volname', APP_TITLE, '-srcfolder', APP_BUNDLE, '-ov', '-format', 'UDZO', dmgPath],
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
