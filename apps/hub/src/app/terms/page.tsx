export default function TermsPage() {
  return (
    <main className="max-w-2xl mx-auto px-4 py-16">
      <h1 className="text-3xl font-bold text-slate-900 mb-6">Terms of Service</h1>
      <div className="prose prose-slate text-sm space-y-4 text-slate-600">
        <p><strong>Last updated:</strong> March 2026</p>
        <p>By using MoolaBiz, you agree to these terms.</p>
        <h2 className="text-lg font-semibold text-slate-900 mt-6">Service</h2>
        <p>MoolaBiz provides a WhatsApp store platform. We host your online store and WhatsApp bot. You are responsible for your products, pricing, and customer service.</p>
        <h2 className="text-lg font-semibold text-slate-900 mt-6">Payments</h2>
        <p>Your MoolaBiz subscription is billed monthly via Stripe. Customer payments for your products go directly to your own payment provider (Yoco, Ozow, or PayFast). MoolaBiz does not hold, process, or have access to your customer payments.</p>
        <h2 className="text-lg font-semibold text-slate-900 mt-6">Cancellation</h2>
        <p>You may cancel your subscription at any time from your dashboard. Your store will remain active until the end of your billing period. After cancellation, your store will be suspended.</p>
        <h2 className="text-lg font-semibold text-slate-900 mt-6">Acceptable use</h2>
        <p>You may not use MoolaBiz to sell illegal products, conduct fraud, or violate WhatsApp&apos;s terms of service.</p>
        <h2 className="text-lg font-semibold text-slate-900 mt-6">Liability</h2>
        <p>MoolaBiz is provided as-is. We are not liable for lost sales, downtime, or any indirect damages. Our maximum liability is limited to the fees you have paid in the last 3 months.</p>
        <h2 className="text-lg font-semibold text-slate-900 mt-6">Contact</h2>
        <p>Questions? Email support@moolabiz.shop</p>
      </div>
    </main>
  );
}
