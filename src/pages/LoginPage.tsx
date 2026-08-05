import { useState } from 'react'
import { ArrowRight, Loader2, Mail, Squircle } from 'lucide-react'
import { toast } from 'sonner'
import { auth } from '@/services/auth'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'

type Mode = 'signin' | 'signup' | 'magic'

export function LoginPage() {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      if (mode === 'signin') {
        await auth.signIn(email.trim(), password)
      } else if (mode === 'signup') {
        await auth.signUp(email.trim(), password, name.trim() || email.split('@')[0])
        toast.success('Check your email to confirm the account, then sign in.')
        setMode('signin')
      } else {
        await auth.signInWithMagicLink(email.trim())
        toast.success('Link sent — check your email.')
      }
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-bg px-5 py-10">
      <div className="w-full max-w-sm animate-[in-up_0.4s_var(--ease-out-quint)]">
        <div className="mb-8 text-center">
          <span className="mx-auto mb-4 grid size-11 place-items-center rounded-[var(--radius-lg)] bg-fg text-bg">
            <Squircle className="size-5" strokeWidth={2.5} />
          </span>
          <h1 className="text-[24px] font-semibold tracking-[-0.03em]">Atlas</h1>
          <p className="mt-1.5 text-[13px] text-muted">
            What should I do right now?
          </p>
        </div>

        <form onSubmit={submit} className="card space-y-4 p-5">
          {mode === 'signup' && (
            <Field label="Name">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                autoComplete="name"
              />
            </Field>
          )}

          <Field label="Email">
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </Field>

          {mode !== 'magic' && (
            <Field
              label="Password"
              hint={mode === 'signup' ? 'At least six characters.' : undefined}
            >
              <Input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              />
            </Field>
          )}

          <Button type="submit" variant="accent" size="lg" className="w-full" disabled={busy}>
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                {mode === 'signin' && 'Sign in'}
                {mode === 'signup' && 'Create account'}
                {mode === 'magic' && 'Email me a link'}
                <ArrowRight className="size-4" />
              </>
            )}
          </Button>

          <div className="flex items-center justify-between pt-1 text-[12px]">
            <button
              type="button"
              onClick={() => setMode(mode === 'signup' ? 'signin' : 'signup')}
              className="text-muted transition-colors hover:text-fg"
            >
              {mode === 'signup' ? 'I already have an account' : 'Create an account'}
            </button>
            <button
              type="button"
              onClick={() => setMode(mode === 'magic' ? 'signin' : 'magic')}
              className="inline-flex items-center gap-1 text-muted transition-colors hover:text-fg"
            >
              <Mail className="size-3" />
              {mode === 'magic' ? 'Use a password' : 'Magic link'}
            </button>
          </div>
        </form>

        {mode === 'signin' && (
          <button
            onClick={async () => {
              if (!email.trim()) {
                toast.error('Enter your email first.')
                return
              }
              await auth.resetPassword(email.trim())
              toast.success('Password reset email sent.')
            }}
            className="mx-auto mt-4 block text-[12px] text-faint transition-colors hover:text-muted"
          >
            Forgot your password?
          </button>
        )}
      </div>
    </div>
  )
}
