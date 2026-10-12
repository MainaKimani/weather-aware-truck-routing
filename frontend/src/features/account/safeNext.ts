/**
 * Where to go after signing in: the `next` the guard sent along, if it is a
 * path on this site. Anything else (another site, `//evil.example`) is
 * ignored, so a crafted link can't send someone away after they log in.
 */
export function safeNext(next: string | null): string {
  if (!next?.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return '/'
  return next
}
