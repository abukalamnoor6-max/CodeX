import { Hero } from "@/components/Hero";
import { ProductCatalog } from "@/components/ProductCatalog";
import { PaymentInfo } from "@/components/PaymentInfo";
import { ReviewsFaq } from "@/components/ReviewsFaq";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Hero />
      <ProductCatalog />
      <PaymentInfo />
      <ReviewsFaq />
      <Footer />
    </>
  );
}
