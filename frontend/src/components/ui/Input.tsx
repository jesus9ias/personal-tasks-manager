import type { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export function Input({ error, className, ...props }: InputProps) {
  const cls = [error && 'error', className].filter(Boolean).join(' ') || undefined;
  return <input className={cls} {...props} />;
}
