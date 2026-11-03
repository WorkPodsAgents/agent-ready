import { parseHTML } from 'linkedom'
import { describe, expect, it } from 'vitest'
import { awaitAnswer, fillPrompt } from '../../src/readers/assist'
import { engineFor } from '../../src/readers/engines'

const url = 'https://claude.ai/chat/1'
const claude = engineFor(url)

function page(body: string): Document {
  return parseHTML(`<!doctype html><html><body>${body}</body></html>`)
    .document as unknown as Document
}

const turn = (text: string, streaming: boolean) =>
  `<div data-is-streaming="${streaming}"><div class="standard-markdown"><p>${text}</p></div></div>`

describe('Assist mode', () => {
  it('fills the prompt box and never submits or clicks send', () => {
    const doc = page('<form><textarea></textarea><button type="submit">Send</button></form>')
    let submitted = 0
    doc.querySelector('form')?.addEventListener('submit', () => (submitted += 1))
    doc.querySelector('button')?.addEventListener('click', () => (submitted += 1))
    const input = doc.querySelector('textarea') as unknown as HTMLTextAreaElement

    fillPrompt(input, 'Best running shoes?')

    expect(input.value).toBe('Best running shoes?')
    expect(submitted).toBe(0)
  })

  it('waits past the old answer and the stream, then returns the settled answer', async () => {
    if (claude === null) throw new Error('no Claude adapter')
    const doc = page(turn('Old answer.', false))
    // What the page shows at each poll: the old answer, the user sends, streaming, then done.
    const frames = [
      turn('Old answer.', false),
      turn('Acme', true),
      turn('Acme Running is a good pick.', true),
      turn('Acme Running is a good pick.', false),
    ]
    let poll = 0
    const sleep = async () => {
      poll += 1
      doc.body.innerHTML = frames[Math.min(poll, frames.length - 1)] ?? ''
    }

    const answer = await awaitAnswer(doc, claude, () => url, {
      before: 'Old answer.',
      quietMs: 1000,
      timeoutMs: 10_000,
      pollMs: 500,
      sleep,
    })

    expect(answer?.text).toBe('Acme Running is a good pick.')
    expect(answer?.streaming).toBe(false)
  })

  it('gives up when no new answer arrives in time', async () => {
    if (claude === null) throw new Error('no Claude adapter')
    const doc = page(turn('Old answer.', false))
    const answer = await awaitAnswer(doc, claude, () => url, {
      before: 'Old answer.',
      quietMs: 1000,
      timeoutMs: 3000,
      pollMs: 500,
      sleep: async () => undefined,
    })
    expect(answer).toBeNull()
  })
})
