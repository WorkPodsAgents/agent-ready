#!/usr/bin/env bash
# Publishes a team build: checks, builds and zips the extension, then attaches the zip to a GitHub
# pre-release named after the commit, for testers to install with "Load unpacked" (TESTING.md).
# Run from a clean main; it refuses uncommitted changes so a build always matches a commit.
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -n "$(git status --porcelain)" ]]; then
  echo "commit or stash your changes first" >&2
  exit 1
fi

npm run check
npm run zip -w extension

version=$(node -p "require('./extension/package.json').version")
commit=$(git rev-parse --short=9 HEAD)
tag="team-v${version}-${commit}"
zip=$(ls extension/.output/agent-ready-"$version"-chrome.zip)

gh release create "$tag" "$zip" --prerelease --target "$(git rev-parse HEAD)" \
  --title "Team build ${version} (${commit})" \
  --notes "Team build for internal testing. Install it with the steps in TESTING.md."
