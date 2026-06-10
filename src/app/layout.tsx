import type { Metadata, Viewport } from "next";
import { Amiri, Inter } from "next/font/google";
import { AuthProvider } from "@/lib/auth";
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

export const viewport: Viewport = {
  themeColor: "#1a5c38",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "Quran Xətm İzləyicisi",
  description: "Quran oxuma tamamlanmasını izləmək üçün özəl Quran Xətm tətbiqi",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Xətm",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="az" className="h-full">
      <body
        className={`${inter.variable} ${amiri.variable} font-sans antialiased text-[#fdf6e3] h-full flex flex-col`}
      >
        <AuthProvider>
          <div className="flex-1 flex flex-col">
            {children}
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
