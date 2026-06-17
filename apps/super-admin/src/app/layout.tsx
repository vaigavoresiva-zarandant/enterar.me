import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { SessionProviderWrapper } from "@/components/providers/session-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ENTERAR.ME · Super Admin",
  description:
    "Panel del Super Admin de ENTERAR.ME — gestión de tenants, planes, marketplace, agente IA global e informes de plataforma.",
  applicationName: "ENTERAR.ME Super Admin",
  authors: [{ name: "ENTERAR.ME" }],
  icons: {
    icon: "/logo.svg",
    shortcut: "/logo.svg",
    apple: "/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${mono.variable} font-sans antialiased`}
      >
        <ThemeProvider>
          <SessionProviderWrapper>
            <QueryProvider>
              <TooltipProvider delayDuration={150}>
                {children}
                <Toaster position="top-right" richColors closeButton />
              </TooltipProvider>
            </QueryProvider>
          </SessionProviderWrapper>
        </ThemeProvider>
      </body>
    </html>
  );
}
