import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import ChatWidget from "@/components/ChatWidget";
import { ChatProvider } from "@/components/ChatContext";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Zaytri — AI Social Media Agent",
  description: "Multi-Agent Social Media Automation System powered by AI",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <Providers>
          <ChatProvider>
            <div className="flex min-h-screen">
              <Sidebar />
              <main className="flex-1 ml-64 p-8">
                <TopBar />
                {children}
              </main>
            </div>
            <ChatWidget />
          </ChatProvider>
        </Providers>
      </body>
    </html>
  );
}
