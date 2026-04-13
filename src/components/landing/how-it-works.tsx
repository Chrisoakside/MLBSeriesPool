import { ClipboardList, Tv, Trophy } from "lucide-react";

const steps = [
  {
    number: 1,
    icon: ClipboardList,
    title: "Pick Your 6",
    description:
      "Every week, your admin sets spreads on 15 MLB weekend series. Choose 6 you like best and lock them in before Friday's first pitch.",
  },
  {
    number: 2,
    icon: Tv,
    title: "Watch It Play Out",
    description:
      "Follow your picks all weekend with live score updates. See cumulative runs vs. the spread update in real time on your ticket.",
  },
  {
    number: 3,
    icon: Trophy,
    title: "Go Perfect, Win Big",
    description:
      "Hit all 6 against the spread and you take the jackpot. Nobody perfect? The pot rolls over and grows week after week.",
  },
];

export function HowItWorks() {
  return (
    <section className="py-20 lg:py-28 bg-slate-900 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            How It Works
          </h2>
          <div className="w-16 h-1 bg-emerald-500 rounded-full mx-auto" />
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {steps.map((step) => (
            <div
              key={step.number}
              className="relative bg-slate-800/50 border border-slate-700/50 rounded-2xl p-8 text-center hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-300"
            >
              {/* Step number */}
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold text-sm mb-5">
                {step.number}
              </div>

              {/* Icon */}
              <div className="flex justify-center mb-4">
                <step.icon className="w-8 h-8 text-emerald-400" />
              </div>

              {/* Content */}
              <h3 className="text-xl font-semibold text-white mb-3">
                {step.title}
              </h3>
              <p className="text-slate-400 leading-relaxed">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
