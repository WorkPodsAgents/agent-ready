import { defineConfig } from 'wxt'

// The public half of the signing key. It fixes the extension id (pkkpkklkaaddigbdoinfaedbafmegjlp)
// for unpacked team builds and the store listing alike, so the native-messaging bridge and saved
// results survive every update. The private key never enters this repo.
const KEY =
  'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAszKegafGxN3ufg5JipmWEN9tW+DRNsIQ0UXjt9PNa8slYkuKiOnA9ghM3Oak0Wsz0HFqx40JQENA8704jgO6lwjv622ek/nP/OPE0Sb1Zow44rzDdvAzOXEQoPUSBKIaJwlZqm7Je2m4B5K+/y5LfaFT1vNZWxF0uflnIeo9Yn0cLqvDrlVclZ8geK2vFOxZXUqHPX4Bl+7Ls8egfHcYSADwOkU5ffbFeAEUraIU4alqz0cEDje0kyTwkm0+sqn+gpJ3WzQXuXJPXMoMXA16antzy17gUbaDMYjuPyDsCQ2P84iOkgBbsCla1iFFMIcdp/MxwweW2xckiZGV4Jzk2QIDAQAB'

/**
 * Sites the end-to-end run reads without a permission prompt, which a headless browser cannot
 * click. Only `wxt build --mode e2e` adds them; the published build asks per site.
 */
const E2E_HOSTS = ['*://*.staging.workpods.ai/*', '*://*.example.com/*']

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  zip: { artifactTemplate: 'agent-ready-{{version}}-{{browser}}.zip' },
  manifest: ({ mode }) => ({
    name: 'Agent Ready by WorkPods',
    short_name: 'Agent Ready',
    description:
      'See your site the way search engines, AI answers and AI agents see it, and fix what stops them.',
    key: KEY,
    permissions: [
      'sidePanel',
      'activeTab',
      'storage',
      'scripting',
      'offscreen',
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
    action: { default_title: 'Agent Ready' },
    icons: { 64: 'icon-64.png', 512: 'icon-512.png' },
  }),
})
