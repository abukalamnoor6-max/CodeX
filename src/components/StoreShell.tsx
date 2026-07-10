"use client";

import { usePathname } from "next/navigation";
import { Header } from "@/components/Header";

export function StoreShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideChrome = pathname === "/login";

  return (
    <>
      {!hideChrome && <Header />}
      <main className="flex-1">{children}</main>
    </>
  );
}
