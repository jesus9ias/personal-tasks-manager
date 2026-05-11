import type { ReactNode } from 'react';

interface FieldProps {
  label?: string;
  children: ReactNode;
  className?: string;
}

export function Field({ label, children, className }: FieldProps) {
  return (
    <div className={`field${className ? ` ${className}` : ''}`}>
      {label && <label>{label}</label>}
      {children}
    </div>
  );
}
