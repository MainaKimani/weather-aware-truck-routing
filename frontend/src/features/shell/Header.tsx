import type { ReactNode } from 'react'

import { ThemeToggle } from './ThemeToggle'

interface HeaderProps {
  /** Status badges shown next to the title, such as "Demo data". */
  badges?: ReactNode
}

export function Header({ badges }: HeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-4">
      <a
        href="/"
        className="flex items-center gap-2 rounded-md font-semibold"
        aria-label="Weather-Aware Truck Routing, home"
      >
        <LogoMark />
        <span className="hidden sm:inline">Weather-Aware Truck Routing</span>
      </a>
      {badges}
      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
      </div>
    </header>
  )
}

function LogoMark() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-6 text-accent"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 17h2l2-6h6l2 6h6" />
      <circle cx="8" cy="18" r="2" />
      <circle cx="18" cy="18" r="2" />
      <path d="M7 7a5 5 0 0 1 10 0" />
    </svg>
  )
}
