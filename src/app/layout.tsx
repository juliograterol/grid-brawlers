import type { Metadata, Viewport } from "next";
import { Montserrat, Press_Start_2P } from "next/font/google";
import "./globals.css";

const body = Montserrat({ subsets: ["latin"], weight: ["400", "600", "700"], variable: "--font-body" });
const pixel = Press_Start_2P({ subsets: ["latin"], weight: "400", variable: "--font-pixel" });

export const metadata: Metadata = {
  title: "Grid Brawlers",
  description: "A sword-fighting platformer. Local multiplayer or vs. the CPU.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#000000",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${body.variable} ${pixel.variable}`}>{children}</body>
    </html>
  );
}
