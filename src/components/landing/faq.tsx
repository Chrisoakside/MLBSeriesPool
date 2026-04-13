"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

const faqs = [
  {
    question: "What exactly is a series spread?",
    answer:
      "Instead of betting on individual games, you're betting on the total cumulative runs scored across an entire weekend series (Friday–Sunday). If the spread is NYY -2.5, the Yankees need to outscore their opponent by more than 2.5 total runs across all games in the series to cover.",
  },
  {
    question: "How many picks do I need to make?",
    answer:
      "You pick exactly 6 out of the 15 available weekend series each week. Choose the 6 matchups where you feel most confident about the spread.",
  },
  {
    question: "What happens if nobody goes 6-for-6?",
    answer:
      "The entire pot rolls over to the following week. Entry fees from the new week get added on top, so the jackpot keeps growing until someone finally hits all 6. That's what makes it exciting — the pressure builds every week.",
  },
  {
    question: "How do I join a pool?",
    answer:
      "Your pool admin will give you an 8-character code or share a link/QR code. Enter the code on the join page, and you're in. Some pools require admin approval before you can start picking.",
  },
  {
    question: "Is this legal?",
    answer:
      "Series Spread is a social pool management tool for groups of friends, coworkers, and family. We don't accept wagers or handle money — payments are managed between you and your pool admin. Think of it like running a fantasy league.",
  },
  {
    question: "What does it cost?",
    answer:
      "The app is free to use. Your pool admin sets the buy-in amount (typically $10–$50/week). Payment is handled directly between members and the admin — we just track who's paid.",
  },
  {
    question: "Can I be in multiple pools?",
    answer:
      "Absolutely. You can join as many pools as you want and even run your own. Each pool is completely independent with its own lines, jackpot, and members.",
  },
  {
    question: "When do picks lock?",
    answer:
      "Picks lock the moment the first game of the weekend slate begins — typically Friday evening. You'll see a countdown timer on the picks page, and we'll send you a reminder notification too.",
  },
];

function FAQItem({
  question,
  answer,
}: {
  question: string;
  answer: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-slate-800 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full py-5 text-left cursor-pointer group"
      >
        <span className="text-white font-medium pr-4 group-hover:text-emerald-400 transition-colors">
          {question}
        </span>
        <ChevronDown
          className={`w-5 h-5 text-slate-500 flex-shrink-0 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ${
          open ? "max-h-96 pb-5" : "max-h-0"
        }`}
      >
        <p className="text-slate-400 leading-relaxed">{answer}</p>
      </div>
    </div>
  );
}

export function FAQ() {
  return (
    <section className="py-20 lg:py-28 bg-slate-950 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Questions? We&apos;ve Got Answers
          </h2>
          <div className="w-16 h-1 bg-emerald-500 rounded-full mx-auto" />
        </div>

        {/* FAQ Items */}
        <div>
          {faqs.map((faq) => (
            <FAQItem key={faq.question} {...faq} />
          ))}
        </div>
      </div>
    </section>
  );
}
