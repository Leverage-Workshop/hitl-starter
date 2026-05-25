import type { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'ghost' | 'brass' | 'danger'
}

export function Button({ variant = 'ghost', children, className, ...rest }: ButtonProps) {
  const cls = [
    'btn',
    variant === 'brass'  ? 'btn--brass'  : '',
    variant === 'danger' ? 'btn--danger' : '',
    className ?? '',
  ].filter(Boolean).join(' ')

  return (
    <button className={cls} {...rest}>
      {children}
    </button>
  )
}
