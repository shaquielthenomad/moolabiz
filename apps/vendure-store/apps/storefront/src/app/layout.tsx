import type {Metadata, Viewport} from "next";
import {Suspense} from "react";
import {Bricolage_Grotesque, Inter_Tight, Geist_Mono} from "next/font/google";
import "./globals.css";
import {Toaster} from "@/components/ui/sonner";
import {Navbar} from "@/components/layout/navbar";
import {Footer} from "@/components/layout/footer";
import {ThemeProvider} from "@/components/providers/theme-provider";
import {SITE_NAME, SITE_URL} from "@/lib/metadata";
import {getStoreName} from "@/lib/vendure/api";


// Body text: Inter Tight — kept on the --font-geist-sans var the theme reads,
// so the swap is a drop-in. Display: Bricolage Grotesque for headings.
const fontText = Inter_Tight({
    variable: "--font-geist-sans",
    subsets: ["latin"],
    weight: ["400", "500", "600"],
    display: "swap",
});

const fontDisplay = Bricolage_Grotesque({
    variable: "--font-display",
    subsets: ["latin"],
    weight: ["600", "700", "800"],
    display: "swap",
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
        {media: "(prefers-color-scheme: light)", color: "#faf7f2"},
        {media: "(prefers-color-scheme: dark)", color: "#000000"},
    ],
};

export default function RootLayout({children}: LayoutProps<'/'>) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body
                className={`${fontText.variable} ${fontDisplay.variable} ${geistMono.variable} antialiased flex flex-col min-h-screen`}
            >
                <Suspense>
                    <ThemeProvider>
                        <Navbar />
                        {children}
                        <Footer />
                        <Toaster />
                    </ThemeProvider>
                </Suspense>
            </body>
        </html>
    );
}
