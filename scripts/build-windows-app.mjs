#!/usr/bin/env node
/**
 * Builds the Windows 10/11 Native WebView2 Thin Shell desktop package (`releases/viastela-windows.zip`).
 * Uses Windows built-in .NET + Edge WebView2 (`--app` native window host) so the app launches
 * instantaneously with zero Electron bloat (~1 MB package size).
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST_DIR = path.join(ROOT, 'dist');
const RELEASES_DIR = path.join(ROOT, 'releases');

function readDisplayName() {
  const brandSrc = readFileSync(path.join(ROOT, 'src', 'config', 'brand.ts'), 'utf8');
  const match = brandSrc.match(/displayName:\s*'([^']+)'/);
  return match ? match[1] : 'App';
}

function main() {
  const displayName = readDisplayName();
  mkdirSync(RELEASES_DIR, { recursive: true });

  const stageRoot = path.join(os.tmpdir(), `viastela-win-${Date.now()}`);
  const appFolder = path.join(stageRoot, `${displayName}-Windows-x64`);
  const webDest = path.join(appFolder, 'web');
  mkdirSync(webDest, { recursive: true });

  if (existsSync(DIST_DIR)) {
    cpSync(DIST_DIR, webDest, { recursive: true });
  }

  const psHostScript = `# ${displayName} — Windows 10/11 Native WebView2 Thin Shell Host
$ErrorActionPreference = "Stop"
$Port = 4178
$WebRoot = Join-Path $PSScriptRoot "web"

$Listener = New-Object System.Net.HttpListener
$Listener.Prefixes.Add("http://127.0.0.1:$Port/")
$Listener.Start()

$Job = Start-Job -ScriptBlock {
  param($Port, $WebRoot)
  $MimeMap = @{
    ".html" = "text/html; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".svg"  = "image/svg+xml"
    ".png"  = "image/png"
    ".ico"  = "image/x-icon"
    ".woff2"= "font/woff2"
  }
  while ($true) {
    try {
      $Ctx = $Listener.GetContext()
      $Rel = $Ctx.Request.Url.AbsolutePath.TrimStart('/')
      if ([string]::IsNullOrEmpty($Rel)) { $Rel = "index.html" }
      $FilePath = Join-Path $WebRoot $Rel
      if (-not (Test-Path $FilePath -PathType Leaf)) {
        $FilePath = Join-Path $WebRoot "index.html"
      }
      $Ext = [System.IO.Path]::GetExtension($FilePath).ToLower()
      $Ctx.Response.ContentType = if ($MimeMap.ContainsKey($Ext)) { $MimeMap[$Ext] } else { "application/octet-stream" }
      $Bytes = [System.IO.File]::ReadAllBytes($FilePath)
      $Ctx.Response.ContentLength64 = $Bytes.Length
      $Ctx.Response.OutputStream.Write($Bytes, 0, $Bytes.Length)
      $Ctx.Response.OutputStream.Close()
    } catch { break }
  }
}

Start-Process "msedge.exe" -ArgumentList "--app=http://127.0.0.1:$Port/?shell=native --window-size=1320,860"
`;

  const cmdLauncher = `@echo off
title ${displayName} Native Desktop
powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0launch-webview2.ps1"
`;

  writeFileSync(path.join(appFolder, 'launch-webview2.ps1'), psHostScript, 'utf8');
  writeFileSync(path.join(appFolder, `${displayName}.cmd`), cmdLauncher, 'utf8');

  const outZip = path.join(RELEASES_DIR, 'viastela-windows.zip');
  rmSync(outZip, { force: true });
  execFileSync('ditto', ['-c', '-k', '--norsrc', stageRoot, outZip], { stdio: 'inherit' });
  rmSync(stageRoot, { recursive: true, force: true });
  console.log(`✓ Built Windows PC Native WebView2 package: ${outZip}`);
}

main();
