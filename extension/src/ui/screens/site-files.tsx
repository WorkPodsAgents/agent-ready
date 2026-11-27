import type { AgentFile, EmergingSignal } from '@open-agent-ready/core/site'
import type { SiteFiles } from '../../shared/results'
import { call, grantSites } from '../client'
import { Badge, Dot } from '../components/badge'
import { Button } from '../components/button'
import { Card } from '../components/card'
import { ErrorNote } from '../components/notice'
import type { Tone } from '../components/tone'
import { Checklist } from '../page/checklist'
import { useTask } from '../use-task'
import styles from './screens.module.css'

const FILE_LABEL: Readonly<Record<AgentFile['kind'], string>> = {
  llms_txt: 'llms.txt',
  ai_catalog: 'AI catalog',
  mcp_server_card: 'MCP server card',
  a2a_agent_card: 'A2A agent card',
  ai_plugin: 'ai-plugin.json',
  api_catalog: 'API catalog',
  agent_skills_index: 'Agent skills index',
  oauth_protected_resource: 'MCP sign-in metadata',
}

const EMERGING_LABEL: Readonly<Record<EmergingSignal['standard'], string>> = {
  search_for_agents: 'Search for Agents',
  auth_md: 'auth.md',
  poppy: 'Poppy (poppy.json)',
}

const EMERGING_TONE: Readonly<Record<EmergingSignal['status'], { tone: Tone; text: string }>> = {
  found: { tone: 'good', text: 'Found' },
  absent: { tone: 'neutral', text: 'Not published' },
  unread: { tone: 'warn', text: 'No answer' },
}

/** A kind read at two addresses (the A2A card and its legacy name) says which file it is. */
function fileLabel(file: AgentFile, files: readonly AgentFile[]): string {
  const twice = files.filter((other) => other.kind === file.kind).length > 1
  return twice
    ? `${FILE_LABEL[file.kind]} (${new URL(file.url).pathname.split('/').pop()})`
    : FILE_LABEL[file.kind]
}

const ROLE_LABEL = { training: 'training', search_index: 'search', user_fetch: 'user fetch' }

function fileTone(file: AgentFile): { tone: Tone; text: string } {
  if (file.outcome === 'ok' && file.absence === null) {
    const broken = (file.problems?.length ?? 0) > 0
    return broken ? { tone: 'warn', text: 'Has problems' } : { tone: 'good', text: 'Found' }
  }
  if (file.outcome === 'blocked') return { tone: 'bad', text: 'Blocked' }
  if (file.outcome === 'failed') return { tone: 'warn', text: 'No answer' }
  return { tone: 'neutral', text: 'Not published' }
}

/** robots.txt, AI crawler access, sitemaps, the files agents read and the Markdown version. */
export function SiteFilesCard({ url }: { readonly url: string | null }) {
  const files = useTask<SiteFiles>()
  const run = () => {
    if (url === null) return
    void files.run(async () => {
      await grantSites(url)
      return call('site:files', { url })
    })
  }
  const value = files.value
  return (
    <Card
      title="Site files"
      subtitle="robots.txt, sitemaps, llms.txt and the agent manifests."
      actions={
        <Button busy={files.task.kind === 'running'} disabled={url === null} onClick={run}>
          {value === null ? 'Check files' : 'Check again'}
        </Button>
      }
    >
      {files.task.kind === 'failed' ? <ErrorNote>{files.task.error}</ErrorNote> : null}
      {value === null ? null : <FilesBody files={value} />}
    </Card>
  )
}

function FilesBody({ files }: { readonly files: SiteFiles }) {
  const { facts, sitemap } = files
  const blocked = facts.aiCrawlers.filter((crawler) => !crawler.allowed)
  const listed = sitemap.urls.length.toLocaleString('en-US')
  const tracked = facts.aiCrawlers.length
  const markdown = facts.markdown.servedOnAccept || facts.markdown.alternateServed === true
  return (
    <div className={styles.stack}>
      <ul className={styles.list}>
        <li className={styles.item}>
          <Dot tone={facts.robotsStatus !== null && facts.robotsStatus < 300 ? 'good' : 'warn'} />
          robots.txt answered {facts.robotsStatus ?? 'nothing'}
        </li>
        <li className={styles.item}>
          <Dot tone={sitemap.urls.length > 0 ? 'good' : 'warn'} />
          {sitemap.files.length} sitemap files list {listed} pages
          {sitemap.limited ? ' (stopped at the cap)' : ''}
        </li>
        <li className={styles.item}>
          <Dot tone={markdown ? 'good' : 'neutral'} />
          {markdown
            ? 'The home page has a Markdown version'
            : 'The home page has no Markdown version'}
        </li>
        {facts.agentFiles.map((file) => {
          const { tone, text } = fileTone(file)
          return (
            <li key={file.url} className={styles.item}>
              <Dot tone={tone} />
              {fileLabel(file, facts.agentFiles)}
              <Badge tone={tone}>{text}</Badge>
            </li>
          )
        })}
      </ul>
      <details className={styles.fold}>
        <summary>Emerging standards: shown for information, not scored</summary>
        <p className={styles.footnote}>
          Early drafts that few agents read yet. Skipping one never fails a check or lowers a score.
          DNS-AID is not checked, as reading it would send the domain to a third-party DNS resolver.
        </p>
        <ul className={styles.list}>
          {facts.emerging.map((signal) => {
            const { tone, text } = EMERGING_TONE[signal.status]
            return (
              <li key={signal.standard} className={styles.item}>
                <Dot tone={tone} />
                {EMERGING_LABEL[signal.standard]}
                <Badge tone={tone}>{text}</Badge>
              </li>
            )
          })}
        </ul>
      </details>
      <details className={styles.fold}>
        <summary>
          {blocked.length === 0
            ? `robots.txt lets all ${tracked} tracked AI crawlers read the home page.`
            : `robots.txt blocks ${blocked.length} of ${tracked} tracked AI crawlers.`}
        </summary>
        <div className={styles.chips}>
          {facts.aiCrawlers.map((crawler) => (
            <Badge key={crawler.token} tone={crawler.allowed ? 'good' : 'bad'}>
              {crawler.token} · {ROLE_LABEL[crawler.role]}
            </Badge>
          ))}
        </div>
      </details>
      <Checklist findings={files.findings} fix={{ url: files.origin, from: 'check' }} />
    </div>
  )
}
