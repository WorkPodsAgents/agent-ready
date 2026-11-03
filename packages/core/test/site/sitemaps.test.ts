import { describe, expect, it } from 'vitest'
import { parseSitemap, readSitemaps } from '../../src/site'
import { fakeSite } from './fake-site'

const urlset = (...locs: string[]) =>
  `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${locs
    .map((l) => `<url><loc>${l}</loc></url>`)
    .join('')}</urlset>`

describe('sitemaps', () => {
  it('reads each page URL, never the image URLs it embeds, and decodes entities', () => {
    const parsed = parseSitemap(
      `<urlset xmlns:image="x"><!-- <url><loc>https://example.com/old</loc></url> -->
        <url><loc>https://example.com/a?x=1&amp;y=2</loc>
          <image:image><image:loc>https://example.com/a.png</image:loc></image:image></url>
        <url><loc><![CDATA[https://example.com/b]]></loc></url></urlset>`,
    )
    expect(parsed).toEqual({
      index: false,
      locs: ['https://example.com/a?x=1&y=2', 'https://example.com/b'],
      complete: true,
    })
  })

  it('tells an index from a urlset and a truncated file from a whole one', () => {
    const index = parseSitemap(
      '<sm:sitemapindex xmlns:sm="s"><sm:sitemap><sm:loc>https://example.com/s1.xml</sm:loc>' +
        '</sm:sitemap></sm:sitemapindex>',
    )
    expect(index).toEqual({ index: true, locs: ['https://example.com/s1.xml'], complete: true })
    expect(parseSitemap('<urlset><url><loc>https://example.com/a</loc></url>').complete).toBe(false)
    expect(parseSitemap('<html>not a sitemap</html>').complete).toBe(false)
  })

  it('expands an index and keeps a failed child with its reason', async () => {
    const site = fakeSite({
      'https://example.com/sitemap.xml': {
        body:
          '<sitemapindex><sitemap><loc>https://example.com/a.xml</loc></sitemap>' +
          '<sitemap><loc>https://example.com/b.xml</loc></sitemap></sitemapindex>',
      },
      'https://example.com/a.xml': {
        body: urlset('https://example.com/1', 'https://example.com/2'),
      },
      'https://example.com/b.xml': { status: 500 },
    })
    const read = await readSitemaps(site, ['https://example.com/sitemap.xml'])
    expect(read.urls).toEqual(['https://example.com/1', 'https://example.com/2'])
    expect(read.files.map((f) => [f.url, f.outcome, f.error])).toEqual([
      ['https://example.com/sitemap.xml', 'ok', null],
      ['https://example.com/a.xml', 'ok', null],
      ['https://example.com/b.xml', 'failed', 'http_500'],
    ])
    expect(read.limited).toBe(false)
  })
})
