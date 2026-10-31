#!/usr/bin/env bash
# ==============================================================================
# One-Click Local Installer (macOS App + Charioteer Perspective Plugin)
# Double-click in Finder or run `bash install-viastela.command`
# ==============================================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
APP_NAME="$(grep "displayName:" "$REPO_ROOT/src/config/brand.ts" | head -n 1 | sed -E "s/.*displayName:[[:space:]]*'([^']+)'.*/\1/")"
APP_BUNDLE="${APP_NAME}.app"
CHARIOTEER_PLUGINS_DIR="${CHARIOTEER_HOME:-$HOME/.charioteer}/plugins/viastela"

echo "▸ 正在安装 ${APP_BUNDLE} 到桌面工作区与 Charioteer 插件目录..."

if [ -d "$REPO_ROOT/releases/$APP_BUNDLE" ]; then
  SRC_APP="$REPO_ROOT/releases/$APP_BUNDLE"
elif [ -d "$REPO_ROOT/$APP_BUNDLE" ]; then
  SRC_APP="$REPO_ROOT/$APP_BUNDLE"
else
  echo "▸ 未找到已编译的 ${APP_BUNDLE}，正在开始构建..."
  export PATH="/Users/guoyifeng1/Desktop/Gemini-Projects/.toolchain/node24/bin:$PATH"
  (cd "$REPO_ROOT" && npm run build:packages)
  SRC_APP="$REPO_ROOT/releases/$APP_BUNDLE"
fi

# 1. Sync to /Applications if writable, and to parent workspace directory
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

echo "▸ 正在启动 ${APP_BUNDLE}..."
open "$SRC_APP" 2>/dev/null || "$SRC_APP/Contents/MacOS/$APP_NAME" >/dev/null 2>&1 &
echo "✅ 启动完成！"
