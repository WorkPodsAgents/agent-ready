# Developer and release testing

For normal use, install Agent Ready from the
[Chrome Web Store](https://chromewebstore.google.com/detail/agent-ready-by-workpods/lemechdbpooffhgeidkmefoppjjilanb).
This guide covers unpacked builds for development, reproducing issues and testing a release.
The [repository](https://github.com/WorkPodsAgents/agent-ready) is public; you need Chrome on a desktop.

## Install a team build

1. Open the repository's Releases page and download the Chrome zip for the version you want to test
   (`agent-ready-<version>-chrome.zip`, or a `team-v…` build when provided).
2. Unzip it into a folder you will keep, such as `~/agent-ready-build`.
3. In Chrome, go to `chrome://extensions` and turn on **Developer mode** (top right).
4. Click **Load unpacked** and choose the unzipped folder.
5. Pin the extension from the puzzle-piece menu, then click its icon to open the side panel.
6. The first time, click **Allow** on "Let the panel follow your tabs", so the panel knows which
   page you are on. Then click **Check this page**; Chrome asks once per site to let the extension
   read it.

## Update to a newer build

Download the new zip, unzip it over the same folder, and press the reload arrow on the extension's
card in `chrome://extensions`. The extension id stays the same, so your saved settings and results
are kept.

## Report a problem

Open an issue with the **Tester feedback** template. Include the page URL, what you expected, what
you saw, and a screenshot of the side panel. Never paste an API key into an issue.

## What to try

Each build's release notes list what is new and what to try on it.
