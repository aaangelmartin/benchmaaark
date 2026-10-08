// keeps public/data/dataset.json fresh while `pnpm dev` runs:
//   - on start, if the dataset is missing or older than maxAgeHours
//   - every checkEveryMinutes after that, under the same rule
//   - on demand with POST /api/refresh (the "actualizar" button)
// GET /api/status tells the app when the file changed so it reloads the data.
import { spawn } from 'node:child_process'
import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { loadEnv, type Plugin } from 'vite'

const ROOT = join(import.meta.dirname, '..')
const DATASET = join(ROOT, 'public', 'data', 'dataset.json')

export function dataRefresh({ maxAgeHours = 6, checkEveryMinutes = 30 } = {}): Plugin {
  let running: Promise<void> | null = null
  let lastRun: { at: string; ok: boolean } | null = null
  let hasAaKey = false

  const updatedAt = async () => {
    try {
      return (await stat(DATASET)).mtime
    } catch {
      return null
    }
  }

  const run = (reason: string) =>
    (running ??= new Promise<void>((done) => {
      console.log(`\n[data] refreshing (${reason})`)
      const child = spawn(
        process.execPath,
        ['--env-file-if-exists=.env', 'scripts/build-data.ts'],
        {
          cwd: ROOT,
          stdio: 'inherit',
        },
      )
      child.on('exit', (code) => {
        lastRun = { at: new Date().toISOString(), ok: code === 0 }
        running = null
        done()
      })
    }))

  const refreshIfStale = async () => {
    const mtime = await updatedAt()
    if (!mtime) return run('no dataset yet')
    const hours = (Date.now() - mtime.getTime()) / 3_600_000
    if (hours > maxAgeHours) return run(`${hours.toFixed(1)} h old`)
  }

  return {
    name: 'benchmaaark-data-refresh',
    apply: 'serve',
    config(_, { mode }) {
      hasAaKey = !!loadEnv(mode, ROOT, '').AA_API_KEY
    },
    configureServer(server) {
      if (process.env.VITEST) return
      server.middlewares.use('/api/status', async (_req, res) => {
        const mtime = await updatedAt()
        res.setHeader('content-type', 'application/json')
        res.end(
          JSON.stringify({
            updatedAt: mtime?.toISOString() ?? null,
            running: running !== null,
            lastRun,
            maxAgeHours,
            hasAaKey,
          }),
        )
      })
      server.middlewares.use('/api/refresh', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          return res.end()
        }
        void run('requested')
        res.statusCode = 202
        res.end('{}')
      })
      void refreshIfStale()
      const timer = setInterval(() => void refreshIfStale(), checkEveryMinutes * 60_000)
      server.httpServer?.on('close', () => clearInterval(timer))
    },
  }
}
