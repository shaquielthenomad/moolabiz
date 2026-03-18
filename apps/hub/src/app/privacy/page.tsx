export default function PrivacyPage() {
  return (
    <main className="max-w-2xl mx-auto px-4 py-16">
      <h1 className="text-3xl font-bold text-slate-900 mb-6">Privacy Policy</h1>
      <div className="prose prose-slate text-sm space-y-4 text-slate-600">
        <p><strong>Last updated:</strong> March 2026</p>
        <p>MoolaBiz ("we", "us") respects your privacy. This policy explains how we collect, use, and protect your personal information in compliance with the Protection of Personal Information Act (POPIA).</p>
        <h2 className="text-lg font-semibold text-slate-900 mt-6">What we collect</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Business name and contact details (name, email, WhatsApp number)</li>
          <li>Payment information (processed by Stripe — we do not store card details)</li>
          <li>Products and orders data for your store</li>
        </ul>
        <h2 className="text-lg font-semibold text-slate-900 mt-6">How we use it</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>To provide and maintain your WhatsApp store service</li>
          <li>To process your subscription payments</li>
          <li>To communicate service updates</li>
        </ul>
        <h2 className="text-lg font-semibold text-slate-900 mt-6">Data storage</h2>
        <p>Your data is stored on servers in South Africa (Microsoft Azure, South Africa North region). We do not transfer your data outside South Africa.</p>
        <h2 className="text-lg font-semibold text-slate-900 mt-6">Your rights</h2>
        <p>Under POPIA, you have the right to access, correct, or delete your personal information. Contact us at support@moolabiz.shop.</p>
        <h2 className="text-lg font-semibold text-slate-900 mt-6">Contact</h2>
        <p>Information Officer: Shaquiel Sewell — support@moolabiz.shop</p>
      </div>
    </main>
  );
}
