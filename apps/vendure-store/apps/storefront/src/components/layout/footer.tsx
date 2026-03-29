import {getTopCollections} from '@/lib/vendure/cached';
import Link from "next/link";
import {getStoreName} from "@/lib/vendure/api";


async function Copyright() {
    const storeName = (await getStoreName()) || 'Store';
    return (
        <div>
            © {new Date().getFullYear()} {storeName}. All rights reserved.
        </div>
    )
}

export async function Footer() {
    let collections: Awaited<ReturnType<typeof getTopCollections>> = [];
    try {
        collections = await getTopCollections();
    } catch {
        // API unreachable at build time or runtime — render without categories
    }
    const storeName = (await getStoreName()) || 'Store';

    return (
        <footer className="border-t border-border mt-auto">
            <div className="container mx-auto px-4 py-12">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                    <div>
                        <p className="text-sm font-semibold mb-4 uppercase tracking-wider">
                            {storeName}
                        </p>
                    </div>

                    <div>
                        <p className="text-sm font-semibold mb-4">Categories</p>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            {collections.map((collection) => (
                                <li key={collection.id}>
                                    <Link
                                        href={`/collection/${collection.slug}`}
                                        className="hover:text-foreground transition-colors"
                                    >
                                        {collection.name}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div>
                        <h4 className="text-sm font-semibold mb-4">MoolaBiz</h4>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            <li>
                                <a
                                    href="https://moolabiz.shop"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:text-foreground transition-colors"
                                >
                                    About MoolaBiz
                                </a>
                            </li>
                            <li>
                                <a
                                    href="https://moolabiz.shop/terms"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:text-foreground transition-colors"
                                >
                                    Terms of Service
                                </a>
                            </li>
                            <li>
                                <a
                                    href="https://moolabiz.shop/privacy"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:text-foreground transition-colors"
                                >
                                    Privacy Policy
                                </a>
                            </li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="text-sm font-semibold mb-4">Need Help?</h4>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            <li>
                                <a
                                    href="https://moolabiz.shop/support"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:text-foreground transition-colors"
                                >
                                    Support Centre
                                </a>
                            </li>
                            <li>
                                <a
                                    href="mailto:support@moolabiz.shop"
                                    className="hover:text-foreground transition-colors"
                                >
                                    support@moolabiz.shop
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Bottom Section */}
                <div
                    className="mt-12 pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
                    <Copyright/>
                    <div className="flex items-center gap-2">
                        <span>Powered by</span>
                        <a
                            href="https://moolabiz.shop"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-foreground transition-colors font-semibold"
                        >
                            MoolaBiz
                        </a>
                    </div>
                </div>
            </div>
        </footer>
    );
}
