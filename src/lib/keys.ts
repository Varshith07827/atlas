import type { KeyboardEvent } from 'react'

/**
 * Enter-to-submit for single-line inputs.
 *
 * Browsers only submit a form implicitly under a surprising set of conditions,
 * and inside a Radix dialog's focus scope it can't be relied on at all. Capture
 * is the one interaction in Atlas that has to work every single time, so the
 * key is handled explicitly instead of hoping the form does it.
 *
 * Shift+Enter is left alone (newline in multi-line fields), and an Enter that
 * closes an IME composition is ignored — otherwise typing in Japanese or
 * Chinese would file a half-finished task.
 */
export function onEnter(handler: () => void) {
  return (e: KeyboardEvent) => {
    if (e.key !== 'Enter' || e.shiftKey) return
    if ((e.nativeEvent as unknown as { isComposing?: boolean }).isComposing) return
    e.preventDefault()
    handler()
  }
}
