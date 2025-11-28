import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'glass';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  icon,
  className = '',
  disabled,
  ...props
}) => {
  // Base: Rounded-2xl, transitions
  const baseStyles = "relative overflow-hidden inline-flex items-center justify-center rounded-2xl font-semibold transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 hover:scale-105 active:scale-95";
  
  const variants = {
    primary: "bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-lg shadow-orange-500/30 hover:shadow-orange-500/40 border border-transparent",
    secondary: "bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 shadow-sm hover:shadow-md",
    outline: "bg-transparent border border-slate-300 text-slate-600 hover:bg-slate-50 hover:border-slate-400 hover:text-slate-800",
    danger: "bg-gradient-to-r from-red-500 to-pink-600 text-white shadow-lg shadow-red-500/30 border border-transparent",
    glass: "bg-white/50 hover:bg-white/80 text-orange-700 border border-white/60 shadow-sm backdrop-blur-md",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-5 py-2.5 text-sm",
    lg: "px-8 py-4 text-base",
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {/* Shimmer effect overlay */}
      <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/40 to-transparent z-0 pointer-events-none" />

      <div className="relative z-10 flex items-center">
        {isLoading && (
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        )}
        {!isLoading && icon && <span className="mr-2">{icon}</span>}
        {children}
      </div>
    </button>
  );
};