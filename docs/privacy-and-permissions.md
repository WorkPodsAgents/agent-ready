# Privacy and permissions

Agent Ready has no account, no server of ours and no telemetry. It doesn't send your data, your
results or your usage to WorkPods or anyone else. This page says exactly what it stores, what it
sends where, and why it asks for each permission. The code is open, so you can check every line.

## What stays on your device

| What                                            | Where                                                                                    |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Your API keys                                   | An encrypted vault in the extension's local storage. Never synced to your Google account |
| The key that unlocks the vault                  | Chrome's session storage, in memory only and cleared when Chrome closes                  |
| The same key, with **Remember on this device**  | IndexedDB, as a key the browser won't export                                             |
| Results, crawls, AI answer history and journeys | The extension's local storage and IndexedDB, on this device                              |
| Cached paid answers                             | IndexedDB, used for the reuse window (7 days by default)                                 |
| Your prompt panel, caps, spend and preferences  | The extension's local storage                                                            |

The vault encrypts each key with AES-GCM, under a key derived from your passphrase with PBKDF2
(600,000 iterations). Only the extension's background process decrypts a key, and only to call that
provider. Content scripts can't read the extension's storage at all. A key never reaches a web
page, the MCP bridge, a log or an export.

**Wipe data** in Settings deletes all of it.

### Firefox

Firefox 140 or later uses a sidebar and a background event page. Private records, including the
vault, settings, spend ledger and histories, are stored in extension-origin IndexedDB. Firefox
content scripts cannot access that database. The unlock key uses session storage and is not
persisted unless you enable **Remember on this device**.

Firefox displays a data-consent prompt at installation for the data types that optional provider
features can send: authentication information, browsing activity, website content, website activity
and search terms. These permissions do not enable telemetry; transfers happen only when you use
features that require them, as described below.

## What leaves your device, and when

| When you                                         | What is sent                                                     | To                                              |
| ------------------------------------------------ | ---------------------------------------------------------------- | ----------------------------------------------- |
| Check a page or crawl a site                     | Ordinary requests for its pages and files                        | That site, from your browser                    |
| Use Autocomplete                                 | Your seed term                                                   | Google's public suggestion service              |
| Run a paid action, or an agent calls a paid tool | The query (keywords, domains, prompts) and your key              | DataForSEO or Cloro                             |
| Run a journey with a model key                   | What the agent sees on each page: visible text and control names | Anthropic, OpenAI or Google                     |
| Run a journey with Chrome's built-in model       | Nothing; the model runs on your computer                         |                                                 |
| Use Assist mode                                  | Each prompt, when you press Enter                                | The AI assistant, in your own signed-in session |

Reading an AI answer or a Google results page that is already open in your tab sends nothing; the
extension reads what you see.

## The bridge

The MCP bridge runs on your computer. It talks to the extension over a WebSocket on `127.0.0.1`
port 47821, which other computers can't reach. Web pages can also open connections to localhost,
so the bridge accepts only the Agent Ready extension's own origin, and only one connection at a
time. The agent gets results, never keys.

The connection is off until you turn on **Agent connection** in Settings.

## Permissions

Agent Ready asks for as little as it can up front and asks for the rest when a feature needs it.

**At install (Chrome):**

| Permission  | Why                                                                                                  |
| ----------- | ---------------------------------------------------------------------------------------------------- |
| `sidePanel` | To show the panel beside the page                                                                    |
| `activeTab` | To read the tab you are on when you click **Check this page**                                        |
| `scripting` | To read the rendered page, mark an element for **Show on page**, and read AI answers in the open tab |
| `storage`   | To keep the vault, settings and preferences                                                          |
| `offscreen` | To parse fetched HTML with the browser's own parser, out of sight                                    |
| `alarms`    | To retry the connection to the bridge every so often while it is on                                  |

**When a feature needs them:**

| Permission       | Asked when                         | Why                                                                                                               |
| ---------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Access to a site | You first check or crawl that site | To fetch its pages and files. Asked one site at a time                                                            |
| `tabs`           | You first open the panel           | Chrome hides the address of the page in front of you without it, and the panel needs it to follow your tabs       |
| `webRequest`     | With a site's access               | To see each redirect hop of the extension's own requests. It only observes, and never blocks or changes a request |

Agent Ready doesn't ask for your Google sign-in, your history, your bookmarks or your downloads.
