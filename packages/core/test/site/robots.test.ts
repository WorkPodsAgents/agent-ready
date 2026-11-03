import { describe, expect, it } from 'vitest'
import { AI_CRAWLERS, parseRobots, robotsFromAnswer } from '../../src/site'

describe('robots.txt', () => {
  it('lets the longest matching rule decide, with Allow winning a tie', () => {
    const robots = parseRobots(
      ['User-agent: *', 'Disallow: /shop', 'Allow: /shop/public', 'Allow: /x', 'Disallow: /x'].join(
        '\n',
      ),
    )
    expect(robots.allows('AnyBot', '/shop/cart')).toBe(false)
    expect(robots.allows('AnyBot', 'https://example.com/shop/public/a')).toBe(true)
    expect(robots.allows('AnyBot', '/x')).toBe(true)
    expect(robots.allows('AnyBot', '/about')).toBe(true)
  })

  it('reads * and $ in patterns', () => {
    const robots = parseRobots('User-agent: *\nDisallow: /*.pdf$\nDisallow: /search*q=')
    expect(robots.allows('a', '/files/guide.pdf')).toBe(false)
    expect(robots.allows('a', '/files/guide.pdf?v=2')).toBe(true)
    expect(robots.allows('a', 'https://example.com/search?q=shoes')).toBe(false)
  })

  it('uses the group naming a crawler by product token, else the * group', () => {
    const robots = parseRobots(
      [
        'User-agent: GPTBot',
        'User-agent: CCBot',
        'Disallow: /',
        '',
        'User-agent: *',
        'Disallow: /private',
        'Sitemap: https://example.com/sitemap.xml',
      ].join('\n'),
    )
    expect(robots.allows('GPTBot/1.2', '/')).toBe(false)
    expect(robots.allows('ccbot', '/blog')).toBe(false)
    expect(robots.allows('GPTBot-Extra', '/blog')).toBe(true)
    expect(robots.allows('ClaudeBot', '/private/a')).toBe(false)
    expect(robots.sitemaps).toEqual(['https://example.com/sitemap.xml'])
  })

  it('keeps Content-Signal lines with the group they sit in', () => {
    const robots = parseRobots(
      [
        'Content-Signal: search=yes, ai-train=no',
        'User-agent: *',
        'Content-Signal: ai-input=yes, use=ref',
        'Allow: /',
      ].join('\n'),
    )
    expect(robots.contentSignals).toEqual([
      { group: '*', signal: 'search', value: 'yes', allowed: true },
      { group: '*', signal: 'ai-train', value: 'no', allowed: false },
      { group: '*', signal: 'ai-input', value: 'yes', allowed: true },
      { group: '*', signal: 'use', value: 'ref', allowed: null },
    ])
  })

  it('allows everything after a 4xx and nothing after a 5xx, a 429 or no answer', () => {
    expect(robotsFromAnswer(404, '').allows('GPTBot', '/')).toBe(true)
    expect(robotsFromAnswer(503, 'User-agent: *\nAllow: /').allows('GPTBot', '/')).toBe(false)
    expect(robotsFromAnswer(429, '').allows('GPTBot', '/')).toBe(false)
    expect(robotsFromAnswer(null, '').allows('GPTBot', '/')).toBe(false)
  })

  it('tracks the AI crawlers of the WorkPods table with their roles', () => {
    expect(AI_CRAWLERS).toHaveLength(17)
    expect(AI_CRAWLERS.find((c) => c.token === 'OAI-SearchBot')?.role).toBe('search_index')
    expect(AI_CRAWLERS.find((c) => c.token === 'Claude-User')?.role).toBe('user_fetch')
  })
})
