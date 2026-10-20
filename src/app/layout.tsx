import type { Metadata } from "next";
import { Bricolage_Grotesque, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Analytics } from "@vercel/analytics/next";
import { AccountProvider, type Account } from "@/components/account-provider";
import { SiteHeader } from "@/components/site-header";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getSession } from "@/lib/auth";
import { THEME_IDS } from "@/lib/themes";
import { loadUserData } from "@/lib/user-data.server";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  // Width lets the timer use condensed digits.
  axes: ["opsz", "wdth"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["500", "700"],
});

export const metadata: Metadata = {
  title: "Last Layer: algorithm trainer for 2x2 to 7x7 and megaminx",
  description: "Learn and drill every F2L, OLL and PLL algorithm, plus 2x2 Ortega, big-cube parity and the megaminx last layer.",
};

async function loadAccount(): Promise<Account | null> {
  const session = await getSession();
  if (!session) return null;
  const { onboarded, data } = await loadUserData(session.user.id);
  const { name, email, image } = session.user;
  return { user: { name, email, image }, onboarded, data };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Signed in, the account's data comes with the page, so stores never show this browser's.
  const account = await loadAccount();
  return (
    <html lang="en" suppressHydrationWarning className={`${bricolage.variable} ${jetbrains.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <ThemeProvider attribute="data-theme" themes={THEME_IDS} defaultTheme="daylight" enableSystem={false}>
          <AccountProvider account={account}>
            <TooltipProvider>
              <SiteHeader />
              <main className="flex flex-1 flex-col">{children}</main>
              <Toaster position="top-center" />
            </TooltipProvider>
          </AccountProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
