import "~/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";

import { TRPCReactProvider } from "~/trpc/react";
import Sidebar from "./_components/Sidebar";

export const metadata: Metadata = {
  title: "TVS Middleware - PIB Matching System",
  description: "Automated Document Matching Engine for PIB & Supporting Documents",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable}`} suppressHydrationWarning>
      <body className="bg-slate-100/70 text-slate-800 font-sans antialiased overflow-hidden" suppressHydrationWarning>
        <TRPCReactProvider>
          <div className="flex h-screen w-screen overflow-hidden">
            {/* Global Sidebar Component */}
            <Sidebar />
            
            {/* Main View Area */}
            <main className="flex-1 flex flex-col h-screen overflow-y-auto bg-slate-50">
              <div className="px-8 py-10 pt-12 flex-1 max-w-7xl w-full mx-auto space-y-6">
                {children}
              </div>
            </main>
          </div>
        </TRPCReactProvider>
      </body>
    </html>
  );
}
