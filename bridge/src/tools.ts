// Every tool the bridge offers an agent: its input schema and the description the agent reads.
// Agents see only these words, so each says what the tool does, when to use it, how its arguments
// combine and what comes back. The shapes mirror ToolArgs in the core's bridge protocol.
import { z } from 'zod'
import type { ToolArgs, ToolName } from '@open-agent-ready/core/bridge'

const url = (what: string) =>
  z.string().url().describe(`${what}, an absolute http or https URL such as https://example.com/.`)

const location = z
  .string()
  .optional()
  .describe(
    'The market to read, as a country name DataForSEO knows, such as "United States" or ' +
      '"United Kingdom". Defaults to the market set in the extension.',
  )

const competitors = z
  .array(z.string())
  .min(1)
  .max(10)
  .describe('Competitor domains without a scheme, such as ["rival.com", "other.example"]; 1 to 10.')

export const SHAPES = {
  audit_page: {
    url: url('The page to check'),
    brandName: z
      .string()
      .optional()
      .describe(
        'The site\'s brand name as people search for it, such as "Acme Running". When given, ' +
          'the organization identity check compares the home page schema with it.',
      ),
  },
  crawl_site: {
    url: url('Where the crawl starts, usually the home page'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(1000)
      .optional()
      .describe('The most pages to fetch, 1 to 1000. Defaults to 200.'),
    pinned: z
      .array(z.string().url())
      .optional()
      .describe(
        'Money pages to crawl first, whatever the limit: pricing, product, booking or contact ' +
          'pages, as absolute URLs. Defaults to none.',
      ),
  },
  site_files: { url: url('Any page on the site; only its origin is used') },
  see_as_agent: { url: url('The page to read') },
  compare_pages: {
    url: url("The user's own page"),
    competitorUrl: url("The competitor's page that targets the same search or task"),
  },
  read_ai_answer: {
    tabUrl: z
      .string()
      .url()
      .optional()
      .describe(
        'The URL of the open tab holding the answer. Defaults to the active tab. Works on ' +
          'ChatGPT, Gemini, Claude, Perplexity, Google AI Mode and AI Overviews.',
      ),
    brand: z
      .string()
      .min(1)
      .describe('The brand to look for in the answer, such as "Acme Running".'),
    competitors: z
      .array(z.string())
      .optional()
      .describe('Competitor brand names to look for as well. Defaults to none.'),
    domains: z
      .array(z.string())
      .optional()
      .describe(
        'The brand\'s own domains without a scheme, such as ["acme.example"], so citations of ' +
          'them count as the brand being cited. Defaults to none, which leaves every citation ' +
          'unattributed to the brand.',
      ),
  },
  keyword_ideas: {
    seeds: z
      .array(z.string().min(1))
      .min(1)
      .max(20)
      .describe('1 to 20 seed terms the ideas grow from, such as ["trail running shoes"].'),
    location,
    language: z
      .string()
      .optional()
      .describe(
        'The language code, such as "en" or "de". Defaults to the market\'s main language.',
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(1000)
      .optional()
      .describe('The most ideas to return, 1 to 1000. Defaults to 100. More ideas cost more.'),
  },
  keyword_gap: {
    domain: z
      .string()
      .min(1)
      .describe('The user\'s domain without a scheme, such as "acme.example".'),
    competitors,
    location,
    limit: z
      .number()
      .int()
      .min(1)
      .max(1000)
      .optional()
      .describe('The most keywords to return, 1 to 1000. Defaults to 100.'),
  },
  backlinks_summary: {
    target: z
      .string()
      .min(1)
      .describe('A domain without a scheme (acme.example) or a full page URL to summarise.'),
  },
  link_gap: {
    domain: z
      .string()
      .min(1)
      .describe('The user\'s domain without a scheme, such as "acme.example".'),
    competitors,
    limit: z
      .number()
      .int()
      .min(1)
      .max(1000)
      .optional()
      .describe('The most linking domains to return, 1 to 1000. Defaults to 100.'),
  },
  journey_observe: {
    journeyId: z
      .string()
      .optional()
      .describe(
        'The journey to look at again, from an earlier journey_observe. Omit to start one.',
      ),
    url: z
      .string()
      .url()
      .optional()
      .describe(
        'Where a new journey starts, usually the home page. Required when journeyId is absent.',
      ),
    task: z
      .string()
      .optional()
      .describe(
        'What a customer\'s agent was asked to do, such as "find the price of the Pro plan". ' +
          'Required when journeyId is absent.',
      ),
  },
  journey_act: {
    journeyId: z.string().describe('The journey from journey_observe.'),
    action: z
      .discriminatedUnion('kind', [
        z.object({ kind: z.literal('click'), ref: z.string() }),
        z.object({ kind: z.literal('type'), ref: z.string(), text: z.string() }),
        z.object({ kind: z.literal('select'), ref: z.string(), value: z.string() }),
        z.object({ kind: z.literal('navigate'), url: z.string().url() }),
        z.object({ kind: z.literal('scroll'), direction: z.enum(['up', 'down']) }),
        z.object({
          kind: z.literal('finish'),
          outcome: z.enum(['completed_read_only', 'reached_confirmation', 'partial', 'blocked']),
          note: z.string(),
        }),
      ])
      .describe(
        'One step. click, type and select take a ref from the last observation; type also ' +
          'takes text (an obvious test value only) and select a value. navigate takes a URL, ' +
          'scroll a direction (up or down). finish ends the journey with its outcome: ' +
          'completed_read_only (the information was found), reached_confirmation (the final ' +
          'step was reached and not pressed), partial (progress, then a real failure) or ' +
          'blocked (no progress), and a note saying where and why.',
      ),
  },
} as const

// Compile-time guard: each schema, once JSON drops its undefined members, is the protocol's
// argument type, so a protocol change that is not mirrored here fails the typecheck.
type Parsed<T extends ToolName> = z.infer<z.ZodObject<(typeof SHAPES)[T]>>
type Defined<T> = { [K in keyof T]: Exclude<T[K], undefined> }
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
type Assert<T extends true> = T
export type ShapesMatchProtocol = Assert<
  { [T in ToolName]: Same<Defined<Parsed<T>>, ToolArgs[T]> }[ToolName]
>
