import {NextConfig} from 'next';

const nextConfig: NextConfig = {
    output: 'standalone',
    cacheComponents: true,
    images: {
        // This is necessary to display images from your local Vendure instance
        dangerouslyAllowLocalIP: true,
        remotePatterns: [
            {
                hostname: 'readonlydemo.vendure.io',
            },
            {
                hostname: 'demo.vendure.io'
            },
            {
                hostname: 'localhost'
            },
            {
                // Vendure asset server in production
                hostname: '*.moolabiz.shop',
            }
        ],
    },
    // Allow any subdomain to serve this app — the middleware resolves
    // the merchant from the hostname and sets the correct channel token.
    allowedDevOrigins: ['*.localhost'],
    experimental: {
        rootParams: true
    }
};

export default nextConfig;