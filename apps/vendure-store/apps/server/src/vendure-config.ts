import {
    dummyPaymentHandler,
    DefaultJobQueuePlugin,
    DefaultSchedulerPlugin,
    DefaultSearchPlugin,
    VendureConfig,
} from '@vendure/core';
import { StripePlugin } from '@vendure/payments-plugin/package/stripe';
import { defaultEmailHandlers, EmailPlugin, FileBasedTemplateLoader } from '@vendure/email-plugin';
import { AssetServerPlugin } from '@vendure/asset-server-plugin';
import { DashboardPlugin } from '@vendure/dashboard/plugin';
import { GraphiqlPlugin } from '@vendure/graphiql-plugin';
import 'dotenv/config';
import path from 'path';

const IS_DEV = process.env.APP_ENV === 'dev';
const serverPort = +process.env.PORT || 3000;

export const config: VendureConfig = {
    apiOptions: {
        port: serverPort,
        adminApiPath: 'admin-api',
        shopApiPath: 'shop-api',
        trustProxy: IS_DEV ? false : 1,
        cors: {
            origin: IS_DEV
                ? true
                : [/\.moolabiz\.shop$/, 'https://moolabiz.shop'],
        },
        // The following options are useful in development mode,
        // but are best turned off for production for security
        // reasons.
        ...(IS_DEV ? {
            adminApiDebug: true,
            shopApiDebug: true,
        } : {}),
    },
    authOptions: {
        tokenMethod: 'bearer',
        superadminCredentials: {
            identifier: process.env.SUPERADMIN_USERNAME,
            password: process.env.SUPERADMIN_PASSWORD,
        },
        cookieOptions: {
          secret: process.env.COOKIE_SECRET,
        },
    },
    dbConnectionOptions: {
        type: 'postgres',
        synchronize: process.env.DB_SYNCHRONIZE === 'true',
        migrations: [path.join(__dirname, './migrations/*.+(js|ts)')],
        logging: IS_DEV ? true : false,
        host: process.env.DB_HOST || 'localhost',
        port: +(process.env.DB_PORT || 5432),
        database: process.env.DB_NAME || 'vendure',
        username: process.env.DB_USERNAME || 'vendure',
        password: process.env.DB_PASSWORD || '',
    },
    paymentOptions: {
        paymentMethodHandlers: IS_DEV ? [dummyPaymentHandler] : [],
    },
    // When adding or altering custom field definitions, the database will
    // need to be updated. See the "Migrations" section in README.md.
    customFields: {},
    plugins: [
        ...(IS_DEV ? [GraphiqlPlugin.init()] : []),
        StripePlugin.init({
            // Ensures Stripe doesn't allow the same PaymentIntent to be reused across Vendure customers.
            storeCustomersInStripe: true,
        }),
        AssetServerPlugin.init({
            route: 'assets',
            assetUploadDir: path.join(__dirname, '../static/assets'),
            // For local dev, the correct value for assetUrlPrefix should
            // be guessed correctly, but for production it will usually need
            // to be set manually to match your production url.
            assetUrlPrefix: IS_DEV ? undefined : (process.env.ASSET_URL_PREFIX || 'https://store.moolabiz.shop/assets/'),
        }),
        DefaultSchedulerPlugin.init(),
        DefaultJobQueuePlugin.init({ useDatabaseForBuffer: true }),
        DefaultSearchPlugin.init({ bufferUpdates: false, indexStockStatus: true }),
        EmailPlugin.init({
            devMode: true,
            outputPath: path.join(__dirname, '../static/email/test-emails'),
            route: 'mailbox',
            handlers: defaultEmailHandlers,
            templateLoader: new FileBasedTemplateLoader(path.join(__dirname, '../static/email/templates')),
            globalTemplateVars: {
                fromAddress: process.env.EMAIL_FROM_ADDRESS || '"MoolaBiz" <noreply@moolabiz.shop>',
                verifyEmailAddressUrl: process.env.STOREFRONT_URL ? `${process.env.STOREFRONT_URL}/verify` : 'http://localhost:8080/verify',
                passwordResetUrl: process.env.STOREFRONT_URL ? `${process.env.STOREFRONT_URL}/password-reset` : 'http://localhost:8080/password-reset',
                changeEmailAddressUrl: process.env.STOREFRONT_URL ? `${process.env.STOREFRONT_URL}/verify-email-address-change` : 'http://localhost:8080/verify-email-address-change',
            },
        }),
        DashboardPlugin.init({
            route: 'dashboard',
            appDir: IS_DEV
                ? path.join(__dirname, '../dist/dashboard')
                : path.join(__dirname, 'dashboard'),
        }),
    ],
};
