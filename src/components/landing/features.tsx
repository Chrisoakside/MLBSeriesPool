import {
  Activity,
  Grid3x3,
  TrendingUp,
  MessageSquare,
  Users,
  Settings,
} from "lucide-react";

const features = [
  {
    icon: Activity,
    title: "Live Ticket Tracking",
    description:
      "Watch your picks go green or red in real time as games unfold across the weekend.",
  },
  {
    icon: Grid3x3,
    title: "Public Picks Board",
    description:
      "See everyone's picks after lock. Full transparency — no hiding, no excuses.",
  },
  {
    icon: TrendingUp,
    title: "Rolling Jackpot",
    description:
      "Nobody perfect? The pot grows week after week, creating massive payouts when someone finally hits.",
  },
  {
    icon: MessageSquare,
    title: "Smack Talk Wall",
    description:
      "Built-in chat for bragging rights and friendly trash talk all weekend long.",
  },
  {
    icon: Users,
    title: "Multi-Pool Support",
    description:
      "Run or join multiple pools at once. Work league, friend group, fantasy — all in one place.",
  },
  {
    icon: Settings,
    title: "Admin Tools",
    description:
      "Set lines, manage payments, control the pot. Everything a commissioner needs in one dashboard.",
  },
];

export function Features() {
  return (
    <section className="py-20 lg:py-28 bg-slate-950 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Built for Serious Fun
          </h2>
          <div className="w-16 h-1 bg-emerald-500 rounded-full mx-auto" />
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-slate-700 transition-colors duration-200"
            >
              <feature.icon className="w-6 h-6 text-emerald-400 mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">
                {feature.title}
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
