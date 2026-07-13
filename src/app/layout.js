import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import PrintProviderWrapper from "@/components/PrintProviderWrapper";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import AuthGuard from "@/components/AuthGuard";
import AppShell from "@/components/layout/AppShell";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "arabic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "arabic"],
});

export const metadata = {
  title: "هابي لاند - إدارة تأجير الخيام",
  description: "نظام إدارة احترافي لتأجير خيام الأفراح والمعدات",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <ThemeProvider>
          <AuthProvider>
            <PrintProviderWrapper>
              <AuthGuard>
                <AppShell>
                  {children}
                </AppShell>
              </AuthGuard>
            </PrintProviderWrapper>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
