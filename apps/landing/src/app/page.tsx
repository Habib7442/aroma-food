import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { HowItWorks } from "@/components/HowItWorks";
import { PopularDishes } from "@/components/PopularDishes";
import { WhyZaavo } from "@/components/WhyZaavo";
import { AppCta } from "@/components/AppCta";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <Hero />
        <HowItWorks />
        <PopularDishes />
        <WhyZaavo />
        <AppCta />
      </main>
      <Footer />
    </>
  );
}
