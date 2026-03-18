import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const businessName = process.env.BUSINESS_NAME || "Shop";
const slug = process.env.BUSINESS_SLUG || "";

export const metadata: Metadata = {
  title: `${businessName} — Shop Online`,
  description: `Browse and order from ${businessName}. Fast, easy, powered by MoolaBiz.`,
  openGraph: {
    title: `${businessName} — Shop Online`,
    description: `Browse products and place your order from ${businessName}.`,
    type: "website",
    url: slug ? `https://${slug}.bot.moolabiz.shop` : undefined,
    siteName: businessName,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="whatsapp" content={process.env.WHATSAPP_NUMBER || ""} />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='%230f172a'/><text x='16' y='22' text-anchor='middle' font-family='system-ui' font-weight='800' font-size='18' fill='%23f59e0b'>M</text></svg>" />
      </head>
      <body className={`${geistSans.variable} antialiased bg-white text-slate-900`}>
        {children}
      </body>
    </html>
  );
}
