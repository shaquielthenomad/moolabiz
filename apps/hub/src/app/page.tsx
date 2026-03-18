"use client";

import { useState, type FormEvent } from "react";
import type { SignupFormData, ProvisionResponse } from "@/lib/types";

type Stage = "form" | "loading" | "success" | "error";

export default function Home() {
  const [stage, setStage] = useState<Stage>("form");
  const [error, setError] = useState("");
  const [result, setResult] = useState<ProvisionResponse | null>(null);

  const [formData, setFormData] = useState<SignupFormData>({
    businessName: "",
    whatsappNumber: "+27",
    paymentProvider: "yoco",
  });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStage("loading");
    setError("");

    try {
      const res = await fetch("/api/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data: ProvisionResponse = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Something went wrong. Please try again.");
        setStage("error");
        return;
      }

      setResult(data);
      setStage("success");
    } catch {
      setError("Could not connect. Check your internet and try again.");
      setStage("error");
    }
  }

  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="bg-gradient-to-br from-amber-500 via-amber-400 to-yellow-300 px-4 pt-12 pb-8 text-center">
        <p className="text-amber-900 font-semibold text-sm tracking-wide uppercase mb-2">
          MoolaBiz
        </p>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-white leading-tight max-w-2xl mx-auto drop-shadow-sm">
          Your 24/7 WhatsApp Shop&nbsp;Bot&nbsp;&mdash; Free&nbsp;Forever
        </h1>
        <p className="mt-4 text-amber-950/80 text-lg max-w-md mx-auto">
          Let AI sell for you on WhatsApp while you focus on your business.
        </p>
        <a
          href="#signup"
          className="mt-6 inline-block bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-lg px-8 py-4 rounded-xl shadow-lg transition-colors"
        >
          Get My Free Shop Bot &rarr;
        </a>
      </section>

      {/* Value Props */}
      <section className="max-w-3xl mx-auto px-4 py-10 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 text-center">
        {[
          { icon: "\u{1F64C}", title: "Zero Tech Needed", sub: "If you can WhatsApp, you can do this" },
          { icon: "\u{1F6D2}", title: "Free Shop Helper", sub: "Answers customers, takes orders, 24/7" },
          { icon: "\u26A1", title: "Live in 8 Min", sub: "Sign up now, selling by lunch" },
          { icon: "\u{1F5E3}\uFE0F", title: "Your Language", sub: "English, Zulu, Xhosa, Sotho, Afrikaans & more" },
        ].map((v) => (
          <div key={v.title}>
            <div className="text-4xl mb-2">{v.icon}</div>
            <h3 className="font-bold text-base text-gray-900">{v.title}</h3>
            <p className="text-sm text-gray-600 mt-1">{v.sub}</p>
          </div>
        ))}
      </section>

      {/* Signup Section */}
      <section
        id="signup"
        className="max-w-md mx-auto px-4 pb-16 scroll-mt-8"
      >
        {stage === "loading" && <LoadingState />}
        {stage === "success" && result && <SuccessState result={result} />}
        {(stage === "form" || stage === "error") && (
          <SignupForm
            formData={formData}
            setFormData={setFormData}
            onSubmit={handleSubmit}
            error={stage === "error" ? error : ""}
          />
        )}
      </section>

      {/* Footer */}
      <footer className="text-center text-xs text-gray-400 pb-8">
        &copy; {new Date().getFullYear()} MoolaBiz &mdash; Built in South
        Africa
      </footer>
    </main>
  );
}

/* ---------- Sub-components ---------- */

function SignupForm({
  formData,
  setFormData,
  onSubmit,
  error,
}: {
  formData: SignupFormData;
  setFormData: (d: SignupFormData) => void;
  onSubmit: (e: FormEvent) => void;
  error: string;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 space-y-5"
    >
      <h2 className="text-2xl font-bold text-gray-900 text-center">
        Start selling on WhatsApp today
      </h2>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Business Name */}
      <label className="block">
        <span className="text-sm font-medium text-gray-700">
          What&apos;s your business called?
        </span>
        <input
          type="text"
          required
          minLength={2}
          maxLength={60}
          placeholder="e.g. Mama Thandi's Kitchen"
          value={formData.businessName}
          onChange={(e) =>
            setFormData({ ...formData, businessName: e.target.value })
          }
          className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none text-base"
        />
      </label>

      {/* WhatsApp Number */}
      <label className="block">
        <span className="text-sm font-medium text-gray-700">
          Your WhatsApp number (the one customers message you on)
        </span>
        <input
          type="tel"
          required
          placeholder="+27821234567"
          value={formData.whatsappNumber}
          onChange={(e) => {
            let val = e.target.value;
            if (!val.startsWith("+27")) val = "+27";
            setFormData({ ...formData, whatsappNumber: val });
          }}
          className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none text-base"
        />
        <p className="text-xs text-gray-400 mt-1">
          We&apos;ll never share your number
        </p>
      </label>

      {/* Payment Provider */}
      <label className="block">
        <span className="text-sm font-medium text-gray-700">
          How do you accept payments?
        </span>
        <select
          required
          value={formData.paymentProvider}
          onChange={(e) =>
            setFormData({
              ...formData,
              paymentProvider: e.target.value as SignupFormData["paymentProvider"],
            })
          }
          className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none text-base"
        >
          <option value="yoco">Yoco</option>
          <option value="ozow">Ozow</option>
          <option value="payfast">PayFast</option>
        </select>
      </label>

      <button
        type="submit"
        className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-lg py-4 rounded-xl shadow-md transition-colors"
      >
        Get My Free Shop Bot &rarr;
      </button>

      <p className="text-xs text-gray-400 text-center">
        Free. No catches. Always.
      </p>
    </form>
  );
}

function LoadingState() {
  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 text-center space-y-4">
      <div className="mx-auto w-12 h-12 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
      <h2 className="text-xl font-bold text-gray-900">
        Setting up your bot&hellip;
      </h2>
      <p className="text-gray-500 text-sm">
        This takes about 30 seconds. Hang tight!
      </p>
    </div>
  );
}

function SuccessState({ result }: { result: ProvisionResponse }) {
  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 text-center space-y-6">
      <div className="text-5xl">{"\u{1F389}"}</div>
      <h2 className="text-2xl font-bold text-gray-900">
        Your shop bot is live!
      </h2>
      <p className="text-gray-600">
        Your bot is deploying at:
      </p>
      <a
        href={`https://${result.subdomain}`}
        target="_blank"
        rel="noopener noreferrer"
        className="block bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-amber-800 font-mono text-sm break-all"
      >
        https://{result.subdomain}
      </a>

      <div className="text-left space-y-4 bg-emerald-50 rounded-xl p-5 border border-emerald-200">
        <h3 className="font-bold text-emerald-900 text-lg">
          WhatsApp Setup &mdash; 3 quick steps
        </h3>
        <ol className="list-decimal list-inside space-y-3 text-sm text-emerald-800">
          <li>
            Download <strong>WhatsApp Business</strong> from Play Store if you haven&apos;t already
          </li>
          <li>
            We&apos;ll send you a WhatsApp message with setup instructions
          </li>
          <li>
            Reply to confirm and your bot goes live!
          </li>
        </ol>
        <p className="text-xs text-emerald-600 mt-2">
          Need help? Email us at support@moolabiz.shop
        </p>
      </div>

      <a
        href={`https://wa.me/?text=Hi!%20I%20just%20set%20up%20my%20MoolaBiz%20shop%20bot%20at%20https://${result.subdomain}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-3 rounded-xl transition-colors"
      >
        Share on WhatsApp
      </a>
    </div>
  );
}
