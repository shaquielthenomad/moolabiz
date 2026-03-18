"use client";

import { useState, type FormEvent } from "react";
import type { SignupFormData, CheckoutResponse, PlanType } from "@/lib/types";

type Stage = "form" | "plans" | "processing" | "error";

const PLANS = [
  {
    id: "starter" as PlanType,
    name: "Starter",
    priceDisplay: "R99",
    period: "/month",
    features: [
      "WhatsApp shop bot",
      "Order taking & cart",
      "1 payment provider",
      "English + 1 language",
      "Email support",
    ],
  },
  {
    id: "pro" as PlanType,
    name: "Pro",
    priceDisplay: "R249",
    period: "/month",
    popular: true,
    features: [
      "Everything in Starter",
      "All 5 languages",
      "All payment providers",
      "Appointment booking",
      "Daily revenue reports",
      "Priority support",
    ],
  },
  {
    id: "business" as PlanType,
    name: "Business",
    priceDisplay: "R499",
    period: "/month",
    features: [
      "Everything in Pro",
      "AI business advisor",
      "Admin dashboard",
      "Custom bot personality",
      "Dedicated support",
      "Multiple numbers",
    ],
  },
];

export default function Home() {
  const [stage, setStage] = useState<Stage>("form");
  const [error, setError] = useState("");
  const [formData, setFormData] = useState<SignupFormData>({
    businessName: "",
    whatsappNumber: "+27",
    paymentProvider: "yoco",
  });

  async function handleSelectPlan(planId: PlanType) {
    setStage("processing");
    setError("");

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, plan: planId }),
      });

      const data: CheckoutResponse = await res.json();

      if (!res.ok || !data.success || !data.checkoutUrl) {
        setError(data.error || "Could not start checkout. Please try again.");
        setStage("plans");
        return;
      }

      // Redirect to Yoco checkout
      window.location.href = data.checkoutUrl;
    } catch {
      setError("Could not connect. Check your internet and try again.");
      setStage("plans");
    }
  }

  function handleFormSubmit(e: FormEvent) {
    e.preventDefault();
    setStage("plans");
  }

  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="bg-gradient-to-br from-amber-500 via-amber-400 to-yellow-300 px-4 pt-12 pb-8 text-center">
        <p className="text-amber-900 font-semibold text-sm tracking-wide uppercase mb-2">
          MoolaBiz
        </p>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-white leading-tight max-w-2xl mx-auto drop-shadow-sm">
          Your 24/7 WhatsApp Shop&nbsp;Bot
        </h1>
        <p className="mt-4 text-amber-950/80 text-lg max-w-md mx-auto">
          Let AI sell for you on WhatsApp while you focus on your business.
        </p>
        <a
          href="#signup"
          className="mt-6 inline-block bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-lg px-8 py-4 rounded-xl shadow-lg transition-colors"
        >
          Get My Shop Bot &rarr;
        </a>
      </section>

      {/* Value Props */}
      <section className="max-w-3xl mx-auto px-4 py-10 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 text-center">
        {[
          { icon: "\u{1F64C}", title: "Zero Tech Needed", sub: "If you can WhatsApp, you can do this" },
          { icon: "\u{1F6D2}", title: "Shop Helper", sub: "Answers customers, takes orders, 24/7" },
          { icon: "\u26A1", title: "Live in 8 Min", sub: "Sign up now, selling by lunch" },
          { icon: "\u{1F5E3}\uFE0F", title: "Your Language", sub: "English, Zulu, Xhosa, Sotho, Afrikaans & more" },
        ].map((v) => (
          <div key={v.title}>
            <div className="text-4xl mb-2" aria-hidden="true">{v.icon}</div>
            <h3 className="font-bold text-base text-gray-900">{v.title}</h3>
            <p className="text-sm text-gray-600 mt-1">{v.sub}</p>
          </div>
        ))}
      </section>

      {/* Signup / Plans Section */}
      <section id="signup" className="max-w-4xl mx-auto px-4 pb-16 scroll-mt-8">
        {stage === "form" && (
          <SignupForm
            formData={formData}
            setFormData={setFormData}
            onSubmit={handleFormSubmit}
          />
        )}
        {(stage === "plans" || stage === "processing") && (
          <PlanPicker
            error={error}
            loading={stage === "processing"}
            onSelect={handleSelectPlan}
            onBack={() => { setStage("form"); setError(""); }}
          />
        )}
        {stage === "error" && (
          <div role="alert" className="max-w-md mx-auto bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm text-center">
            {error}
            <button
              onClick={() => setStage("form")}
              className="block mx-auto mt-3 text-red-600 underline text-sm"
            >
              Try again
            </button>
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="text-center text-xs text-gray-400 pb-8">
        &copy; {new Date().getFullYear()} MoolaBiz &mdash; Built in South Africa
      </footer>
    </main>
  );
}

/* ---------- Sub-components ---------- */

function SignupForm({
  formData,
  setFormData,
  onSubmit,
}: {
  formData: SignupFormData;
  setFormData: (d: SignupFormData) => void;
  onSubmit: (e: FormEvent) => void;
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="max-w-md mx-auto bg-white rounded-2xl shadow-xl border border-gray-100 p-6 space-y-5"
    >
      <h2 className="text-2xl font-bold text-gray-900 text-center">
        Start selling on WhatsApp today
      </h2>

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
          pattern="\+27\d{9}"
          title="Enter your number like +27821234567"
          placeholder="+27821234567"
          value={formData.whatsappNumber}
          onChange={(e) => {
            let val = e.target.value.replace(/[\s\-()]/g, "");
            if (!val.startsWith("+27")) val = "+27";
            setFormData({ ...formData, whatsappNumber: val });
          }}
          className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none text-base"
        />
        <p className="text-xs text-gray-500 mt-1">
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
        Choose Your Plan &rarr;
      </button>

      <p className="text-xs text-gray-500 text-center">
        Cancel anytime &middot; No long-term contracts
      </p>
    </form>
  );
}

function PlanPicker({
  error,
  loading,
  onSelect,
  onBack,
}: {
  error: string;
  loading: boolean;
  onSelect: (plan: PlanType) => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900">
          Choose your plan
        </h2>
        <p className="text-gray-500 mt-1">
          All plans include your own WhatsApp shop bot. Cancel anytime.
        </p>
      </div>

      {error && (
        <div role="alert" className="max-w-md mx-auto bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm text-center">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className={`relative bg-white rounded-2xl border-2 p-6 flex flex-col ${
              plan.popular
                ? "border-emerald-500 shadow-xl"
                : "border-gray-200 shadow-md"
            }`}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                Most Popular
              </div>
            )}
            <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
            <div className="mt-2">
              <span className="text-3xl font-extrabold text-gray-900">{plan.priceDisplay}</span>
              <span className="text-gray-500 text-sm">{plan.period}</span>
            </div>
            <ul className="mt-4 space-y-2 flex-1">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                  <span className="text-emerald-500 mt-0.5">&#10003;</span>
                  {f}
                </li>
              ))}
            </ul>
            <button
              onClick={() => onSelect(plan.id)}
              disabled={loading}
              className={`mt-6 w-full py-3 rounded-xl font-bold transition-colors ${
                plan.popular
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "bg-gray-100 hover:bg-gray-200 text-gray-900"
              } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {loading ? (
                <span role="status" aria-label="Loading">Processing...</span>
              ) : (
                `Get ${plan.name}`
              )}
            </button>
          </div>
        ))}
      </div>

      <div className="text-center">
        <button
          onClick={onBack}
          className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          &larr; Back to form
        </button>
      </div>
    </div>
  );
}
