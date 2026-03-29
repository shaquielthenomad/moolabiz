import { Resend } from "resend";

function getResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY not set");
  return new Resend(key);
}

/** Escape user-provided strings before interpolating into HTML. */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendWelcomeEmail(opts: {
  to: string;
  businessName: string;
  slug: string;
  plan: string;
}) {
  const safeSlug = escapeHtml(opts.slug);
  const safeName = escapeHtml(opts.businessName);
  const safePlan = escapeHtml(opts.plan);
  const storeUrl = `https://${safeSlug}.store.moolabiz.shop`;
  const onboardUrl = `https://${safeSlug}.bot.moolabiz.shop/onboard`;
  const dashboardUrl = `https://moolabiz.shop/dashboard`;

  try {
    const resend = getResend();
    await resend.emails.send({
      from: "MoolaBiz <no-reply@mail.moolabiz.shop>",
      to: opts.to,
      subject: `Welcome to MoolaBiz — ${opts.businessName} is live!`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
          <h1 style="font-size: 24px; color: #0f172a; margin-bottom: 8px;">Welcome to MoolaBiz</h1>
          <p style="color: #64748b; font-size: 15px; line-height: 1.6;">
            Your store <strong>${safeName}</strong> is being set up. Here's everything you need to get started.
          </p>

          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 24px 0;">
            <p style="font-size: 13px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 8px;">Your store URL</p>
            <a href="${storeUrl}" style="font-size: 15px; color: #059669; font-weight: 600; word-break: break-all;">${storeUrl}</a>
          </div>

          <h2 style="font-size: 18px; color: #0f172a; margin: 32px 0 16px;">Next steps</h2>

          <div style="margin-bottom: 16px;">
            <p style="margin: 0; font-size: 15px;"><strong style="color: #0f172a;">1. Connect your WhatsApp</strong></p>
            <p style="margin: 4px 0 0; color: #64748b; font-size: 14px;">
              Open <a href="${onboardUrl}" style="color: #059669;">${onboardUrl}</a> and scan the QR code with your WhatsApp. Any WhatsApp number works — personal or business.
            </p>
          </div>

          <div style="margin-bottom: 16px;">
            <p style="margin: 0; font-size: 15px;"><strong style="color: #0f172a;">2. Add your products</strong></p>
            <p style="margin: 4px 0 0; color: #64748b; font-size: 14px;">
              Once connected, message your bot with <code style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">/add-product Chicken Braai R45</code> to add products.
            </p>
          </div>

          <div style="margin-bottom: 16px;">
            <p style="margin: 0; font-size: 15px;"><strong style="color: #0f172a;">3. Share your store</strong></p>
            <p style="margin: 4px 0 0; color: #64748b; font-size: 14px;">
              Send your store link to customers on WhatsApp. They can browse, add to cart, and order.
            </p>
          </div>

          <a href="${dashboardUrl}" style="display: inline-block; background: #059669; color: white; font-weight: 600; font-size: 15px; padding: 12px 24px; border-radius: 10px; text-decoration: none; margin: 24px 0;">
            Go to your dashboard
          </a>

          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0;" />

          <p style="color: #94a3b8; font-size: 13px; line-height: 1.5;">
            Plan: ${safePlan}<br>
            Need help? Reply to this email or contact support@moolabiz.shop<br><br>
            MoolaBiz — Made in South Africa
          </p>
        </div>
      `,
    });
    console.log(`[email] Welcome email sent to ${opts.to}`);
  } catch (err) {
    console.error(`[email] Failed to send welcome email:`, err);
  }
}

export async function sendOrderNotificationEmail(opts: {
  to: string;
  orderCode: string;
  customerName?: string;
  total?: number; // in cents
  itemCount?: number;
  shippingAddress?: string;
}) {
  const safeOrderCode = escapeHtml(opts.orderCode);
  const safeCustomerName = escapeHtml(opts.customerName || "Guest");
  const safeShippingAddress = opts.shippingAddress
    ? escapeHtml(opts.shippingAddress).replace(/\n/g, "<br>")
    : null;

  const totalDisplay =
    typeof opts.total === "number"
      ? `R${(opts.total / 100).toFixed(2)}`
      : "Unknown";

  const itemLabel =
    opts.itemCount === 1 ? "1 item" : `${opts.itemCount ?? "?"} items`;

  const dashboardUrl = "https://moolabiz.shop/dashboard/orders";

  try {
    const resend = getResend();
    await resend.emails.send({
      from: "MoolaBiz <no-reply@mail.moolabiz.shop>",
      to: opts.to,
      subject: `New Order #${safeOrderCode} — ${safeCustomerName}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
          <h1 style="font-size: 24px; color: #0f172a; margin-bottom: 4px;">&#128722; New Order!</h1>
          <p style="color: #64748b; font-size: 14px; margin-top: 0;">You have a new order on your MoolaBiz store.</p>

          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 20px; margin: 24px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 6px 0; font-size: 14px; color: #64748b; width: 40%;">Order</td>
                <td style="padding: 6px 0; font-size: 14px; color: #0f172a; font-weight: 600;">#${safeOrderCode}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; font-size: 14px; color: #64748b;">Customer</td>
                <td style="padding: 6px 0; font-size: 14px; color: #0f172a;">${safeCustomerName}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; font-size: 14px; color: #64748b;">Items</td>
                <td style="padding: 6px 0; font-size: 14px; color: #0f172a;">${itemLabel}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; font-size: 14px; color: #64748b;">Total</td>
                <td style="padding: 6px 0; font-size: 15px; color: #059669; font-weight: 700;">${totalDisplay}</td>
              </tr>
              ${
                safeShippingAddress
                  ? `<tr>
                <td style="padding: 6px 0; font-size: 14px; color: #64748b; vertical-align: top;">Delivery</td>
                <td style="padding: 6px 0; font-size: 14px; color: #0f172a; line-height: 1.5;">${safeShippingAddress}</td>
              </tr>`
                  : ""
              }
            </table>
          </div>

          <a href="${dashboardUrl}" style="display: inline-block; background: #059669; color: white; font-weight: 600; font-size: 15px; padding: 12px 28px; border-radius: 10px; text-decoration: none;">
            View Order Details
          </a>

          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0;" />

          <p style="color: #94a3b8; font-size: 13px; line-height: 1.5; margin: 0;">
            MoolaBiz — Made in South Africa
          </p>
        </div>
      `,
    });
    console.log(`[email] Order notification email sent to ${opts.to} for order ${opts.orderCode}`);
  } catch (err) {
    console.error(`[email] Failed to send order notification email:`, err);
  }
}
