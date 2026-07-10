import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic, Space_Grotesk } from "next/font/google";
import { AuthProvider } from "@/lib/auth";
import { CartProvider } from "@/lib/cart";
import { AuthGate } from "@/components/AuthGate";
import { StoreShell } from "@/components/StoreShell";
import "./globals.css";

const display = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const body = IBM_Plex_Sans_Arabic({
  variable: "--font-body",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "codeX — برمجة فايف إم وبوتات دسكورد",
  description:
    "متجر codeX لبرمجة فايف إم، المابات، السيارات الخاصة، وبوتات الدسكورد",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${display.variable} ${body.variable} h-full antialiased`}
    >
      <body className="stars-bg flex min-h-full flex-col text-white">
        <AuthProvider>
          <CartProvider>
            <AuthGate>
              <StoreShell>{children}</StoreShell>
            </AuthGate>
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
