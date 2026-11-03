import { defineConfig } from 'wxt'

// The public half of the signing key. It fixes the extension id (lemechdbpooffhgeidkmefoppjjilanb)
// for unpacked team builds and the store listing alike, so the native-messaging bridge and saved
// results survive every update. The private key never enters this repo.
const KEY =
  'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAnUnPYVWy/3JCuUAYjcJ+OmnKICJ0S47rrHvEYfTpSJbjB7UPmGo53YlaChp7Uogh/YKyrY7LRF0UVsBSoJ8i+JwXMa6THc6vxxQzfRWv+9T5466pETkKI9uJYrQDdCIArmN7RzPbX2fYvbRabMDEQ8eVfTyDRt08WDQAb7IK//FQASAmxtOEBbwVXpOza4/svpYCM8+a2NVW8TS/3P46LjnffvM/bHZ303YQ67GwpkWRx0Y/yctNtWGFus8pDTYyGCJeZYpJ/oWVSQza2gkAFWEoHA0tl4VFP1L/duEhSTqnemZunOYCrLy5cdrvSjV5Szz2H0mcHNA6yP916Yto6wIDAQAB'

/**
 * Sites the end-to-end run reads without a permission prompt, which a headless browser cannot
 * click. Only `wxt build --mode e2e` adds them; the published build asks per site.
 */
const E2E_HOSTS = ['*://*.staging.workpods.ai/*', '*://*.example.com/*']

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  zip: { artifactTemplate: 'agent-ready-{{version}}-{{browser}}.zip' },
  manifest: ({ mode, browser }) => ({
    name: 'Agent Ready by WorkPods',
    short_name: 'Agent Ready',
    description:
      'See your site the way search engines, AI answers and AI agents see it, and fix what stops them.',
    // Chrome Web Store rejects the key field; unpacked builds use its public key for the same id.
    ...(browser === 'firefox' || process.env.WXT_STORE_UPLOAD === '1' ? {} : { key: KEY }),
    permissions: [
      ...(browser === 'firefox' ? [] : ['sidePanel' as const]),
      'activeTab',
      'storage',
      'scripting',
      ...(browser === 'firefox' ? [] : ['offscreen' as const]),
      'alarms',
      // The e2e build cannot answer a permission prompt, so it is given the grants up front.
      ...(mode === 'e2e' ? (['webRequest', 'tabs'] as const) : []),
    ],
    // webRequest is asked with each site when a check starts. It only observes: it reads the
    // redirect hops of the extension's own requests, which a manual-redirect fetch hides, and
    // Chrome refuses a webRequest listener without host access. tabs is asked once from the panel,
    // because Chrome hides the address of the page in front of the user without it.
    optional_permissions: ['webRequest', 'tabs'],
    optional_host_permissions: ['<all_urls>'],
    ...(mode === 'e2e' ? { host_permissions: E2E_HOSTS } : {}),
    ...(browser === 'firefox'
      ? {
          // Firefox's default CSP upgrades localhost ws to wss, which the local bridge cannot use.
          content_security_policy: {
            extension_pages:
              "script-src 'self'; object-src 'none'; connect-src https: http: ws://127.0.0.1:47821",
          },
          browser_specific_settings: {
            gecko_android: { strict_min_version: '142.0' },
            gecko: {
              id: 'agent-ready@workpods.ai',
              strict_min_version: '140.0',
              data_collection_permissions: {
                required: [
                  'authenticationInfo',
                  'browsingActivity',
                  'websiteContent',
                  'websiteActivity',
                  'searchTerms',
                ],
              },
            },
          },
        }
      : {}),
    action: { default_title: 'Agent Ready' },
    icons: { 64: 'icon-64.png', 512: 'icon-512.png' },
  }),
})
