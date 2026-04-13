import { Diamond } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-slate-950 border-t border-slate-800 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Diamond className="w-4 h-4 text-emerald-500" />
          <span className="text-sm font-semibold tracking-tight uppercase text-slate-400">
            Series Spread
          </span>
        </div>

        <div className="flex items-center gap-6 text-sm text-slate-500">
          <a href="#" className="hover:text-slate-300 transition-colors">
            About
          </a>
          <a href="#" className="hover:text-slate-300 transition-colors">
            Privacy
          </a>
          <a href="#" className="hover:text-slate-300 transition-colors">
            Terms
          </a>
          <a href="#" className="hover:text-slate-300 transition-colors">
            Contact
          </a>
        </div>

        <p className="text-sm text-slate-600">
          &copy; {new Date().getFullYear()} Series Spread
        </p>
      </div>
    </footer>
  );
}
