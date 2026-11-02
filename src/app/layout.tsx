import type { Metadata, Viewport } from "next";
import { Amiri, Amiri_Quran, Manrope, Marcellus } from "next/font/google";
import { AuthProvider } from "@/lib/auth";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
});

// Inscriptional capitals, like carved mosque lettering: page titles and big headings only
const marcellus = Marcellus({
  subsets: ["latin", "latin-ext"],
  weight: "400",
  variable: "--font-display",
});

const amiri = Amiri({
  subsets: ["arabic"],
  weight: ["400", "700"],
  variable: "--font-amiri",
});

// Quranic text (Uthmani script with its small marks), close to the naskh of the reader's mushaf
const amiriQuran = Amiri_Quran({
  subsets: ["arabic"],
  weight: "400",
  variable: "--font-quran",
});

export const viewport: Viewport = {
  themeColor: "#F1F2EC",
  width: "device-width",
  initialScale: 1,
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
        className={`${manrope.variable} ${marcellus.variable} ${amiri.variable} ${amiriQuran.variable} font-sans antialiased text-ink bg-cream h-full flex flex-col`}
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
