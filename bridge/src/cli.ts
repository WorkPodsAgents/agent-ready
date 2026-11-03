import { main } from './commands'

// `mcp` keeps running on stdio after main returns, so the exit code only sets how it ends.
main(process.argv.slice(2), (text) => process.stdout.write(text)).then(
  (code) => {
    process.exitCode = code
  },
  (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`agent-ready: ${message}\n`)
    process.exitCode = 2
  },
)
