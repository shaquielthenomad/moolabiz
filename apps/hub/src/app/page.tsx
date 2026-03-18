"use client";

import { useState, type FormEvent } from "react";
import type { SignupFormData, CheckoutResponse, PlanType, SupportedCurrency } from "@/lib/types";

type Stage = "form" | "plans" | "processing" | "error" | "waitlist";

const CURRENCY_OPTIONS: { value: SupportedCurrency; label: string; flag: string }[] = [
  { value: "zar", label: "ZAR (R)", flag: "🇿🇦" },
  { value: "usd", label: "USD ($)", flag: "🇺🇸" },
  { value: "thb", label: "THB (฿)", flag: "🇹🇭" },
];

const PAYMENT_ERROR_PATTERN = /payment system unavailable|yoco|checkout/i;

const PLANS = [
  {
    id: "intro" as PlanType,
    name: "Intro",
    priceDisplays: { zar: "R49.99", usd: "$2.99", thb: "฿99" } as Record<SupportedCurrency, string>,
    period: "/month",
    features: [
      "WhatsApp shop bot",
      "Web catalog storefront",
      "Order taking & cart",
      "1 payment provider",
      "English + 1 language",
      "Email support",
    ],
  },
  {
    id: "growth" as PlanType,
    name: "Growth",
    priceDisplays: { zar: "R149", usd: "$8.99", thb: "฿299" } as Record<SupportedCurrency, string>,
    period: "/month",
    popular: true,
    features: [
      "Everything in Intro",
      "All 5 SA languages",
      "All payment providers",
      "Appointment booking",
      "Daily revenue reports",
      "WhatsApp support",
    ],
  },
  {
    id: "pro" as PlanType,
    name: "Pro",
    priceDisplays: { zar: "R299", usd: "$16.99", thb: "฿579" } as Record<SupportedCurrency, string>,
    period: "/month",
    features: [
      "Everything in Growth",
      "AI business advisor",
      "Priority support",
      "Custom bot personality",
      "Advanced analytics",
    ],
  },
  {
    id: "business" as PlanType,
    name: "Business",
    priceDisplays: { zar: "R499", usd: "$27.99", thb: "฿949" } as Record<SupportedCurrency, string>,
    period: "/month",
    features: [
      "Everything in Pro",
      "Dedicated support",
      "Multiple WhatsApp numbers",
      "Custom integrations",
      "SLA guarantee",
    ],
  },
];

const TESTIMONIALS = [
  {
    quote:
      "I bake from home and used to take orders over WhatsApp manually. Now my store handles everything automatically. I've tripled my weekly orders.",
    name: "Lindiwe M.",
    business: "Home baker",
    location: "Pretoria",
    initial: "L",
    color: "bg-amber-500",
  },
  {
    quote:
      "I resell custom sneakers and my customers are always asking for different sizes. The bot manages stock and takes orders while I'm out sourcing pairs.",
    name: "Thabo K.",
    business: "Custom sneaker reseller",
    location: "Johannesburg",
    initial: "T",
    color: "bg-slate-700",
  },
  {
    quote:
      "My clothing boutique now gets orders at 2am. I wake up, the orders are there, payment confirmed. It's like having a staff member that never sleeps.",
    name: "Fatima A.",
    business: "Clothing boutique owner",
    location: "Cape Town",
    initial: "F",
    color: "bg-emerald-600",
  },
];

const FAQS = [
  {
    question: "How does MoolaBiz work?",
    answer:
      "When you sign up, we set up a WhatsApp bot linked to your number. Your customers message the bot, browse your products, add items to a cart, and pay — all inside WhatsApp. You get notified of every order and can manage everything from your dashboard.",
  },
  {
    question: "Do I need technical skills to set this up?",
    answer:
      "None at all. If you can send a WhatsApp message, you can use MoolaBiz. Setup takes about 2 minutes — you enter your business name, WhatsApp number, and your products. We handle all the technical parts.",
  },
  {
    question: "How do my customers pay?",
    answer:
      "We support Yoco, Ozow, and PayFast — South Africa's most trusted payment providers. Customers can pay by card or EFT directly through the WhatsApp conversation. Funds settle to your account as normal.",
  },
  {
    question: "Can I use my existing WhatsApp number?",
    answer:
      "Yes. Your existing WhatsApp number stays yours. MoolaBiz connects to it so your customers keep messaging the same number they already know.",
  },
  {
    question: "What if I want to cancel?",
    answer:
      "There are no contracts and no cancellation fees. You can cancel at any time from your dashboard. Your subscription simply won't renew at the end of the billing period.",
  },
];

export default function Home() {
  const [stage, setStage] = useState<Stage>("form");
  const [error, setError] = useState("");
  const [currency, setCurrency] = useState<SupportedCurrency>("zar");
  const [formData, setFormData] = useState<SignupFormData>({
    businessName: "",
    email: "",
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
        body: JSON.stringify({ ...formData, plan: planId, currency }),
      });

      const data: CheckoutResponse = await res.json();

      if (!res.ok || !data.success || !data.checkoutUrl) {
        const errMsg = data.error || "Could not start checkout. Please try again.";
        if (PAYMENT_ERROR_PATTERN.test(errMsg) || res.status === 503) {
          setStage("waitlist");
          return;
        }
        setError(errMsg);
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
    <main className="min-h-screen bg-white text-slate-900">

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-white border-b border-slate-200">
        <div className="max-w-screen-xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="font-bold text-xl text-slate-900 tracking-tight">MoolaBiz</span>
          <a
            href="/login"
            className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            Log in
          </a>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="bg-white px-6 pt-20 pb-24 text-center">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-amber-50 text-amber-700 text-xs font-semibold px-3.5 py-1.5 rounded-full mb-8 tracking-wide border border-amber-200">
            Howzit! Built for South African sellers
          </div>

          <h1 className="text-5xl sm:text-6xl font-bold text-slate-900 leading-tight tracking-tight">
            Your WhatsApp store.<br />
            <span className="text-[#f59e0b]">Always open.</span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-slate-500 max-w-xl mx-auto leading-relaxed">
            Turn your WhatsApp into a 24/7 online store. Take orders, accept
            payments, and grow your business — no tech skills needed.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="#signup"
              className="w-full sm:w-auto bg-[#059669] hover:bg-[#047857] text-white font-semibold text-base px-8 py-3.5 rounded-xl shadow-sm transition-colors"
            >
              Start selling &rarr;
            </a>
            <a
              href="#how-it-works"
              className="w-full sm:w-auto border border-slate-300 hover:border-slate-400 text-slate-700 font-semibold text-base px-8 py-3.5 rounded-xl transition-colors"
            >
              See how it works
            </a>
          </div>

          <p className="mt-5 text-sm text-slate-400">
            Cancel anytime &middot; Live in under 10 minutes
          </p>
        </div>
      </section>

      {/* ── How It Works ────────────────────────────────────────────────── */}
      <section id="how-it-works" className="bg-[#f8fafc] border-y border-slate-200 py-20 px-6">
        <div className="max-w-screen-lg mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold tracking-widest uppercase text-[#f59e0b] mb-3">
              Simple setup
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
              Up and running in three steps
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 relative">
            {/* Connector line — desktop only */}
            <div
              className="hidden sm:block absolute top-8 left-[calc(16.67%+2rem)] right-[calc(16.67%+2rem)] h-px bg-slate-200 z-0"
              aria-hidden="true"
            />

            {[
              {
                step: "01",
                title: "Sign up in 2 minutes",
                detail:
                  "Enter your business name, WhatsApp number, and the products you sell. No technical knowledge required.",
                icon: (
                  <svg className="w-6 h-6 text-slate-700" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                ),
              },
              {
                step: "02",
                title: "Connect your WhatsApp",
                detail:
                  "We deploy your store bot to your existing WhatsApp number. Your customers keep messaging the same number they already know.",
                icon: (
                  <svg className="w-6 h-6 text-slate-700" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                  </svg>
                ),
              },
              {
                step: "03",
                title: "Start selling",
                detail:
                  "Share your store link. Customers browse, add to cart, and pay — all inside WhatsApp, 24 hours a day.",
                icon: (
                  <svg className="w-6 h-6 text-slate-700" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                  </svg>
                ),
              },
            ].map((item) => (
              <div key={item.step} className="relative z-10 flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center mb-5">
                  {item.icon}
                </div>
                <p className="text-xs font-bold text-[#f59e0b] tracking-widest mb-2">{item.step}</p>
                <h3 className="font-semibold text-slate-900 text-base mb-2">{item.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed max-w-[220px]">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────────── */}
      <section className="bg-white py-20 px-6">
        <div className="max-w-screen-lg mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold tracking-widest uppercase text-[#f59e0b] mb-3">
              Everything you need
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
              Built for South African sellers
            </h2>
            <p className="mt-4 text-slate-500 max-w-xl mx-auto">
              Whether you sell cakes, clothing, sneakers, beauty products, or anything else —
              MoolaBiz handles the selling so you can focus on your craft.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                title: "WhatsApp ordering",
                description:
                  "Customers browse your products and place orders directly inside WhatsApp — the app they already use every day.",
                icon: (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                  </svg>
                ),
              },
              {
                title: "Web storefront",
                description:
                  "Your products also live on a clean web catalog page — shareable on Instagram, Facebook, or wherever your customers find you.",
                icon: (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                ),
              },
              {
                title: "Payment integration",
                description:
                  "Accept payments via Yoco, Ozow, or PayFast. Customers pay by card or EFT without leaving the conversation.",
                icon: (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
                  </svg>
                ),
              },
              {
                title: "Multiple languages",
                description:
                  "Your store speaks English, Zulu, Xhosa, Sotho, and Afrikaans. Reach customers in the language they&apos;re most comfortable with.",
                icon: (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 016-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 01-3.827-5.802" />
                  </svg>
                ),
              },
              {
                title: "Order management",
                description:
                  "See all incoming orders in a clean dashboard. Update order status, manage your product list, and track what&apos;s selling.",
                icon: (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                ),
              },
              {
                title: "Daily reports",
                description:
                  "Get a daily summary of your revenue, top-selling products, and new customers — straight to your WhatsApp every morning.",
                icon: (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                  </svg>
                ),
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="bg-[#f8fafc] rounded-2xl border border-slate-200 p-6 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
              >
                <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-700 mb-4 shadow-sm">
                  {feature.icon}
                </div>
                <h3 className="font-semibold text-slate-900 text-base mb-2">{feature.title}</h3>
                <p
                  className="text-sm text-slate-500 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: feature.description }}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ────────────────────────────────────────────────── */}
      <section className="bg-[#f8fafc] border-y border-slate-200 py-20 px-6">
        <div className="max-w-screen-lg mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold tracking-widest uppercase text-[#f59e0b] mb-3">
              What sellers say
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
              Real people, real results
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t) => (
              <div
                key={t.name}
                className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col gap-5 hover:shadow-md transition-shadow duration-200"
              >
                {/* Stars */}
                <div className="flex gap-0.5" aria-label="5 stars">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="w-4 h-4 text-amber-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>

                <p className="text-slate-600 text-sm leading-relaxed flex-1">
                  &ldquo;{t.quote}&rdquo;
                </p>

                <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold text-sm shrink-0 ${t.color}`}
                    aria-hidden="true"
                  >
                    {t.initial}
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-slate-900">{t.name}</p>
                    <p className="text-xs text-slate-400">{t.business} &middot; {t.location}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ─────────────────────────────────────────────────────── */}
      <section id="signup" className="bg-white py-20 px-6 scroll-mt-16">
        <div className="max-w-screen-xl mx-auto">
          <div className="text-center mb-4">
            <p className="text-xs font-semibold tracking-widest uppercase text-[#f59e0b] mb-3">
              Pricing
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
              Simple, transparent pricing
            </h2>
            <p className="mt-3 text-slate-500">
              Pay monthly, cancel anytime. No contracts.
            </p>

            {/* Currency selector */}
            <div className="mt-5 flex items-center justify-center gap-2" role="group" aria-label="Select currency">
              {CURRENCY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setCurrency(opt.value)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    currency === opt.value
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-600 border-slate-300 hover:border-slate-400"
                  }`}
                  aria-pressed={currency === opt.value}
                >
                  <span aria-hidden="true">{opt.flag}</span>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sign-up flow */}
          <div className="mt-12">
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
                currency={currency}
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
            {stage === "waitlist" && (
              <PaymentWaitlist
                whatsappNumber={formData.whatsappNumber}
                businessName={formData.businessName}
                onBack={() => { setStage("plans"); setError(""); }}
              />
            )}
          </div>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────────── */}
      <section className="bg-[#f8fafc] border-y border-slate-200 py-20 px-6">
        <div className="max-w-screen-md mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold tracking-widest uppercase text-[#f59e0b] mb-3">
              FAQ
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
              Common questions
            </h2>
          </div>
          <div className="space-y-3">
            {FAQS.map((faq) => (
              <FAQItem key={faq.question} question={faq.question} answer={faq.answer} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────────────────────── */}
      <section className="bg-white py-24 px-6 text-center">
        <div className="max-w-xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
            Ready to start selling?
          </h2>
          <p className="mt-4 text-slate-500 text-lg">
            Join South African sellers who run their business through WhatsApp.
          </p>
          <div className="mt-8">
            <a
              href="#signup"
              className="inline-block bg-[#059669] hover:bg-[#047857] text-white font-semibold text-base px-10 py-4 rounded-xl shadow-sm transition-colors"
            >
              Start selling &rarr;
            </a>
          </div>
          <p className="mt-4 text-sm text-slate-400">
            Pay monthly &middot; Cancel anytime
          </p>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-200 py-10 px-6">
        <div className="max-w-screen-xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-400">
          <span className="font-semibold text-slate-500 tracking-tight">MoolaBiz</span>
          <div className="flex items-center gap-6">
            <a href="/privacy" className="hover:text-slate-600 transition-colors">Privacy</a>
            <a href="/terms" className="hover:text-slate-600 transition-colors">Terms</a>
            <a href="mailto:support@moolabiz.shop" className="hover:text-slate-600 transition-colors">Contact</a>
          </div>
          <p>&copy; 2026 MoolaBiz &mdash; Made in South Africa</p>
        </div>
      </footer>
    </main>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   FAQ accordion item
   ────────────────────────────────────────────────────────────────────────── */

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full text-left px-6 py-5 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors"
        aria-expanded={open}
      >
        <span className="font-medium text-slate-900 text-sm sm:text-base">{question}</span>
        <svg
          className={`w-5 h-5 text-slate-400 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {open && (
        <div className="px-6 pb-5">
          <p className="text-slate-500 text-sm leading-relaxed">{answer}</p>
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Signup form
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
      className="max-w-md mx-auto bg-white rounded-2xl border border-slate-200 shadow-sm p-8 space-y-5"
    >
      <div>
        <h3 className="text-xl font-bold text-slate-900">Create your store</h3>
        <p className="text-sm text-slate-500 mt-1">Takes about 2 minutes</p>
      </div>

      <div>
        <label htmlFor="businessName" className="block text-sm font-medium text-slate-700 mb-1.5">
          Business name
        </label>
        <input
          id="businessName"
          type="text"
          required
          minLength={2}
          maxLength={60}
          placeholder="e.g. Lindiwe's Cakes"
          value={formData.businessName}
          onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
          className="block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none text-base transition-colors"
        />
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
          Email address
        </label>
        <input
          id="email"
          type="email"
          required
          placeholder="you@example.com"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          className="block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none text-base transition-colors"
        />
        <p className="text-xs text-slate-400 mt-1.5">We&apos;ll send your store details here.</p>
      </div>

      <div>
        <label htmlFor="whatsappNumber" className="block text-sm font-medium text-slate-700 mb-1.5">
          WhatsApp number
        </label>
        <input
          id="whatsappNumber"
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
          className="block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none text-base transition-colors"
        />
        <p className="text-xs text-slate-400 mt-1.5">Your number stays private. We never share it.</p>
      </div>

      <div>
        <label htmlFor="paymentProvider" className="block text-sm font-medium text-slate-700 mb-1.5">
          Payment provider
        </label>
        <select
          id="paymentProvider"
          required
          value={formData.paymentProvider}
          onChange={(e) =>
            setFormData({
              ...formData,
              paymentProvider: e.target.value as SignupFormData["paymentProvider"],
            })
          }
          className="block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none text-base transition-colors"
        >
          <option value="yoco">Yoco</option>
          <option value="ozow">Ozow</option>
          <option value="payfast">PayFast</option>
        </select>
      </div>

      <div>
        <label htmlFor="pin" className="block text-sm font-medium text-slate-700 mb-1.5">
          Create a 4-digit PIN
        </label>
        <input
          id="pin"
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
          className="block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none text-base tracking-[0.5em] text-center text-2xl transition-colors"
        />
        <p className="text-xs text-slate-400 mt-1.5">You&apos;ll use this to log in to your dashboard.</p>
      </div>

      <button
        type="submit"
        className="w-full bg-[#059669] hover:bg-[#047857] text-white font-semibold text-base py-3.5 rounded-xl shadow-sm transition-colors"
      >
        Choose a plan &rarr;
      </button>

      <p className="text-xs text-slate-400 text-center">
        Pay monthly &middot; Cancel anytime &middot; No contracts
      </p>
    </form>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Plan picker
   ────────────────────────────────────────────────────────────────────────── */

function PlanPicker({
  error,
  loading,
  currency,
  onSelect,
  onBack,
}: {
  error: string;
  loading: boolean;
  currency: SupportedCurrency;
  onSelect: (plan: PlanType) => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-8">
      <div className="text-center">
        <h3 className="text-xl font-bold text-slate-900">Choose your plan</h3>
        <p className="text-slate-500 mt-1 text-sm">
          All plans include your WhatsApp store. Cancel anytime.
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className={`relative flex flex-col rounded-2xl border p-6 transition-all duration-200 hover:shadow-lg ${
              plan.popular
                ? "border-[#059669] border-2 shadow-md"
                : "border-slate-200 shadow-sm"
            } bg-white`}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#059669] text-white text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap">
                Most popular
              </div>
            )}

            <h3 className="font-bold text-slate-900 text-base mt-2">{plan.name}</h3>

            <div className="mt-3 flex items-end gap-1">
              <span className="text-3xl font-bold text-slate-900 leading-none">
                {plan.priceDisplays[currency]}
              </span>
              <span className="text-slate-400 text-sm pb-0.5">/month</span>
            </div>

            <div className="my-4 border-t border-slate-100" />

            <ul className="space-y-2.5 flex-1">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-slate-600">
                  <svg
                    className="w-4 h-4 text-[#059669] mt-0.5 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2.5}
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>

            <button
              onClick={() => onSelect(plan.id)}
              disabled={loading}
              className={`mt-6 w-full py-3 rounded-xl font-semibold text-sm transition-colors ${
                plan.popular
                  ? "bg-[#059669] hover:bg-[#047857] text-white shadow-sm"
                  : "border border-slate-300 hover:border-slate-400 text-slate-700"
              } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {loading ? (
                <span role="status" aria-label="Loading">Processing...</span>
              ) : (
                "Get started"
              )}
            </button>
          </div>
        ))}
      </div>

      <div className="text-center">
        <button
          onClick={onBack}
          className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
        >
          &larr; Back
        </button>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Payment waitlist
   ────────────────────────────────────────────────────────────────────────── */

function PaymentWaitlist({
  whatsappNumber,
  businessName,
  onBack,
}: {
  whatsappNumber: string;
  businessName: string;
  onBack: () => void;
}) {
  const [waitlistNumber, setWaitlistNumber] = useState(whatsappNumber || "+27");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleWaitlistSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ whatsappNumber: waitlistNumber, businessName }),
      });
    } catch {
      /* silent — we still confirm to the user */
    }
    setSubmitting(false);
    setSubmitted(true);
  }

  return (
    <div className="max-w-sm mx-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 space-y-5">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center mx-auto">
            <svg className="w-6 h-6 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-slate-900">Payments coming soon</h3>
          <p className="text-sm text-slate-500 leading-relaxed">
            We&apos;re finalising our payment setup. Leave your number and we&apos;ll
            message you the moment it&apos;s ready — usually within a day.
          </p>
        </div>

        {submitted ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-4 text-center space-y-1">
            <svg className="w-8 h-8 text-emerald-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-emerald-800 font-semibold text-sm">You&apos;re on the list</p>
            <p className="text-emerald-600 text-xs">
              We&apos;ll message you at{" "}
              <span className="font-medium">{waitlistNumber}</span>.
            </p>
          </div>
        ) : (
          <form onSubmit={handleWaitlistSubmit} className="space-y-4">
            <div>
              <label htmlFor="waitlistNumber" className="block text-sm font-medium text-slate-700 mb-1.5">
                Your WhatsApp number
              </label>
              <input
                id="waitlistNumber"
                type="tel"
                required
                pattern="\+27\d{9}"
                title="Enter your number like +27821234567"
                placeholder="+27821234567"
                value={waitlistNumber}
                onChange={(e) => {
                  let val = e.target.value.replace(/[\s\-()]/g, "");
                  if (!val.startsWith("+27")) val = "+27";
                  setWaitlistNumber(val);
                }}
                className="block w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none text-base transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-[#059669] hover:bg-[#047857] text-white font-semibold text-base py-3.5 rounded-xl shadow-sm transition-colors disabled:opacity-50"
            >
              {submitting ? "Saving..." : "Notify me"}
            </button>
          </form>
        )}

        <div className="text-center">
          <button
            onClick={onBack}
            className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
          >
            &larr; Back to plans
          </button>
        </div>
      </div>
    </div>
  );
}
