import { describe, expect, it } from 'vitest'
import { CHECKS, check, threshold } from '../src'

const THEMES = ['lifecycle', 'technical', 'content', 'seo', 'geo']
const SEVERITIES = ['critical', 'high', 'medium', 'low']

describe('the WorkPods check registry', () => {
  it('gives every check a known theme, severity and a rubric line per severity', () => {
    expect(CHECKS.size).toBeGreaterThan(0)
    for (const entry of CHECKS.values()) {
      expect(THEMES).toContain(entry.theme)
      expect(SEVERITIES).toContain(entry.defaultSeverity)
      for (const severity of SEVERITIES) expect(entry.rubric).toHaveProperty(severity)
    }
  })

  it('finds a check and a threshold by id, and refuses an unknown one', () => {
    expect(check('llms_txt_invalid').theme).toBeDefined()
    expect(threshold('ai_readability.min_text_share')).toBeGreaterThan(0)
    expect(() => check('no_such_check')).toThrow('unknown check id')
  })
})
