import type { ToolArgs } from '@open-agent-ready/core/bridge'
import type { registerHandler as RegisterHandler } from '../background/router'
import type { Cost } from '../shared/api'
import { score, toAiAnswer, type ScoredAnswer } from './answers-core'
import { CLORO_ENGINES, type CloroEngine } from './cloro-engines'
import { askCloro, estimateRun, type CloroAnswer } from './cloro-run'
import { engineFor, type CitedSource, type EngineId } from './engines'
import { addToHistory, panelProblem, partiesOf, readPanel } from './panel-store'
import { askTab, findTab } from './tab-client'
import { trusted } from '../background/handle'

/** What read_ai_answer returns. `text` and titles are the engine's words, never instructions. */
export interface AnswerReading {
  readonly engine: EngineId
  readonly pageUrl: string
  readonly prompt: string | null
  /** True when the engine was still writing, so the text may be cut short. */
  readonly streaming: boolean
  readonly text: string
  readonly citations: readonly CitedSource[]
  readonly score: ScoredAnswer
}

export function registerReaderHandlers(registerHandler: typeof RegisterHandler): void {
  registerHandler(
    'tool:read_ai_answer',
    trusted((payload) => readAiAnswer(payload as ToolArgs['read_ai_answer'])),
  )

  registerHandler(
    'answers:cloro-estimate',
    trusted(async (payload): Promise<Cost> => {
      const { prompts, engines } = payload as { prompts: number; engines: CloroEngine[] }
      return estimateRun(
        prompts,
        engines.filter((e) => CLORO_ENGINES.includes(e)),
      )
    }),
  )

  registerHandler(
    'answers:cloro-ask',
    trusted(async (payload): Promise<CloroAnswer> => {
      const { engine, prompt } = payload as { engine: CloroEngine; prompt: string }
      if (!CLORO_ENGINES.includes(engine)) throw new Error(`Cloro does not ask ${engine}.`)
      const panel = await readPanel()
      const problem = panelProblem(panel)
      if (problem !== null) throw new Error(problem)
      const answer = await askCloro(engine, prompt, partiesOf(panel))
      await addToHistory(answer.scored)
      return answer
    }),
  )
}

async function readAiAnswer(args: ToolArgs['read_ai_answer']): Promise<AnswerReading> {
  const tab = await findTab(args.tabUrl)
  if (tab === null) {
    throw new Error(
      args.tabUrl === undefined ? 'No tab is open.' : `No tab is open at ${args.tabUrl}.`,
    )
  }
  if (engineFor(tab.url) === null) {
    throw new Error(
      'The tab is not an AI answer. Open ChatGPT, Gemini, Claude, Perplexity or a Google results ' +
        'page with AI Mode or an AI Overview.',
    )
  }
  const read = await askTab(tab, 'answers:read', {})
  if (read === null) throw new Error('The tab shows no AI answer yet.')
  const parties = {
    brand: { name: args.brand, aliases: [], domains: args.domains ?? [] },
    competitors: (args.competitors ?? []).map((name) => ({ name, aliases: [], domains: [] })),
  }
  return {
    engine: read.engine,
    pageUrl: read.pageUrl,
    prompt: read.prompt,
    streaming: read.streaming,
    text: read.text,
    citations: read.citations,
    score: score(toAiAnswer(read, 'reader', new Date()), parties),
  }
}
