#!/usr/bin/env node
/**
 * Builds the native macOS desktop bundle (`.app` + `.zip` / `.dmg`)
 * wrapping the exported Web bundle (`dist/`) in a native Cocoa + WKWebView vibrancy shell
 * with a custom `WKURLSchemeHandler` (`app://localhost/...`) so root-relative `/_expo/...`
 * scripts and SPA routes load cleanly without a blank screen.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Drops leftover demo rows from a parsed on-device database. */
export function stripSeedRows(db) {
  if (!db || typeof db !== 'object') return db;
  for (const key of Object.keys(db)) {
    if (!Array.isArray(db[key])) continue;
    db[key] = db[key].filter((row) => !row || typeof row.id !== 'string' || row.id.indexOf('-seed-') === -1);
  }
  return db;
}
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

const BUILD_VERSION = `${Date.now()}`;

const INFO_PLIST = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key>
  <string>${EXEC_NAME}</string>
  <key>CFBundleIconFile</key>
  <string>AppIcon.icns</string>
  <key>CFBundleIdentifier</key>
  <string>com.viastela.studio.mac</string>
  <key>CFBundleName</key>
  <string>${APP_TITLE}</string>
  <key>CFBundleDisplayName</key>
  <string>${APP_TITLE}</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>2.2.0</string>
  <key>CFBundleVersion</key>
  <string>${BUILD_VERSION}</string>
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

func drawAstrolabeIcon(size: Int, fullBleed: Bool = false) -> Data? {
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

    let colorSpace = CGColorSpaceCreateDeviceRGB()
    let bgColors = [
        NSColor(calibratedRed: 0.082, green: 0.088, blue: 0.114, alpha: 1.0).cgColor,
        NSColor(calibratedRed: 0.027, green: 0.030, blue: 0.038, alpha: 1.0).cgColor
    ] as CFArray

    if fullBleed {
        let fullBox = CGRect(x: 0, y: 0, width: s, height: s)
        ctx.setFillColor(NSColor(calibratedRed: 0.035, green: 0.038, blue: 0.048, alpha: 1.0).cgColor)
        ctx.fill(fullBox)
        if let grad = CGGradient(colorsSpace: colorSpace, colors: bgColors, locations: [0.0, 1.0]) {
            ctx.drawLinearGradient(grad, start: CGPoint(x: s * 0.5, y: s), end: CGPoint(x: s * 0.5, y: 0), options: [])
        }
        ctx.translateBy(x: s * 0.5, y: s * 0.5)
        ctx.scaleBy(x: 1.12, y: 1.12)
        ctx.translateBy(x: -s * 0.5, y: -s * 0.5)
    } else {
        let inset = s * 0.088
        let box = CGRect(x: inset, y: inset, width: s - inset * 2, height: s - inset * 2)
        let radius = box.width * 0.225
        let squircle = CGPath(roundedRect: box, cornerWidth: radius, cornerHeight: radius, transform: nil)

        // 1. Deep Obsidian Black Squircle Base (#0A0B0E -> #14161D) + Glowing Molten Gold Rim (Charioteer Sister Series)
        ctx.saveGState()
        ctx.setShadow(offset: CGSize(width: 0, height: -s * 0.02), blur: s * 0.045, color: NSColor(calibratedWhite: 0, alpha: 0.72).cgColor)
        ctx.addPath(squircle)
        ctx.setFillColor(NSColor(calibratedRed: 0.035, green: 0.038, blue: 0.048, alpha: 1.0).cgColor)
        ctx.fillPath()
        ctx.restoreGState()

        ctx.saveGState()
        ctx.addPath(squircle)
        ctx.clip()
        if let grad = CGGradient(colorsSpace: colorSpace, colors: bgColors, locations: [0.0, 1.0]) {
            ctx.drawLinearGradient(grad, start: CGPoint(x: s * 0.5, y: box.maxY), end: CGPoint(x: s * 0.5, y: box.minY), options: [])
        }
        ctx.addPath(squircle)
        ctx.setStrokeColor(NSColor(calibratedRed: 0.92, green: 0.78, blue: 0.36, alpha: 0.92).cgColor)
        ctx.setLineWidth(s * 0.011)
        ctx.strokePath()
        ctx.restoreGState()
    }

    let center = CGPoint(x: s * 0.5, y: s * 0.5)
    let outerRingR = s * 0.362
    let midOuterR = s * 0.342
    let innerRingR = s * 0.285
    let innerDashR = s * 0.268

    let goldChampagne = NSColor(calibratedRed: 1.0, green: 0.96, blue: 0.78, alpha: 1.0).cgColor
    let goldBright = NSColor(calibratedRed: 0.99, green: 0.91, blue: 0.58, alpha: 1.0).cgColor
    let goldMid = NSColor(calibratedRed: 0.85, green: 0.69, blue: 0.24, alpha: 1.0).cgColor
    let goldDeep = NSColor(calibratedRed: 0.58, green: 0.42, blue: 0.10, alpha: 1.0).cgColor
    let goldShadow = NSColor(calibratedRed: 0.42, green: 0.29, blue: 0.06, alpha: 1.0).cgColor

    // 2. Celestial Astrolabe Concentric Rings + 144 Ticks + 12 Roman Numerals
    ctx.saveGState()
    ctx.setShadow(offset: .zero, blur: s * 0.016, color: NSColor(calibratedRed: 0.92, green: 0.76, blue: 0.32, alpha: 0.45).cgColor)
    ctx.setStrokeColor(goldBright)
    ctx.setLineWidth(s * 0.0055)
    ctx.strokeEllipse(in: CGRect(x: center.x - outerRingR, y: center.y - outerRingR, width: outerRingR * 2, height: outerRingR * 2))
    ctx.setStrokeColor(goldMid)
    ctx.setLineWidth(s * 0.003)
    ctx.strokeEllipse(in: CGRect(x: center.x - midOuterR, y: center.y - midOuterR, width: midOuterR * 2, height: midOuterR * 2))
    ctx.setLineWidth(s * 0.0045)
    ctx.strokeEllipse(in: CGRect(x: center.x - innerRingR, y: center.y - innerRingR, width: innerRingR * 2, height: innerRingR * 2))
    ctx.setLineWidth(s * 0.0025)
    ctx.strokeEllipse(in: CGRect(x: center.x - innerDashR, y: center.y - innerDashR, width: innerDashR * 2, height: innerDashR * 2))
    ctx.restoreGState()

    for i in 0..<144 {
        let angle = CGFloat(i) * (.pi * 2.0 / 144.0)
        let isHour = (i % 12 == 0)
        let r1 = midOuterR
        let r2 = outerRingR
        ctx.setLineWidth(isHour ? s * 0.0045 : s * 0.0018)
        ctx.setStrokeColor(isHour ? goldBright : goldMid)
        ctx.move(to: CGPoint(x: center.x + cos(angle) * r1, y: center.y + sin(angle) * r1))
        ctx.addLine(to: CGPoint(x: center.x + cos(angle) * r2, y: center.y + sin(angle) * r2))
        ctx.strokePath()
    }

    let numerals = ["XII", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI"]
    let numRadius = (midOuterR + innerRingR) * 0.5
    let font = NSFont(name: "TimesNewRomanPS-BoldMT", size: s * 0.036) ?? NSFont.boldSystemFont(ofSize: s * 0.036)
    let attrs: [NSAttributedString.Key: Any] = [
        .font: font,
        .foregroundColor: NSColor(calibratedRed: 0.95, green: 0.82, blue: 0.42, alpha: 0.95)
    ]
    for (idx, roman) in numerals.enumerated() {
        let clockAngle = (.pi / 2.0) - CGFloat(idx) * (.pi / 6.0)
        let pos = CGPoint(x: center.x + cos(clockAngle) * numRadius, y: center.y + sin(clockAngle) * numRadius)
        let str = NSAttributedString(string: roman, attributes: attrs)
        let strSize = str.size()
        ctx.saveGState()
        ctx.translateBy(x: pos.x, y: pos.y)
        ctx.rotate(by: clockAngle - (.pi / 2.0))
        str.draw(at: CGPoint(x: -strSize.width * 0.5, y: -strSize.height * 0.5))
        ctx.restoreGState()
    }

    // 3. Dense Parallel Golden Constellation / Trajectory Traces & Nodes
    let traceRows: [(CGFloat, CGFloat, CGFloat)] = [
        (0.11, 0.22, 0.03),
        (0.07, 0.24, 0.025),
        (0.03, 0.25, 0.02),
        (-0.01, 0.25, -0.015),
        (-0.05, 0.24, -0.025),
        (-0.09, 0.22, -0.03),
        (-0.13, 0.19, -0.035)
    ]
    ctx.saveGState()
    ctx.setLineWidth(s * 0.0032)
    ctx.setStrokeColor(NSColor(calibratedRed: 0.92, green: 0.76, blue: 0.32, alpha: 0.78).cgColor)
    for (dy, spanX, bendY) in traceRows {
        let y = center.y + s * dy
        let lx0 = center.x - s * spanX
        let lx1 = center.x - s * (spanX - 0.055)
        let lx2 = center.x - s * (spanX - 0.09)
        let ly2 = y - s * bendY
        ctx.move(to: CGPoint(x: lx0, y: y))
        ctx.addLine(to: CGPoint(x: lx1, y: y))
        ctx.addLine(to: CGPoint(x: lx2, y: ly2))
        ctx.addLine(to: CGPoint(x: center.x - s * 0.07, y: ly2))
        ctx.strokePath()
        ctx.setFillColor(goldBright)
        ctx.fillEllipse(in: CGRect(x: lx0 - s * 0.006, y: y - s * 0.006, width: s * 0.012, height: s * 0.012))

        let rx0 = center.x + s * spanX
        let rx1 = center.x + s * (spanX - 0.055)
        let rx2 = center.x + s * (spanX - 0.09)
        ctx.move(to: CGPoint(x: rx0, y: y))
        ctx.addLine(to: CGPoint(x: rx1, y: y))
        ctx.addLine(to: CGPoint(x: rx2, y: ly2))
        ctx.addLine(to: CGPoint(x: center.x + s * 0.07, y: ly2))
        ctx.strokePath()
        ctx.fillEllipse(in: CGRect(x: rx0 - s * 0.006, y: y - s * 0.006, width: s * 0.012, height: s * 0.012))
    }
    ctx.restoreGState()

    func fillFacet(_ pts: [CGPoint], color: CGColor) {
        guard let first = pts.first else { return }
        let p = CGMutablePath()
        p.move(to: first)
        for pt in pts.dropFirst() { p.addLine(to: pt) }
        p.closeSubpath()
        ctx.addPath(p)
        ctx.setFillColor(color)
        ctx.fillPath()
        ctx.addPath(p)
        ctx.setStrokeColor(NSColor(calibratedWhite: 0, alpha: 0.58).cgColor)
        ctx.setLineWidth(s * 0.0024)
        ctx.strokePath()
    }

    func svgPt(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
        return CGPoint(x: (x / 128.0) * s, y: ((128.0 - y) / 128.0) * s)
    }

    // 4. Crossed Golden Astrolabe Sextant Axes & Cardinal Spearheads
    ctx.saveGState()
    ctx.setShadow(offset: CGSize(width: 0, height: -s * 0.008), blur: s * 0.016, color: NSColor(calibratedWhite: 0, alpha: 0.75).cgColor)
    ctx.setStrokeColor(goldMid)
    ctx.setLineWidth(s * 0.011)
    ctx.setLineCap(.round)
    ctx.move(to: CGPoint(x: center.x - s * 0.19, y: center.y - s * 0.01))
    ctx.addLine(to: CGPoint(x: center.x + s * 0.16, y: center.y - s * 0.21))
    ctx.move(to: CGPoint(x: center.x + s * 0.19, y: center.y - s * 0.01))
    ctx.addLine(to: CGPoint(x: center.x - s * 0.16, y: center.y - s * 0.21))
    ctx.strokePath()
    ctx.restoreGState()

    fillFacet([svgPt(24, 57), svgPt(35, 59), svgPt(31, 65)], color: goldBright)
    fillFacet([svgPt(104, 57), svgPt(93, 59), svgPt(97, 65)], color: goldBright)

    // 5. Sculpted Low-Poly 3D Ascendant "V" Celestial Wings (星途双翼)
    fillFacet([svgPt(31, 33), svgPt(44, 35), svgPt(53, 53), svgPt(41, 51)], color: goldChampagne)
    fillFacet([svgPt(41, 51), svgPt(53, 53), svgPt(64, 72), svgPt(50, 68)], color: goldBright)
    fillFacet([svgPt(44, 35), svgPt(52, 41), svgPt(59, 58), svgPt(53, 53)], color: goldMid)
    fillFacet([svgPt(53, 53), svgPt(59, 58), svgPt(64, 72)], color: goldDeep)
    fillFacet([svgPt(34, 43), svgPt(41, 51), svgPt(48, 63), svgPt(38, 57)], color: goldMid)
    fillFacet([svgPt(38, 57), svgPt(48, 63), svgPt(46, 70), svgPt(36, 65)], color: goldShadow)

    fillFacet([svgPt(97, 33), svgPt(84, 35), svgPt(75, 53), svgPt(87, 51)], color: goldBright)
    fillFacet([svgPt(87, 51), svgPt(75, 53), svgPt(64, 72), svgPt(78, 68)], color: goldMid)
    fillFacet([svgPt(84, 35), svgPt(76, 41), svgPt(69, 58), svgPt(75, 53)], color: goldDeep)
    fillFacet([svgPt(75, 53), svgPt(69, 58), svgPt(64, 72)], color: goldShadow)
    fillFacet([svgPt(94, 43), svgPt(87, 51), svgPt(80, 63), svgPt(90, 57)], color: goldDeep)
    fillFacet([svgPt(90, 57), svgPt(80, 63), svgPt(82, 70), svgPt(92, 65)], color: goldShadow)

    // 6. Sculpted 8-Point Faceted Polaris North Star (北极星冠) at Upper Center (64, 38)
    fillFacet([svgPt(64, 38), svgPt(55, 29), svgPt(60, 34)], color: goldBright)
    fillFacet([svgPt(64, 38), svgPt(55, 29), svgPt(59, 38)], color: goldMid)
    fillFacet([svgPt(64, 38), svgPt(73, 29), svgPt(68, 34)], color: goldMid)
    fillFacet([svgPt(64, 38), svgPt(73, 29), svgPt(69, 38)], color: goldDeep)
    fillFacet([svgPt(64, 38), svgPt(55, 47), svgPt(59, 38)], color: goldMid)
    fillFacet([svgPt(64, 38), svgPt(55, 47), svgPt(60, 42)], color: goldDeep)
    fillFacet([svgPt(64, 38), svgPt(73, 47), svgPt(69, 38)], color: goldDeep)
    fillFacet([svgPt(64, 38), svgPt(73, 47), svgPt(68, 42)], color: goldShadow)

    fillFacet([svgPt(64, 20), svgPt(60, 34), svgPt(64, 38)], color: goldChampagne)
    fillFacet([svgPt(64, 20), svgPt(68, 34), svgPt(64, 38)], color: goldMid)
    fillFacet([svgPt(64, 56), svgPt(60, 42), svgPt(64, 38)], color: goldBright)
    fillFacet([svgPt(64, 56), svgPt(68, 42), svgPt(64, 38)], color: goldShadow)
    fillFacet([svgPt(46, 38), svgPt(60, 34), svgPt(64, 38)], color: goldChampagne)
    fillFacet([svgPt(46, 38), svgPt(60, 42), svgPt(64, 38)], color: goldMid)
    fillFacet([svgPt(82, 38), svgPt(68, 34), svgPt(64, 38)], color: goldBright)
    fillFacet([svgPt(82, 38), svgPt(68, 42), svgPt(64, 38)], color: goldDeep)

    // 7. Faceted Royal Shield with Outer Rim & Central Diamond Boss (Lower Center — Sister Series Crest)
    fillFacet([svgPt(46, 63), svgPt(64, 67), svgPt(64, 100), svgPt(49, 88), svgPt(46, 77)], color: goldBright)
    fillFacet([svgPt(82, 63), svgPt(64, 67), svgPt(64, 100), svgPt(79, 88), svgPt(82, 77)], color: goldShadow)
    fillFacet([svgPt(49.5, 66.2), svgPt(64, 69.5), svgPt(64, 96.5), svgPt(52, 86), svgPt(49.5, 77.5)], color: goldMid)
    fillFacet([svgPt(78.5, 66.2), svgPt(64, 69.5), svgPt(64, 96.5), svgPt(76, 86), svgPt(78.5, 77.5)], color: goldDeep)
    fillFacet([svgPt(64, 71), svgPt(73, 79), svgPt(64, 79)], color: goldChampagne)
    fillFacet([svgPt(64, 71), svgPt(55, 79), svgPt(64, 79)], color: goldBright)
    fillFacet([svgPt(64, 79), svgPt(55, 79), svgPt(64, 90)], color: goldMid)
    fillFacet([svgPt(64, 79), svgPt(73, 79), svgPt(64, 90)], color: goldShadow)

    NSGraphicsContext.restoreGraphicsState()
    return rep.representation(using: .png, properties: [:])
}

if let data = drawAstrolabeIcon(size: 1024, fullBleed: false) {
    try? data.write(to: URL(fileURLWithPath: CommandLine.arguments[1]))
}
if CommandLine.arguments.count > 2, let mobileData = drawAstrolabeIcon(size: 1024, fullBleed: true) {
    try? mobileData.write(to: URL(fileURLWithPath: CommandLine.arguments[2]))
}
`;

const SWIFT_SOURCE = `import Cocoa
import WebKit
import CoreBluetooth

final class NativeBleBridge: NSObject, CBCentralManagerDelegate, CBPeripheralDelegate {
    static let shared = NativeBleBridge()
    private var central: CBCentralManager?
    private var activePeripheral: CBPeripheral?
    private(set) var bleState: String = "idle"
    private(set) var deviceName: String = ""
    private(set) var latestWeightKg: Double? = nil
    private(set) var weightStabilized: Bool = false
    private(set) var latestHeartRateBpm: Int? = nil
    private(set) var lastUpdatedAt: String = ""

    private let weightScaleService = CBUUID(string: "181D")
    private let bodyCompService = CBUUID(string: "181B")
    private let heartRateService = CBUUID(string: "180D")
    private let weightMeasChar = CBUUID(string: "2A9D")
    private let bodyCompChar = CBUUID(string: "2A9C")
    private let hrMeasChar = CBUUID(string: "2A37")

    func startScan() {
        if central == nil {
            bleState = "initializing"
            central = CBCentralManager(delegate: self, queue: .main)
        } else if central?.state == .poweredOn {
            bleState = "scanning"
            central?.scanForPeripherals(
                withServices: [weightScaleService, bodyCompService, heartRateService],
                options: [CBCentralManagerScanOptionAllowDuplicatesKey: true]
            )
        }
    }

    func stopScan() {
        central?.stopScan()
        if let p = activePeripheral {
            central?.cancelPeripheralConnection(p)
            activePeripheral = nil
        }
        bleState = "stopped"
    }

    func statusJson() -> Data {
        var dict: [String: Any] = [
            "bleState": bleState,
            "deviceName": deviceName,
            "weightStabilized": weightStabilized,
            "updatedAt": lastUpdatedAt
        ]
        if let w = latestWeightKg { dict["weightKg"] = w }
        if let hr = latestHeartRateBpm { dict["heartRateBpm"] = hr }
        return (try? JSONSerialization.data(withJSONObject: dict)) ?? Data("{}".utf8)
    }

    func centralManagerDidUpdateState(_ central: CBCentralManager) {
        switch central.state {
        case .poweredOn:
            bleState = "scanning"
            central.scanForPeripherals(
                withServices: [weightScaleService, bodyCompService, heartRateService],
                options: [CBCentralManagerScanOptionAllowDuplicatesKey: true]
            )
        case .poweredOff:
            bleState = "poweredOff"
        case .unauthorized:
            bleState = "unauthorized"
        case .unsupported:
            bleState = "unsupported"
        default:
            bleState = "unavailable"
        }
    }

    func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral, advertisementData: [String: Any], rssi RSSI: NSNumber) {
        let name = peripheral.name ?? (advertisementData[CBAdvertisementDataLocalNameKey] as? String) ?? "BLE 运动健康设备"
        deviceName = name
        if activePeripheral == nil {
            activePeripheral = peripheral
            peripheral.delegate = self
            bleState = "connecting"
            central.connect(peripheral, options: nil)
        }
    }

    func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        bleState = "connected"
        deviceName = peripheral.name ?? deviceName
        peripheral.discoverServices([weightScaleService, bodyCompService, heartRateService])
    }

    func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
        guard let services = peripheral.services else { return }
        for svc in services {
            peripheral.discoverCharacteristics([weightMeasChar, bodyCompChar, hrMeasChar], for: svc)
        }
    }

    func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {
        guard let chars = service.characteristics else { return }
        for ch in chars {
            peripheral.setNotifyValue(true, for: ch)
        }
    }

    func peripheral(_ peripheral: CBPeripheral, didUpdateValueFor characteristic: CBCharacteristic, error: Error?) {
        guard let data = characteristic.value else { return }
        let bytes = [UInt8](data)
        let iso = ISO8601DateFormatter().string(from: Date())
        if characteristic.uuid == hrMeasChar, bytes.count >= 2 {
            let is16 = (bytes[0] & 0x01) == 1
            let bpm = is16 && bytes.count >= 3 ? Int(bytes[1]) | (Int(bytes[2]) << 8) : Int(bytes[1])
            if bpm >= 25 && bpm <= 250 {
                latestHeartRateBpm = bpm
                lastUpdatedAt = iso
            }
        } else if (characteristic.uuid == weightMeasChar || characteristic.uuid == bodyCompChar), bytes.count >= 3 {
            let flags = bytes[0]
            let isImperial = (flags & 0x01) == 1
            let isJin = (flags & 0x10) != 0
            let stabilized = (flags & 0x20) != 0 || (flags & 0x80) == 0
            let raw = Int(bytes[1]) | (Int(bytes[2]) << 8)
            var kg = isImperial ? Double(raw) * 0.01 * 0.45359237 : (isJin ? Double(raw) * 0.005 : Double(raw) * 0.005)
            if kg < 25 && Double(raw) * 0.01 >= 25 && Double(raw) * 0.01 <= 250 {
                kg = Double(raw) * 0.01
            }
            if kg >= 25 && kg <= 250 {
                latestWeightKg = (kg * 100).rounded() / 100
                weightStabilized = stabilized
                lastUpdatedAt = iso
            }
        }
    }
}

class BundleSchemeHandler: NSObject, WKURLSchemeHandler {
    let webRoot: URL

    init(webRoot: URL) {
        self.webRoot = webRoot
        super.init()
    }

    func mimeType(for ext: String) -> String {
        switch ext.lowercased() {
        case "html": return "text/html; charset=utf-8"
        case "js", "mjs": return "application/javascript; charset=utf-8"
        case "css": return "text/css; charset=utf-8"
        case "json", "webmanifest", "map": return "application/json; charset=utf-8"
        case "svg": return "image/svg+xml"
        case "png": return "image/png"
        case "ico": return "image/x-icon"
        case "woff2": return "font/woff2"
        case "woff": return "font/woff"
        case "ttf": return "font/ttf"
        default: return "application/octet-stream"
        }
    }

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url else {
            urlSchemeTask.didFailWithError(NSError(domain: NSURLErrorDomain, code: NSURLErrorBadURL))
            return
        }
        var relPath = url.path
        if relPath.hasPrefix("/") {
            relPath.removeFirst()
        }

        if relPath == "__menubar__/update" {
            let comps = URLComponents(url: url, resolvingAgainstBaseURL: false)
            let title = comps?.queryItems?.first(where: { $0.name == "title" })?.value ?? ""
            DispatchQueue.main.async {
                if let appDel = NSApp.delegate as? AppDelegate {
                    appDel.updateMenuBarTitle(title)
                }
                let payload = Data("{\\"ok\\":true}".utf8)
                let headers: [String: String] = [
                    "Content-Type": "application/json; charset=utf-8",
                    "Content-Length": "\\(payload.count)",
                    "Access-Control-Allow-Origin": "*",
                    "Cache-Control": "no-cache"
                ]
                if let response = HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: headers) {
                    urlSchemeTask.didReceive(response)
                }
                urlSchemeTask.didReceive(payload)
                urlSchemeTask.didFinish()
            }
            return
        }

        if relPath.hasPrefix("__ble__/") {
            let comps = URLComponents(url: url, resolvingAgainstBaseURL: false)
            let action = comps?.queryItems?.first(where: { $0.name == "action" })?.value ?? "status"
            DispatchQueue.main.async {
                if action == "start" {
                    NativeBleBridge.shared.startScan()
                } else if action == "stop" {
                    NativeBleBridge.shared.stopScan()
                }
                let payload = NativeBleBridge.shared.statusJson()
                let headers: [String: String] = [
                    "Content-Type": "application/json; charset=utf-8",
                    "Content-Length": "\\(payload.count)",
                    "Access-Control-Allow-Origin": "*",
                    "Cache-Control": "no-cache"
                ]
                if let response = HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: headers) {
                    urlSchemeTask.didReceive(response)
                }
                urlSchemeTask.didReceive(payload)
                urlSchemeTask.didFinish()
            }
            return
        }

        if relPath == "__market__/yahoo",
           let comps = URLComponents(url: url, resolvingAgainstBaseURL: false),
           let symbol = comps.queryItems?.first(where: { $0.name == "symbol" })?.value,
           let encoded = symbol.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed),
           let remoteURL = URL(string: "https://query1.finance.yahoo.com/v8/finance/chart/\\(encoded)?interval=5m&range=1d") {
            var req = URLRequest(url: remoteURL)
            req.setValue("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15", forHTTPHeaderField: "User-Agent")
            req.timeoutInterval = 4.0
            URLSession.shared.dataTask(with: req) { data, _, _ in
                let payload = data ?? Data("{}".utf8)
                let headers: [String: String] = [
                    "Content-Type": "application/json; charset=utf-8",
                    "Content-Length": "\\(payload.count)",
                    "Access-Control-Allow-Origin": "*",
                    "Cache-Control": "no-cache"
                ]
                if let response = HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: headers) {
                    urlSchemeTask.didReceive(response)
                }
                urlSchemeTask.didReceive(payload)
                urlSchemeTask.didFinish()
            }.resume()
            return
        }

        if relPath.isEmpty {
            relPath = "index.html"
        }

        var fileURL = webRoot.appendingPathComponent(relPath)
        var isDir: ObjCBool = false
        if !FileManager.default.fileExists(atPath: fileURL.path, isDirectory: &isDir) || isDir.boolValue {
            if relPath.hasPrefix("assets/index-") && relPath.hasSuffix(".js") {
                fileURL = webRoot.appendingPathComponent("assets/index.js")
            } else if relPath.hasPrefix("assets/index-") && relPath.hasSuffix(".css") {
                fileURL = webRoot.appendingPathComponent("assets/index.css")
            } else {
                fileURL = webRoot.appendingPathComponent("index.html")
            }
        }

        guard let data = try? Data(contentsOf: fileURL) else {
            urlSchemeTask.didFailWithError(NSError(domain: NSURLErrorDomain, code: NSURLErrorFileDoesNotExist))
            return
        }

        let mime = mimeType(for: fileURL.pathExtension)
        let headers: [String: String] = [
            "Content-Type": mime,
            "Content-Length": "\\(data.count)",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "no-cache"
        ]
        if let response = HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: headers) {
            urlSchemeTask.didReceive(response)
        }
        urlSchemeTask.didReceive(data)
        urlSchemeTask.didFinish()
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {}
}

class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, NSWindowDelegate {
    var window: NSWindow!
    var webView: WKWebView!
    var statusItem: NSStatusItem!
    var schemeHandler: BundleSchemeHandler?

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
        // Prevent EXC_BAD_ACCESS zombie window when closing and reopening from Dock or MenuBar
        window.isReleasedWhenClosed = false
        window.isMovableByWindowBackground = true
        window.backgroundColor = NSColor(calibratedRed: 0.071, green: 0.075, blue: 0.094, alpha: 1.0)
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
        if let webRoot = Bundle.main.resourceURL?.appendingPathComponent("web") {
            let handler = BundleSchemeHandler(webRoot: webRoot)
            self.schemeHandler = handler
            config.setURLSchemeHandler(handler, forURLScheme: "app")
        }

        let injectCSS = """
        document.documentElement.style.overscrollBehavior = 'none';
        document.body.style.overscrollBehavior = 'none';
        """
        let endScript = WKUserScript(source: injectCSS, injectionTime: .atDocumentEnd, forMainFrameOnly: true)
        config.userContentController.addUserScript(endScript)

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
        let ts = Int(Date().timeIntervalSince1970)
        if Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "web") != nil {
            var req = URLRequest(url: URL(string: "app://localhost/?shell=native&v=\\(ts)")!)
            req.cachePolicy = .reloadIgnoringLocalCacheData
            self.webView.load(req)
        } else {
            var req = URLRequest(url: URL(string: "http://127.0.0.1:4173/?shell=native&v=\\(ts)")!)
            req.cachePolicy = .reloadIgnoringLocalCacheData
            self.webView.load(req)
        }
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        loadAppBundle()
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

    func drawMenuBarCrestImage() -> NSImage {
        let size = NSSize(width: 18, height: 18)
        let img = NSImage(size: size, flipped: true) { rect in
            guard let ctx = NSGraphicsContext.current?.cgContext else { return false }
            let w = rect.width
            let h = rect.height
            let pt = { (_ x: CGFloat, _ y: CGFloat) -> CGPoint in
                CGPoint(x: (x / 32.0) * w, y: (y / 32.0) * h)
            }

            let badgeBox = CGRect(x: 1.2, y: 1.2, width: w - 2.4, height: h - 2.4)
            let badgePath = CGPath(roundedRect: badgeBox, cornerWidth: 4.5, cornerHeight: 4.5, transform: nil)
            ctx.addPath(badgePath)
            ctx.setFillColor(NSColor(calibratedRed: 0.055, green: 0.06, blue: 0.08, alpha: 1.0).cgColor)
            ctx.fillPath()
            ctx.addPath(badgePath)
            ctx.setStrokeColor(NSColor(calibratedRed: 0.90, green: 0.76, blue: 0.35, alpha: 0.95).cgColor)
            ctx.setLineWidth(1.1)
            ctx.strokePath()

            let goldBright = NSColor(calibratedRed: 0.99, green: 0.92, blue: 0.62, alpha: 1.0).cgColor
            let goldMid = NSColor(calibratedRed: 0.86, green: 0.70, blue: 0.25, alpha: 1.0).cgColor
            let goldDeep = NSColor(calibratedRed: 0.62, green: 0.45, blue: 0.12, alpha: 1.0).cgColor

            func fillPoly(_ points: [CGPoint], _ color: CGColor) {
                guard let f = points.first else { return }
                let p = CGMutablePath()
                p.move(to: f)
                for point in points.dropFirst() { p.addLine(to: point) }
                p.closeSubpath()
                ctx.addPath(p)
                ctx.setFillColor(color)
                ctx.fillPath()
            }

            // Faceted Golden V-Wings
            fillPoly([pt(6.0, 9.0), pt(11.0, 10.0), pt(16.0, 19.5), pt(16.0, 26.8)], goldBright)
            fillPoly([pt(26.0, 9.0), pt(21.0, 10.0), pt(16.0, 19.5), pt(16.0, 26.8)], goldMid)
            fillPoly([pt(11.0, 10.0), pt(16.0, 16.5), pt(16.0, 22.0), pt(9.2, 13.0)], goldDeep)
            // Faceted Golden Polaris Star
            fillPoly([pt(16.0, 4.2), pt(17.5, 7.6), pt(21.0, 9.0), pt(17.5, 10.4), pt(16.0, 13.8), pt(14.5, 10.4), pt(11.0, 9.0), pt(14.5, 7.6)], goldBright)

            return true
        }
        img.isTemplate = false
        return img
    }

    func setupStatusItem() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        if let button = statusItem.button {
            button.image = drawMenuBarCrestImage()
            button.imagePosition = .imageLeading
            button.title = ""
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

    func updateMenuBarTitle(_ text: String) {
        if let button = statusItem?.button {
            let clean = text
                .replacingOccurrences(of: "✦ ${APP_TITLE} · ", with: "")
                .replacingOccurrences(of: "✦ ${APP_TITLE}", with: "")
                .replacingOccurrences(of: "✦ 星途 · ", with: "")
                .replacingOccurrences(of: "✦ 星途", with: "")
            button.title = clean.isEmpty ? "" : " " + clean
        }
    }

    @objc func showMainWindow() {
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    @objc func hideWindow() {
        window.orderOut(nil)
    }

    @objc func reloadWebView() {
        loadAppBundle()
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
        loadAppBundle()
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

  // Always rebuild the Expo web bundle (`dist/`) unless SKIP_WEB_EXPORT=1 is explicitly set,
  // preventing stale `dist/` bundles from being packaged into the macOS .app bundle.
  if (process.env.SKIP_WEB_EXPORT !== '1') {
    console.log('Exporting fresh web bundle (dist/) before packaging macOS app...');
    rmSync(path.join(ROOT, 'dist'), { recursive: true, force: true });
    execFileSync('npm', ['run', 'export:web'], { cwd: ROOT, stdio: 'inherit' });
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
  const mobileIconOutPath = path.join(RESOURCES_DIR, 'MobileIcon.png');
  try {
    writeFileSync(iconSwiftFile, ICON_SWIFT, 'utf8');
    execFileSync('swift', [iconSwiftFile, iconOutPath, mobileIconOutPath], { stdio: 'inherit' });
    try {
      const iconsetDir = path.join(tmpDir, 'AppIcon.iconset');
      mkdirSync(iconsetDir, { recursive: true });
      for (const [sz, name] of [[16,'icon_16x16.png'],[32,'icon_16x16@2x.png'],[32,'icon_32x32.png'],[64,'icon_32x32@2x.png'],[128,'icon_128x128.png'],[256,'icon_128x128@2x.png'],[256,'icon_256x256.png'],[512,'icon_256x256@2x.png'],[512,'icon_512x512.png'],[1024,'icon_512x512@2x.png']]) {
        execFileSync('sips', ['-z', String(sz), String(sz), iconOutPath, '--out', path.join(iconsetDir, name)], { stdio: 'ignore' });
      }
      execFileSync('iconutil', ['-c', 'icns', iconsetDir, '-o', path.join(RESOURCES_DIR, 'AppIcon.icns')], { stdio: 'ignore' });
    } catch {}
    const fullBleedSrc = existsSync(mobileIconOutPath) ? mobileIconOutPath : iconOutPath;
    const assetTargets = [
      path.join(ROOT, 'assets', 'icon.png'),
      path.join(ROOT, 'assets', 'splash-icon.png'),
      path.join(ROOT, 'assets', 'android-icon-foreground.png'),
      path.resolve(ROOT, '..', 'viastela-icon-astrolabe-1024.png'),
    ];
    for (const target of assetTargets) {
      try {
        execFileSync('cp', [fullBleedSrc, target]);
      } catch {
        // Ignore if parent target is not writable in CI.
      }
    }
    writeFileSync(swiftFile, SWIFT_SOURCE, 'utf8');
    execFileSync('swiftc', ['-O', swiftFile, '-framework', 'Cocoa', '-framework', 'WebKit', '-o', binPath], {
      stdio: 'inherit',
    });
    execFileSync('chmod', ['+x', binPath]);
    try { execFileSync('xattr', ['-cr', APP_BUNDLE], { stdio: 'ignore' }); } catch {}
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

  // Build and sign Repo Root and Workspace Parent Root directly from scratch (identical to Charioteer)
  const compiledIconPng = path.join(RESOURCES_DIR, 'AppIcon.png');
  const compiledIconIcns = path.join(RESOURCES_DIR, 'AppIcon.icns');
  const targetBundles = [
    path.join(ROOT, APP_NAME),
    path.resolve(ROOT, '..', APP_NAME),
    path.resolve(ROOT, '..', 'Releases', displayName, APP_NAME),
  ];
  for (const bundlePath of targetBundles) {
    try {
      const contentsDir = path.join(bundlePath, 'Contents');
      rmSync(contentsDir, { recursive: true, force: true });
      const macosDir = path.join(contentsDir, 'MacOS');
      const resDir = path.join(contentsDir, 'Resources');
      const webDir = path.join(resDir, 'web');

      mkdirSync(macosDir, { recursive: true });
      mkdirSync(resDir, { recursive: true });
      writeFileSync(path.join(contentsDir, 'Info.plist'), INFO_PLIST, 'utf8');

      cpSync(binPath, path.join(macosDir, EXEC_NAME));
      execFileSync('chmod', ['+x', path.join(macosDir, EXEC_NAME)]);
      // Also provide fallback executable name in case LaunchServices cached the old displayName
      cpSync(binPath, path.join(macosDir, `${EXEC_NAME} Personal OS`));
      execFileSync('chmod', ['+x', path.join(macosDir, `${EXEC_NAME} Personal OS`)]);

      if (existsSync(compiledIconPng)) {
        cpSync(compiledIconPng, path.join(resDir, 'AppIcon.png'));
      }
      if (existsSync(compiledIconIcns)) {
        cpSync(compiledIconIcns, path.join(resDir, 'AppIcon.icns'));
      }
      if (existsSync(distDir)) {
        cpSync(distDir, webDir, { recursive: true });
      }

      try { execFileSync('xattr', ['-cr', bundlePath], { stdio: 'ignore' }); } catch {}
      execFileSync('codesign', ['--force', '--deep', '--sign', '-', bundlePath], { stdio: 'inherit' });
      console.log(`✓ Built & signed native macOS bundle: ${bundlePath}`);
    } catch {
      // Ignore if parent workspace is read-only in CI
    }
  }
}

main();
