"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-emerald-500 hover:bg-emerald-400 text-white shadow-sm shadow-emerald-500/20",
  secondary:
    "border border-slate-600 hover:border-slate-500 text-white hover:bg-slate-800/50",
  ghost: "text-slate-400 hover:text-white hover:bg-slate-800",
  danger: "bg-red-500 hover:bg-red-400 text-white",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-4 py-2 text-sm rounded-lg",
  md: "px-6 py-3 text-sm font-medium rounded-lg",
  lg: "px-8 py-4 text-base font-medium rounded-xl",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className = "", disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={`inline-flex items-center justify-center transition-colors duration-150 active:scale-[0.98] ${variantClasses[variant]} ${sizeClasses[size]} ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"} ${className}`}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
export { Button, type ButtonProps };
