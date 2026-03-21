import type {Metadata, Viewport} from "next";
import {Geist, Geist_Mono} from "next/font/google";
import "./globals.css";
import {Toaster} from "@/components/ui/sonner";
import {Navbar} from "@/components/layout/navbar";
import {Footer} from "@/components/layout/footer";
import {ThemeProvider} from "@/components/providers/theme-provider";
import {SITE_NAME, SITE_URL} from "@/lib/metadata";
import {getStoreName} from "@/lib/vendure/api";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

/**
 * Generate metadata dynamically based on the resolved merchant.
 * When accessed via a merchant subdomain the store name comes from the
 * middleware; otherwise falls back to the static SITE_NAME.
 */
export async function generateMetadata(): Promise<Metadata> {
    const storeName = (await getStoreName()) || SITE_NAME;

    return {
        metadataBase: new URL(SITE_URL),
        title: {
            default: storeName,
            template: `%s | ${storeName}`,
        },
        description:
            `Shop the best products at ${storeName}. Quality products, competitive prices, and fast delivery.`,
        openGraph: {
            type: "website",
            siteName: storeName,
            locale: "en_ZA",
        },
        twitter: {
            card: "summary_large_image",
        },
        robots: {
            index: true,
            follow: true,
            googleBot: {
                index: true,
                follow: true,
                "max-video-preview": -1,
                "max-image-preview": "large",
                "max-snippet": -1,
            },
        },
    };
}

export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,
    themeColor: [
        {media: "(prefers-color-scheme: light)", color: "#ffffff"},
        {media: "(prefers-color-scheme: dark)", color: "#000000"},
    ],
};

export default function RootLayout({children}: LayoutProps<'/'>) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body
                className={`${geistSans.variable} ${geistMono.variable} antialiased flex flex-col min-h-screen`}
            >
                <ThemeProvider>
                    <Navbar />
                    {children}
                    <Footer />
                    <Toaster />
                </ThemeProvider>
            </body>
        </html>
    );
}
