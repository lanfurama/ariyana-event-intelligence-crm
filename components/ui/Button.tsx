import type React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-500 text-white shadow-sm hover:bg-brand-600 disabled:hover:bg-brand-500 border border-transparent',
  secondary:
    'bg-white text-slate-700 border border-slate-300 shadow-sm hover:bg-slate-50 hover:text-slate-900',
  ghost: 'bg-transparent text-slate-600 border border-transparent hover:bg-slate-100',
  danger:
    'bg-white text-rose-600 border border-rose-200 shadow-sm hover:bg-rose-50 hover:border-rose-300',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'px-2.5 py-1.5 text-xs gap-1.5',
  md: 'px-3.5 py-2 text-sm gap-2',
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

/** Standard action button. Icon goes inline as a child next to the label. */
export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  className = '',
  type = 'button',
  children,
  ...rest
}) => (
  <button
    type={type}
    className={`inline-flex items-center justify-center font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
    {...rest}
  >
    {children}
  </button>
);
