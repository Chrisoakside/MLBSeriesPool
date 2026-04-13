"use client";

import { forwardRef, type InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = "", id, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={id}
            className="block text-sm font-medium text-slate-300 mb-1.5"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={`w-full bg-slate-900 border rounded-lg px-4 py-3 text-white placeholder:text-slate-500 outline-none transition-colors duration-150 ${
            error
              ? "border-red-500 focus:border-red-400 focus:ring-1 focus:ring-red-500/50"
              : "border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50"
          } ${className}`}
          {...props}
        />
        {error && <p className="mt-1.5 text-sm text-red-400">{error}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";
export { Input };
