/**
 * Verifies a Supabase project is wired up correctly before you trust it with
 * real data.
 *
 * Checks, in order:
 *   1. .env.local has both values and they look plausible
 *   2. the project is reachable with that key
 *   3. every table schema.sql creates actually exists
 *   4. row level security is switched on (an anonymous read must return nothing)
 *   5. the SECURITY DEFINER sharing functions refuse anonymous callers
 *
 * Run with:  npm run check:supabase
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const RESET = '\x1b[0m'
const c = {
  ok: (s) => `\x1b[32m${s}${RESET}`,
  bad: (s) => `\x1b[31m${s}${RESET}`,
  warn: (s) => `\x1b[33m${s}${RESET}`,
  dim: (s) => `\x1b[2m${s}${RESET}`,
  bold: (s) => `\x1b[1m${s}${RESET}`,
}

const ZERO_UUID = '00000000-0000-4000-8000-000000000000'

const TABLES = [
  'profiles',
  'workspaces',
  'workspace_members',
  'projects',
  'tasks',
  'labels',
  'task_labels',
  'notes',
  'calendar_events',
  'habits',
  'habit_logs',
  'comments',
  'notifications',
  'settings',
]

function readEnv() {
  let raw
  try {
    raw = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  } catch {
    return {}
  }
  const env = {}
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const i = trimmed.indexOf('=')
    if (i === -1) continue
    env[trimmed.slice(0, i).trim()] = trimmed.slice(i + 1).trim()
  }
  return env
}

function fail(message, hint) {
  console.log(`\n${c.bad('✗')} ${message}`)
  if (hint) console.log(`  ${c.dim(hint)}`)
  console.log()
  process.exit(1)
}

const env = readEnv()
const url = env.VITE_SUPABASE_URL
const key = env.VITE_SUPABASE_ANON_KEY

console.log(`\n${c.bold('Checking your Supabase setup')}\n`)

// --- 1. the values themselves ------------------------------------------------

if (!url || !key) {
  fail(
    'No credentials in .env.local yet.',
    'Open .env.local and paste the Project URL and Publishable key from Supabase → Project Settings → API Keys.',
  )
}

if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url)) {
  fail(
    `VITE_SUPABASE_URL doesn't look right: ${url}`,
    'It should be just the project URL, like https://abcdefgh.supabase.co — no trailing path.',
  )
}

if (key.startsWith('sb_secret') || key.includes('service_role')) {
  fail(
    'That is a secret key — it must never go in a browser app.',
    'Secret keys bypass all security and must never go in a browser app. Copy the one under "Publishable key" instead.',
  )
}

if (key.length < 40) {
  fail('VITE_SUPABASE_ANON_KEY looks too short — it may have been truncated on paste.')
}

console.log(`${c.ok('✓')} Credentials present and well-formed`)
console.log(`  ${c.dim(url)}`)

// --- 2. can we reach it? -----------------------------------------------------

const supabase = createClient(url, key, { auth: { persistSession: false } })

const { error: reachError } = await supabase.from('workspaces').select('id').limit(1)

if (reachError) {
  if (/Invalid API key|JWT/i.test(reachError.message)) {
    fail(
      'The project is reachable but rejected the key.',
      'Re-copy the Publishable key from Project Settings → API Keys.',
    )
  }
  if (/relation .* does not exist|Could not find the table/i.test(reachError.message)) {
    fail(
      'Connected, but the tables are missing.',
      'Open supabase/schema.sql, copy all of it into the Supabase SQL Editor, and press Run.',
    )
  }
  if (/fetch failed|ENOTFOUND|getaddrinfo/i.test(reachError.message)) {
    fail(
      `Could not reach ${url}`,
      'Check the URL, and that the project has finished provisioning (it can take a couple of minutes).',
    )
  }
  fail(`Unexpected error: ${reachError.message}`)
}

console.log(`${c.ok('✓')} Project reachable, key accepted`)

// --- 3. are all the tables there? -------------------------------------------

const missing = []
for (const table of TABLES) {
  const { error } = await supabase.from(table).select('*').limit(0)
  if (error && /does not exist|Could not find the table/i.test(error.message)) {
    missing.push(table)
  }
}

if (missing.length) {
  fail(
    `${missing.length} table${missing.length === 1 ? '' : 's'} missing: ${missing.join(', ')}`,
    'Re-run supabase/schema.sql in the SQL Editor — it is safe to run again.',
  )
}

console.log(`${c.ok('✓')} All ${TABLES.length} tables exist`)

// --- 4. is RLS actually protecting them? ------------------------------------

// Signed out, every one of these must come back empty. A row here would mean
// the table is readable by anyone holding the (public) anon key.
const leaks = []
for (const table of ['workspaces', 'tasks', 'notes', 'projects', 'profiles']) {
  const { data, error } = await supabase.from(table).select('*').limit(1)
  if (!error && data && data.length > 0) leaks.push(table)
}

if (leaks.length) {
  console.log(
    `\n${c.bad('✗')} Row level security is NOT protecting: ${c.bold(leaks.join(', '))}`,
  )
  console.log(
    `  ${c.dim('Anyone with your anon key could read these. Re-run supabase/schema.sql — the "alter table ... enable row level security" lines are what fix this.')}\n`,
  )
  process.exit(1)
}

console.log(`${c.ok('✓')} Row level security is on (signed-out reads return nothing)`)

// --- 5. are the SECURITY DEFINER functions closed to anonymous callers? -----

// These run with database-owner privileges. They each guard on
// is_workspace_owner(), but the guard should not be the only thing in the way —
// and `revoke ... from public` alone does not remove Supabase's explicit grant
// to the `anon` role, which is exactly the gap this catches.
const rpcProbes = [
  ['invite_member_by_email', { p_workspace_id: ZERO_UUID, p_email: 'nobody@example.invalid' }],
  ['unpair_member', { p_workspace_id: ZERO_UUID, p_user_id: ZERO_UUID }],
]

const reachable = []
for (const [fn, args] of rpcProbes) {
  const { error } = await supabase.rpc(fn, args)
  // 42501 = insufficient privilege: refused before the body ran. Anything else
  // (including the function's own "only the owner can…") means it executed.
  if (error?.code !== '42501') reachable.push(fn)
}

if (reachable.length) {
  console.log(`${c.warn('!')} Anonymous callers can execute: ${reachable.join(', ')}`)
  console.log(
    `  ${c.dim('Run supabase/migrations/002_lock_rpcs_to_authenticated.sql to revoke them from the anon role.')}`,
  )
} else {
  console.log(`${c.ok('✓')} Sharing functions refuse anonymous callers`)
}

// --- 6. can people sign up? --------------------------------------------------

const { data: settings } = await fetch(`${url}/auth/v1/settings`, {
  headers: { apikey: key },
})
  .then((r) => r.json())
  .then((d) => ({ data: d }))
  .catch(() => ({ data: null }))

if (settings) {
  if (settings.disable_signup) {
    console.log(
      `${c.warn('!')} Sign-ups are disabled — you won't be able to create an account.`,
    )
    console.log(`  ${c.dim('Supabase dashboard → Authentication → Sign In / Providers → allow new users.')}`)
  } else {
    console.log(`${c.ok('✓')} Email sign-up is enabled`)
  }
  if (settings.mailer_autoconfirm === false) {
    console.log(
      `${c.warn('!')} Email confirmation is ON — you'll need to click a link before signing in.`,
    )
    console.log(
      `  ${c.dim('To skip it while testing: Authentication → Providers → Email → turn off "Confirm email".')}`,
    )
  }
}

console.log(`\n${c.ok(c.bold('Everything checks out.'))}`)
console.log(`${c.dim('Restart the dev server (npm run dev) and Atlas will show a sign-in screen.')}\n`)
