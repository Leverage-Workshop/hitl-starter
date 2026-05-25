interface BracketMarkProps {
  size?: number
}

export function BracketMark({ size = 22 }: BracketMarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" aria-hidden="true">
      <path d="M 12 14 L 6 14 L 6 42 L 12 42" fill="none" stroke="var(--fg)" strokeWidth="2.5" strokeLinecap="square" />
      <path d="M 44 14 L 50 14 L 50 42 L 44 42" fill="none" stroke="var(--fg)" strokeWidth="2.5" strokeLinecap="square" />
      <rect x="17" y="26" width="4" height="4" fill="var(--fg-muted)" />
      <rect x="26" y="26" width="4" height="4" fill="var(--fg-muted)" />
      <rect x="35" y="26" width="4" height="4" fill="var(--c-brass)" />
    </svg>
  )
}
