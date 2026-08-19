/**
 * Build the published Node entries and the Web client bundle.
 * GitHub / pnpm installs consume lib/ only — no file: workspace deps.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const lib = join(root, 'lib')
function esbuildEntry(dir) {
  const main = join(dir, 'lib', 'main.js')
  return existsSync(main) ? main : undefined
}

async function loadEsbuild() {
  const direct = [
    join(process.env.USERPROFILE ?? '', 'Documents', 'GitHub', 'deepseek-harness', 'node_modules', 'esbuild'),
    join(root, 'node_modules', 'esbuild'),
  ]
  for (const dir of direct) {
    const main = esbuildEntry(dir)
    if (main) return import(pathToFileURL(main).href)
  }
  const pnpm = join(process.env.USERPROFILE ?? '', 'Documents', 'GitHub', 'deepseek-harness', 'node_modules', '.pnpm')
  if (existsSync(pnpm)) {
    const matches = readdirSync(pnpm).filter((name) => name.startsWith('esbuild@')).sort().reverse()
    for (const name of matches) {
      const main = esbuildEntry(join(pnpm, name, 'node_modules', 'esbuild'))
      if (main) return import(pathToFileURL(main).href)
    }
  }
  return import('esbuild')
}

function remapArticleTree(build) {
  build.onResolve({ filter: /^@deepseek-ai\/dsh-article-tree/ }, (args) => {
    let rest = args.path.slice('@deepseek-ai/dsh-article-tree'.length)
    if (rest.startsWith('/src/')) rest = rest.slice('/src/'.length)
    else if (rest.startsWith('/')) rest = rest.slice(1)
    if (rest === '') rest = 'index.ts'
    return { path: join(root, 'packages', 'article-tree', 'src', rest) }
  })
}

const external = [
  '@deepseek-ai/*',
  'zod',
  'react',
  'react-dom',
  'react/jsx-runtime',
]

async function main() {
  const esbuild = await loadEsbuild()
  mkdirSync(lib, { recursive: true })
  const common = {
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'es2022',
    sourcemap: false,
    logLevel: 'info',
    external,
    plugins: [{ name: 'remap-article-tree', setup: remapArticleTree }],
  }

  await Promise.all([
    esbuild.build({
      ...common,
      entryPoints: [join(root, 'packages', 'agent-drivers', 'src', 'index.ts')],
      outfile: join(lib, 'agent-drivers.js'),
    }),
    esbuild.build({
      ...common,
      entryPoints: [join(root, 'packages', 'article-tree', 'src', 'index.ts')],
      outfile: join(lib, 'article-tree.js'),
    }),
    esbuild.build({
      ...common,
      entryPoints: [join(root, 'packages', 'writehere', 'src', 'index.ts')],
      outfile: join(lib, 'writehere.js'),
    }),
    esbuild.build({
      ...common,
      entryPoints: [join(root, 'packages', 'ui-article-tree', 'src', 'index.ts')],
      outfile: join(lib, 'index.js'),
    }),
  ])

  const clientSrc = [
    join(root, 'packages', 'ui-article-tree', 'lib', 'client.js'),
    join(process.env.USERPROFILE ?? '', 'Documents', 'GitHub', 'deepseek-harness', 'packages', 'client', 'ui-article-tree', 'lib', 'client.js'),
  ].find(existsSync)
  if (clientSrc === undefined) {
    throw new Error('ui-article-tree client.js not found — build the harness UI package first')
  }
  let client = readFileSync(clientSrc, 'utf8')
  client = client.replaceAll('@deepseek-ai/dsh-client-ui-article-tree', 'dsh-agent-driver-writehere')
  writeFileSync(join(lib, 'client.js'), client)
  console.log('wrote', join(lib, 'client.js'))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
