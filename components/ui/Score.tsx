export function Score({ v }: { v: number }) {
  return (
    <span className="score">
      <span className="score__bar">
        <span className="score__fill" style={{ width: `${v}%` }}></span>
      </span>
      <span>{v}</span>
    </span>
  )
}
