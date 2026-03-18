import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const businessName = process.env.BUSINESS_NAME || "MoolaBiz Shop";

export const metadata: Metadata = {
  title: `${businessName} — Shop`,
  description: `Browse and order from ${businessName}. Fast delivery, great prices.`,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} antialiased bg-background text-foreground`}>
        {children}
      </body>
    </html>
  );
}
