import type { Metadata } from "next";
import { Amiri, Inter } from "next/font/google";
import { AuthProvider } from "@/lib/auth";
import AiChatWidget from "@/components/AiChatWidget";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const amiri = Amiri({
  subsets: ["arabic"],
  weight: ["400", "700"],
  variable: "--font-amiri",
});

export const metadata: Metadata = {
  title: "Quran Xətm İzləyicisi",
  description: "Quran oxuma tamamlanmasını izləmək üçün özəl Quran Xətm tətbiqi",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="az" className="h-full">
      <body
        className={`${inter.variable} ${amiri.variable} font-sans antialiased bg-[#1a1a2e] text-[#fdf6e3] h-full flex flex-col`}
      >
        <AuthProvider>
          <div className="flex-1 flex flex-col">
            {children}
          </div>
          <AiChatWidget />
        </AuthProvider>
      </body>
    </html>
  );
}
