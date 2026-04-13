export function JackpotShowcase() {
  return (
    <section className="py-20 lg:py-28 bg-slate-900 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Jackpot Card */}
        <div className="relative rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-slate-800 to-slate-900 p-10 sm:p-14 text-center overflow-hidden">
          {/* Glow effect */}
          <div className="absolute inset-0 bg-emerald-500/5 rounded-2xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-emerald-500/10 rounded-full blur-3xl animate-shimmer" />

          <div className="relative z-10">
            <p className="text-xs uppercase tracking-widest text-emerald-400 mb-4">
              Average Pool Jackpot
            </p>
            <p className="text-5xl sm:text-7xl font-bold text-white font-mono tabular-nums mb-4">
              $2,450
            </p>
            <p className="text-slate-400">
              Growing every week nobody goes perfect
            </p>
          </div>
        </div>

        {/* Testimonials */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-12">
          {[
            {
              quote: "Best thing to happen to our group chat since the fantasy league.",
              name: "Jake T.",
              pool: "The Boys League",
            },
            {
              quote: "I've never been more invested in a random Royals-Tigers series.",
              name: "Sarah M.",
              pool: "Office Pool '26",
            },
            {
              quote: "The rollover mechanic is genius. Week 8 pot was $4,000.",
              name: "Chris L.",
              pool: "College Buddies",
            },
          ].map((t) => (
            <div
              key={t.name}
              className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6"
            >
              <p className="text-slate-300 text-sm leading-relaxed mb-4">
                &ldquo;{t.quote}&rdquo;
              </p>
              <div>
                <p className="text-white text-sm font-medium">{t.name}</p>
                <p className="text-slate-500 text-xs">{t.pool}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
