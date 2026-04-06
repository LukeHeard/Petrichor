import type { Metadata } from "next";
import "./globals.css";
import NavigationWithModal from "@/components/NavigationWithModal";
import GlobalBookModal from "@/components/GlobalBookModal";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Petrichor | Library",
  description: "Personal, work-centric library and reading tracker.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <main className="main-container">
          {children}
        </main>

        <Suspense fallback={null}>
          <GlobalBookModal />
        </Suspense>

        <NavigationWithModal />
      </body>
    </html>
  );
}
