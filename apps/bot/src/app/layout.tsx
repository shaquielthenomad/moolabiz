import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const businessName = process.env.BUSINESS_NAME || "MoolaBiz Shop";

export const metadata: Metadata = {
  title: `${businessName}`,
  description: `Shop online at ${businessName}. Browse products and place your order.`,
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
      </head>
      <body className={`${geistSans.variable} antialiased bg-background text-foreground`}>
        {children}
      </body>
    </html>
  );
}
