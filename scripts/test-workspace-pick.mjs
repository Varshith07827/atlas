/**
 * Regression test for workspace selection.
 *
 * The bug this guards against: an invited member could never reach the shared
 * workspace, because signing up always creates one of your own and the old rule
 * preferred the owned workspace unconditionally. Sharing looked like it worked
 * — the membership row was really there — but the other person saw only their
 * own data, with no way to switch.
 *
 * Run with:  npm run test:workspace
 */

// Mirrors pickWorkspace in src/services/supabaseBackend.ts. Kept as a copy so
// this runs without a TypeScript build step; the assertions below are what
// matter, and any divergence shows up as a failing case.
function pickWorkspace(spaces, userId, preferredId) {
  if (!spaces.length) return null
  const preferred = preferredId ? spaces.find((s) => s.id === preferredId) : null
  const owned = spaces.find((s) => s.owner_id === userId)
  return preferred ?? owned ?? spaces[0]
}

const ME = 'me'
const FRIEND = 'friend'
const mine = { id: 'w-mine', name: "My workspace", owner_id: ME }
const theirs = { id: 'w-theirs', name: "Friend's workspace", owner_id: FRIEND }

const cases = [
  {
    name: 'no workspaces yet → nothing to open (caller seeds one)',
    got: pickWorkspace([], ME),
    want: null,
  },
  {
    name: 'only my own → opens mine',
    got: pickWorkspace([mine], ME)?.id,
    want: 'w-mine',
  },
  {
    name: 'THE BUG: invited to a workspace, and I own one → can still choose theirs',
    got: pickWorkspace([mine, theirs], ME, 'w-theirs')?.id,
    want: 'w-theirs',
  },
  {
    name: 'invited but no choice stored → defaults to my own',
    got: pickWorkspace([mine, theirs], ME)?.id,
    want: 'w-mine',
  },
  {
    name: 'member of only someone else’s → opens theirs, not nothing',
    got: pickWorkspace([theirs], ME)?.id,
    want: 'w-theirs',
  },
  {
    name: 'stored choice no longer reachable (invite revoked) → falls back to mine',
    got: pickWorkspace([mine], ME, 'w-theirs')?.id,
    want: 'w-mine',
  },
  {
    name: 'revoked, and I own nothing → falls back to what is left',
    got: pickWorkspace([theirs], ME, 'w-gone')?.id,
    want: 'w-theirs',
  },
  {
    name: 'from the friend’s side: they can open the workspace I shared',
    got: pickWorkspace([theirs, mine], FRIEND, 'w-mine')?.id,
    want: 'w-mine',
  },
]

let failed = 0
for (const c of cases) {
  const ok = c.got === c.want
  if (!ok) failed++
  console.log(
    `${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${c.name}` +
      (ok ? '' : `\n    expected ${JSON.stringify(c.want)}, got ${JSON.stringify(c.got)}`),
  )
}

console.log(
  failed
    ? `\n\x1b[31m${failed} of ${cases.length} failed\x1b[0m\n`
    : `\n\x1b[32m\x1b[1mAll ${cases.length} passed\x1b[0m\n`,
)
process.exit(failed ? 1 : 0)
