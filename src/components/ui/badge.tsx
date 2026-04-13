import { type HTMLAttributes } from "react";

type BadgeVariant =
  | "default"
  | "winning"
  | "losing"
  | "pending"
  | "void"
  | "live"
  | "admin"
  | "member";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-slate-700 text-slate-300",
  winning: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20",
  losing: "bg-red-500/15 text-red-400 border border-red-500/20",
  pending: "bg-slate-700/50 text-slate-400",
  void: "bg-amber-500/15 text-amber-400 border border-amber-500/20",
  live: "bg-blue-500/15 text-blue-400 border border-blue-500/20",
  admin: "bg-amber-500/10 text-amber-400",
  member: "bg-slate-700 text-slate-300",
};

export function Badge({
  variant = "default",
  className = "",
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
