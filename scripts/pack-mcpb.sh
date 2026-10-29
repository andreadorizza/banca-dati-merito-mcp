#!/bin/sh
# Builds banca-dati-merito-mcp-<version>.mcpb for one-click install in Claude Desktop.
# The bundle holds the compiled server and its production dependencies only.
set -eu

root=$(cd "$(dirname "$0")/.." && pwd)
stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT

cd "$root"
npm run build
version=$(node -p 'require("./package.json").version')
manifest_version=$(node -p 'require("./manifest.json").version')
plugin_version=$(node -p 'require("./.claude-plugin/plugin.json").version')
if [ "$version" != "$manifest_version" ] || [ "$version" != "$plugin_version" ]; then
  echo "versions differ: package.json $version, manifest.json $manifest_version, plugin.json $plugin_version" >&2
  exit 1
fi
if ! grep -q "banca-dati-merito-mcp@$version" README.md; then
  echo "README.md does not pin banca-dati-merito-mcp@$version" >&2
  exit 1
fi

cp -R dist manifest.json package.json package-lock.json LICENSE README.md "$stage/"
cp assets/icon.png "$stage/icon.png"
(cd "$stage" && npm ci --omit=dev --ignore-scripts --no-audit --no-fund >/dev/null)
npx -y @anthropic-ai/mcpb@2.1.2 pack "$stage" "$root/banca-dati-merito-mcp-$version.mcpb"
