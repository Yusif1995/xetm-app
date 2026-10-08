import type { Metadata, Viewport } from "next";
import { Amiri, Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import { AuthProvider } from "@/lib/auth";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-jakarta",
});

const fraunces = Fraunces({
  subsets: ["latin", "latin-ext"],
  weight: ["600", "700"],
  variable: "--font-fraunces",
});

const amiri = Amiri({
  subsets: ["arabic"],
  weight: ["400", "700"],
  variable: "--font-amiri",
});

export const viewport: Viewport = {
  themeColor: "#0E3B2B",
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
        className={`${jakarta.variable} ${fraunces.variable} ${amiri.variable} font-sans antialiased text-ink bg-cream h-full flex flex-col`}
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
