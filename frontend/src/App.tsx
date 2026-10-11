import { useEffect, useState } from 'react'

type ApiStatus = 'checking' | 'ok' | 'down'

// Placeholder shell for SPOT-10: proves the /api proxy reaches Django.
// The real app shell arrives in SPOT-50.
export default function App() {
  const [status, setStatus] = useState<ApiStatus>('checking')

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/v1/healthz', { signal: controller.signal })
      .then((res) => setStatus(res.ok ? 'ok' : 'down'))
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setStatus('down')
      })
    return () => controller.abort()
  }, [])

  return (
    <main className="mx-auto max-w-xl p-8 font-sans">
      <h1 className="text-2xl font-semibold">Weather-Aware Truck Routing</h1>
      <p className="mt-4">
        API: <span data-testid="api-status">{status}</span>
      </p>
    </main>
  )
}
