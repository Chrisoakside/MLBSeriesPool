import { LandingHeader } from "@/components/landing/header";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Features } from "@/components/landing/features";
import { JackpotShowcase } from "@/components/landing/jackpot-showcase";
import { FAQ } from "@/components/landing/faq";
import { AuthSection } from "@/components/landing/auth-section";
import { Footer } from "@/components/landing/footer";

export default function LandingPage() {
  return (
    <>
      <LandingHeader />
      <main>
        <Hero />
        <HowItWorks />
        <Features />
        <JackpotShowcase />
        <FAQ />
        <AuthSection />
      </main>
      <Footer />
    </>
  );
}
