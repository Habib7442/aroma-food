import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Container } from "@/components/Container";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="flex-1 py-16 sm:py-20">
        <Container className="max-w-3xl">{children}</Container>
      </main>
      <Footer />
    </>
  );
}
