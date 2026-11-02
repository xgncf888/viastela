#!/usr/bin/env bash
# ==============================================================================
# One-Click Local Installer (macOS App + Charioteer Perspective Plugin)
# Double-click in Finder or run `bash install-viastela.command`
# ==============================================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
WORKSPACE_ROOT="$(cd "$REPO_ROOT/.." && pwd)"
APP_NAME="$(grep "displayName:" "$REPO_ROOT/src/config/brand.ts" | head -n 1 | sed -E "s/.*displayName:[[:space:]]*'([^']+)'.*/\1/")"
APP_BUNDLE="${APP_NAME}.app"
CHARIOTEER_PLUGINS_DIR="${CHARIOTEER_HOME:-$HOME/.charioteer}/plugins/viastela"

echo "▸ 正在同步安装 ${APP_BUNDLE} 到工作区根目录与 Charioteer 插件目录..."

if [ -d "$REPO_ROOT/$APP_BUNDLE" ]; then
  SRC_APP="$REPO_ROOT/$APP_BUNDLE"
elif [ -d "$WORKSPACE_ROOT/$APP_BUNDLE" ]; then
  SRC_APP="$WORKSPACE_ROOT/$APP_BUNDLE"
else
  echo "▸ 未找到已编译的 ${APP_BUNDLE}，正在开始构建..."
  export PATH="/Users/guoyifeng1/Desktop/Gemini-Projects/.toolchain/node24/bin:$PATH"
  (cd "$REPO_ROOT" && npm run build:packages)
  SRC_APP="$REPO_ROOT/$APP_BUNDLE"
fi

# 1. Sync to Gemini-Projects workspace root (alongside Charioteer.app)
if [ "$SRC_APP" != "$WORKSPACE_ROOT/$APP_BUNDLE" ]; then
  rm -rf "$WORKSPACE_ROOT/$APP_BUNDLE"
  ditto "$SRC_APP" "$WORKSPACE_ROOT/$APP_BUNDLE"
  codesign --force --deep --sign - "$WORKSPACE_ROOT/$APP_BUNDLE" >/dev/null 2>&1 || true
  echo "✅ 已同步到工作区根目录: $WORKSPACE_ROOT/$APP_BUNDLE"
fi

# 2. Sync to /Applications if writable
if [ -w "/Applications" ]; then
  rm -rf "/Applications/$APP_BUNDLE"
  ditto "$SRC_APP" "/Applications/$APP_BUNDLE"
  codesign --force --deep --sign - "/Applications/$APP_BUNDLE" >/dev/null 2>&1 || true
  echo "✅ 已安装到系统应用程序: /Applications/$APP_BUNDLE"
fi

mkdir -p "$CHARIOTEER_PLUGINS_DIR"
if [ -f "$REPO_ROOT/releases/viastela-charioteer-plugin.zip" ]; then
  ditto -x -k "$REPO_ROOT/releases/viastela-charioteer-plugin.zip" "$CHARIOTEER_PLUGINS_DIR"
  echo "✅ 已注册 Charioteer 插件: $CHARIOTEER_PLUGINS_DIR/charioteer-plugin.json"
fi

echo "▸ 正在启动 $WORKSPACE_ROOT/$APP_BUNDLE..."
open "$WORKSPACE_ROOT/$APP_BUNDLE" 2>/dev/null || "$WORKSPACE_ROOT/$APP_BUNDLE/Contents/MacOS/$APP_NAME" >/dev/null 2>&1 &
echo "✅ 启动完成！"
