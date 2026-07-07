import type { Metadata } from "next";
import "./globals.css";
import NavigationWithModal from "@/components/NavigationWithModal";
import GlobalBookModal from "@/components/GlobalBookModal";
import ThemeToggle from "@/components/ThemeToggle";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Petrichor | Library",
  description: "Personal, work-centric library and reading tracker.",
};

// Applies any saved theme choice to <html> before first paint, so a user who has
// explicitly picked a theme different from their OS preference never sees a flash
// of the wrong one.
const themeInitScript = `
(function () {
  try {
    var stored = localStorage.getItem("petrichor_theme");
    if (stored === "light" || stored === "dark") {
      document.documentElement.setAttribute("data-theme", stored);
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ThemeToggle />

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
