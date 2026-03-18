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
      "Priority WhatsApp support",
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

const TESTIMONIALS = [
  {
    quote:
      "My customers order hair appointments while I'm sleeping. I wake up with a full day booked. Best R99 I ever spent.",
    name: "Mama Thandi",
    business: "Hair Braider",
    location: "Soweto, Johannesburg",
    initial: "T",
    color: "bg-amber-500",
  },
  {
    quote:
      "Before this I was missing orders because I couldn't answer WhatsApp fast enough. Now the bot handles everything. Sales up 40%.",
    name: "Sipho Dlamini",
    business: "Spaza Shop Owner",
    location: "Khayelitsha, Cape Town",
    initial: "S",
    color: "bg-emerald-600",
  },
  {
    quote:
      "I sell food at taxi ranks. The bot takes orders in Zulu and sends customers my location. Simple. My regulars love it.",
    name: "Nomsa Khumalo",
    business: "Street Food Seller",
    location: "Durban",
    initial: "N",
    color: "bg-amber-700",
  },
];

export default function Home() {
  const [stage, setStage] = useState<Stage>("form");
  const [error, setError] = useState("");
  const [formData, setFormData] = useState<SignupFormData>({
    businessName: "",
    whatsappNumber: "+27",
    paymentProvider: "yoco",
    pin: "",
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
      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-amber-600 via-amber-500 to-yellow-400 px-4 pt-14 pb-12 text-center relative overflow-hidden">
        {/* Subtle background texture rings */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-yellow-300/20" />
          <div className="absolute -bottom-12 -left-12 w-56 h-56 rounded-full bg-amber-700/20" />
        </div>

        <a
          href="/login"
          className="absolute top-4 right-4 bg-white/25 hover:bg-white/40 backdrop-blur text-amber-950 font-semibold text-sm px-4 py-2 rounded-lg transition-colors"
        >
          Log in
        </a>

        <p className="relative text-amber-950 font-bold text-sm tracking-widest uppercase mb-3">
          MoolaBiz &mdash; Built in Mzansi 🇿🇦
        </p>

        <h1 className="relative text-4xl sm:text-5xl font-extrabold text-white leading-tight max-w-2xl mx-auto drop-shadow">
          Your shop never sleeps.<br className="hidden sm:block" />
          <span className="text-amber-950/90">Even when you do.</span>
        </h1>

        <p className="relative mt-5 text-amber-950/80 text-lg sm:text-xl max-w-md mx-auto leading-snug">
          Your WhatsApp bot takes orders, books appointments, and answers customers
          &mdash; 24/7, while you rest.
        </p>

        <div className="relative mt-3 mb-1">
          <span className="inline-block bg-amber-950/15 text-amber-950 text-sm font-semibold px-3 py-1 rounded-full">
            No tech skills needed &middot; Live in 8 minutes
          </span>
        </div>

        <a
          href="#signup"
          className="relative mt-6 inline-block bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-extrabold text-lg px-10 py-4 rounded-2xl shadow-xl transition-colors"
        >
          Start Free Trial &rarr;
        </a>

        <p className="relative mt-3 text-amber-950/60 text-sm">
          7-day free trial &middot; Cancel anytime &middot; No contracts
        </p>
      </section>

      {/* ── Value Props ─────────────────────────────────────────────────── */}
      <section className="max-w-3xl mx-auto px-4 py-10 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
        {[
          {
            icon: "🙌",
            title: "Zero Tech Needed",
            sub: "If you can WhatsApp, you can do this",
          },
          {
            icon: "🛒",
            title: "Never Miss an Order",
            sub: "Bot answers, takes orders, sends totals — 24/7",
          },
          {
            icon: "⚡",
            title: "Live in 8 Minutes",
            sub: "Sign up now, selling by lunch",
          },
          {
            icon: "🗣️",
            title: "Your Language",
            sub: "English, Zulu, Xhosa, Sotho, Afrikaans",
          },
        ].map((v) => (
          <div key={v.title} className="py-2">
            <div className="text-4xl mb-2" aria-hidden="true">{v.icon}</div>
            <h3 className="font-bold text-sm sm:text-base text-amber-900">{v.title}</h3>
            <p className="text-xs sm:text-sm text-gray-600 mt-1 leading-snug">{v.sub}</p>
          </div>
        ))}
      </section>

      {/* ── Testimonials ────────────────────────────────────────────────── */}
      <section className="bg-amber-50 border-y border-amber-100 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <p className="text-center text-xs font-bold tracking-widest uppercase text-amber-700 mb-1">
            Real traders, real results
          </p>
          <h2 className="text-center text-2xl sm:text-3xl font-extrabold text-amber-900 mb-8">
            What traders say about MoolaBiz
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {TESTIMONIALS.map((t) => (
              <div
                key={t.name}
                className="bg-white rounded-2xl shadow-sm border border-amber-100 p-5 flex flex-col gap-4"
              >
                {/* Stars */}
                <div className="flex gap-0.5 text-amber-400 text-lg" aria-label="5 stars">
                  {"★★★★★"}
                </div>
                <p className="text-gray-700 text-sm leading-relaxed flex-1">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="flex items-center gap-3 pt-1 border-t border-gray-100">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-extrabold text-base shrink-0 ${t.color}`}
                    aria-hidden="true"
                  >
                    {t.initial}
                  </div>
                  <div>
                    <p className="font-bold text-sm text-gray-900">{t.name}</p>
                    <p className="text-xs text-gray-500">{t.business} &middot; {t.location}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Signup / Plans Section ──────────────────────────────────────── */}
      <section id="signup" className="max-w-4xl mx-auto px-4 py-14 scroll-mt-8">
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
          <div
            role="alert"
            className="max-w-md mx-auto bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-4 text-sm text-center"
          >
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

      {/* ── Trust Signals ───────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-amber-900 to-amber-800 text-white py-12 px-4">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <p className="text-amber-300 text-xs font-bold tracking-widest uppercase">
            Why traders trust us
          </p>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight">
            MoolaBiz is built for you —<br className="hidden sm:block" /> not for big corporates
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
            {[
              { icon: "👥", stat: "100+", label: "Traders across South Africa" },
              { icon: "🇿🇦", stat: "SA Data", label: "Your data stays in South Africa (Azure SA North)" },
              { icon: "🔓", stat: "No Lock-in", label: "Cancel anytime — no contracts, no hidden fees" },
              { icon: "🛠️", stat: "Built in Mzansi", label: "By South Africans who understand your hustle" },
            ].map((item) => (
              <div
                key={item.stat}
                className="bg-white/10 rounded-2xl px-4 py-5 flex flex-col items-center gap-2"
              >
                <span className="text-3xl" aria-hidden="true">{item.icon}</span>
                <p className="font-extrabold text-amber-300 text-lg leading-tight">{item.stat}</p>
                <p className="text-amber-100/80 text-xs leading-snug text-center">{item.label}</p>
              </div>
            ))}
          </div>

          <div className="pt-4">
            <a
              href="#signup"
              className="inline-block bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-white font-extrabold text-lg px-10 py-4 rounded-2xl shadow-xl transition-colors"
            >
              Get My Shop Bot &rarr;
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="text-center text-xs text-gray-400 py-8 border-t border-gray-100 space-y-1">
        <p>&copy; {new Date().getFullYear()} MoolaBiz &mdash; Built with love in Mzansi 🇿🇦</p>
        <p>
          <a href="mailto:support@moolabiz.shop" className="hover:text-gray-600 transition-colors">
            support@moolabiz.shop
          </a>
          &nbsp;&middot;&nbsp;
          <a href="/privacy" className="hover:text-gray-600 transition-colors">Privacy</a>
          &nbsp;&middot;&nbsp;
          <a href="/terms" className="hover:text-gray-600 transition-colors">Terms</a>
        </p>
      </footer>
    </main>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Sub-components
   ────────────────────────────────────────────────────────────────────────── */

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
      className="max-w-md mx-auto bg-white rounded-2xl shadow-xl border border-amber-100 p-6 sm:p-8 space-y-5"
    >
      <div className="text-center">
        <span className="inline-block bg-emerald-100 text-emerald-700 text-xs font-bold px-3 py-1 rounded-full mb-3 tracking-wide uppercase">
          7-day free trial — no card needed
        </span>
        <h2 className="text-2xl font-extrabold text-amber-900">
          Set up your shop bot
        </h2>
        <p className="text-sm text-gray-500 mt-1">Takes about 2 minutes</p>
      </div>

      {/* Business Name */}
      <label className="block">
        <span className="text-sm font-semibold text-gray-700">
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
          className="mt-1.5 block w-full rounded-xl border border-gray-300 px-4 py-3.5 text-gray-900 placeholder:text-gray-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none text-base"
        />
      </label>

      {/* WhatsApp Number */}
      <label className="block">
        <span className="text-sm font-semibold text-gray-700">
          Your WhatsApp number
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
          className="mt-1.5 block w-full rounded-xl border border-gray-300 px-4 py-3.5 text-gray-900 placeholder:text-gray-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none text-base"
        />
        <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
          <span aria-hidden="true">🔒</span> We&apos;ll never share your number
        </p>
      </label>

      {/* Payment Provider */}
      <label className="block">
        <span className="text-sm font-semibold text-gray-700">
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
          className="mt-1.5 block w-full rounded-xl border border-gray-300 px-4 py-3.5 text-gray-900 bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none text-base"
        >
          <option value="yoco">Yoco</option>
          <option value="ozow">Ozow</option>
          <option value="payfast">PayFast</option>
        </select>
      </label>

      {/* PIN */}
      <label className="block">
        <span className="text-sm font-semibold text-gray-700">
          Create a 4-digit PIN to manage your shop
        </span>
        <input
          type="password"
          required
          maxLength={4}
          pattern="[0-9]{4}"
          inputMode="numeric"
          title="Enter a 4-digit PIN"
          placeholder="••••"
          value={formData.pin}
          onChange={(e) => {
            const val = e.target.value.replace(/\D/g, "").slice(0, 4);
            setFormData({ ...formData, pin: val });
          }}
          className="mt-1.5 block w-full rounded-xl border border-gray-300 px-4 py-3.5 text-gray-900 placeholder:text-gray-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none text-base tracking-[0.5em] text-center text-2xl"
        />
        <p className="text-xs text-gray-400 mt-1.5">
          You&apos;ll use this to log in and manage your shop
        </p>
      </label>

      <button
        type="submit"
        className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-extrabold text-lg py-4 rounded-2xl shadow-lg transition-colors"
      >
        Choose Your Plan &rarr;
      </button>

      <p className="text-xs text-gray-400 text-center">
        7-day free trial &middot; Cancel anytime &middot; No contracts
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
        <span className="inline-block bg-emerald-100 text-emerald-700 text-xs font-bold px-3 py-1 rounded-full mb-3 tracking-wide uppercase">
          7-day free trial on every plan
        </span>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-amber-900">
          Choose your plan
        </h2>
        <p className="text-gray-500 mt-1 text-sm">
          All plans include your own WhatsApp shop bot. Cancel anytime, no contracts.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="max-w-md mx-auto bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-3 text-sm text-center"
        >
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className={`relative flex flex-col rounded-2xl border-2 p-6 transition-shadow ${
              plan.popular
                ? "bg-amber-900 border-amber-700 shadow-2xl text-white ring-4 ring-amber-400/30 md:-mt-3 md:-mb-3"
                : "bg-white border-gray-200 shadow-md"
            }`}
          >
            {/* Trial badge — all plans */}
            <div
              className={`absolute -top-3 left-4 text-xs font-bold px-3 py-1 rounded-full shadow ${
                plan.popular
                  ? "bg-amber-400 text-amber-950"
                  : "bg-emerald-100 text-emerald-700 border border-emerald-200"
              }`}
            >
              7-day free trial
            </div>

            {/* Popular crown badge */}
            {plan.popular && (
              <div className="absolute -top-3 right-4 bg-amber-400 text-amber-950 text-xs font-extrabold px-3 py-1 rounded-full shadow">
                ★ Most Value
              </div>
            )}

            {/* Plan name */}
            <h3
              className={`text-lg font-extrabold mt-3 ${
                plan.popular ? "text-amber-300" : "text-amber-900"
              }`}
            >
              {plan.name}
            </h3>

            {/* Price */}
            <div className="mt-2 flex items-end gap-1">
              <span
                className={`text-4xl font-extrabold leading-none ${
                  plan.popular ? "text-white" : "text-amber-900"
                }`}
              >
                {plan.priceDisplay}
              </span>
              <div className="flex flex-col text-left pb-0.5">
                <span
                  className={`text-xs font-semibold leading-none ${
                    plan.popular ? "text-amber-300" : "text-gray-500"
                  }`}
                >
                  per
                </span>
                <span
                  className={`text-xs font-semibold leading-none ${
                    plan.popular ? "text-amber-300" : "text-gray-500"
                  }`}
                >
                  month
                </span>
              </div>
            </div>

            {/* Divider */}
            <div
              className={`my-4 border-t ${
                plan.popular ? "border-amber-700" : "border-gray-100"
              }`}
            />

            {/* Features */}
            <ul className="space-y-2.5 flex-1">
              {plan.features.map((f) => (
                <li
                  key={f}
                  className={`flex items-start gap-2 text-sm ${
                    plan.popular ? "text-amber-100" : "text-gray-600"
                  }`}
                >
                  <span
                    className={`mt-0.5 shrink-0 font-bold ${
                      plan.popular ? "text-amber-400" : "text-emerald-500"
                    }`}
                    aria-hidden="true"
                  >
                    ✓
                  </span>
                  {f}
                </li>
              ))}
            </ul>

            {/* CTA */}
            <button
              onClick={() => onSelect(plan.id)}
              disabled={loading}
              className={`mt-6 w-full py-4 rounded-2xl font-extrabold text-base transition-colors shadow-md ${
                plan.popular
                  ? "bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-amber-950"
                  : "bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white"
              } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {loading ? (
                <span role="status" aria-label="Loading">
                  Processing...
                </span>
              ) : (
                `Start Free Trial`
              )}
            </button>

            {plan.popular && (
              <p className="text-center text-amber-300/70 text-xs mt-2">
                Most traders pick this one
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="text-center pt-2">
        <button
          onClick={onBack}
          className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          &larr; Back
        </button>
      </div>
    </div>
  );
}
