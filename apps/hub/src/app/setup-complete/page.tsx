"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

type ProvisionStatus = "loading" | "provisioning" | "success" | "already_active" | "error";

/* ── Confetti ─────────────────────────────────────────────────────────────── */

const CONFETTI_COLORS = [
  "bg-amber-400",
  "bg-amber-500",
  "bg-emerald-400",
  "bg-emerald-500",
  "bg-yellow-300",
  "bg-orange-400",
  "bg-green-400",
];

function ConfettiBurst() {
  const pieces = Array.from({ length: 24 }, (_, i) => ({
    id: i,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    left: `${Math.round((i / 24) * 100)}%`,
    delay: `${(i * 0.07).toFixed(2)}s`,
    size: i % 3 === 0 ? "w-3 h-3" : i % 3 === 1 ? "w-2 h-2" : "w-1.5 h-3",
  }));

  return (
    <div
      className="relative h-32 overflow-hidden pointer-events-none select-none mb-2"
      aria-hidden="true"
    >
      {pieces.map((p) => (
        <div
          key={p.id}
          className={`confetti-piece absolute top-0 rounded-sm ${p.color} ${p.size}`}
          style={{
            left: p.left,
            animationDelay: p.delay,
          }}
        />
      ))}
      {/* Big emoji in the middle */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-7xl animate-pop-in" role="img" aria-label="Celebration">
          🎉
        </span>
      </div>
    </div>
  );
}

/* ── Progress Timeline ────────────────────────────────────────────────────── */

type Step = {
  label: string;
  detail: string;
  done: boolean;
  active: boolean;
};

function ProgressTimeline({ steps }: { steps: Step[] }) {
  return (
    <ol className="relative text-left pl-6 space-y-4 border-l-2 border-amber-100 ml-3">
      {steps.map((step, idx) => (
        <li key={idx} className="relative">
          {/* Circle on the line */}
          <div
            className={`absolute -left-[25px] top-0.5 w-5 h-5 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${
              step.done
                ? "bg-emerald-500 border-emerald-500 animate-step-complete"
                : step.active
                ? "bg-amber-400 border-amber-400 animate-pulse"
                : "bg-white border-gray-200"
            }`}
          >
            {step.done && (
              <span className="text-white text-[10px] font-extrabold leading-none">✓</span>
            )}
            {step.active && !step.done && (
              <span className="w-2 h-2 rounded-full bg-amber-950/60 inline-block" />
            )}
          </div>

          <div className={`animate-slide-up ${step.done ? "" : step.active ? "" : "opacity-40"}`}>
            <p
              className={`font-semibold text-sm leading-snug ${
                step.done
                  ? "text-emerald-700"
                  : step.active
                  ? "text-amber-800"
                  : "text-gray-400"
              }`}
            >
              {step.label}
            </p>
            <p className="text-xs text-gray-500 leading-snug mt-0.5">{step.detail}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/* ── Main Content ─────────────────────────────────────────────────────────── */

function SetupContent() {
  const params = useSearchParams();
  const slug = params.get("slug") || "your-business";
  const subdomain = `${slug}.bot.moolabiz.shop`;
  const [status, setStatus] = useState<ProvisionStatus>("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    if (slug === "your-business") return;

    async function triggerProvision() {
      try {
        const res = await fetch("/api/provision-after-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug }),
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "Setup failed. Please contact support.");
          setStatus("error");
          return;
        }

        if (data.status === "already_active") {
          setStatus("already_active");
        } else if (data.status === "provisioning") {
          setStatus("provisioning");
        } else {
          setStatus("success");
        }
      } catch {
        setError("Could not connect. Please refresh the page.");
        setStatus("error");
      }
    }

    triggerProvision();
  }, [slug]);

  /* Build timeline steps based on status */
  const timelineSteps: Step[] = [
    {
      label: "Payment confirmed",
      detail: "Your subscription is active",
      done: true,
      active: false,
    },
    {
      label: "Bot being deployed",
      detail: "Your personal WhatsApp bot is spinning up",
      done: status === "success" || status === "already_active",
      active: status === "provisioning" || status === "loading",
    },
    {
      label: "Setup instructions on the way",
      detail: "We'll send them to your WhatsApp number now",
      done: status === "success" || status === "already_active",
      active: status === "provisioning",
    },
    {
      label: "You confirm — bot goes live!",
      detail: "Reply to our WhatsApp message to activate",
      done: status === "already_active",
      active: status === "success",
    },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-50 via-white to-white flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full space-y-5">

        {/* ── Loading ── */}
        {status === "loading" && (
          <div className="bg-white rounded-2xl shadow-xl border border-amber-100 p-8 text-center space-y-5">
            <div
              role="status"
              aria-label="Setting up your bot"
              className="mx-auto w-14 h-14 border-4 border-amber-400 border-t-amber-900 rounded-full animate-spin"
            />
            <div>
              <h1 className="text-2xl font-extrabold text-amber-900">
                Payment confirmed!
              </h1>
              <p className="text-gray-500 mt-1 text-sm">
                Setting up your shop bot — just a moment...
              </p>
            </div>
            <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
              <ProgressTimeline steps={timelineSteps} />
            </div>
          </div>
        )}

        {/* ── Error ── */}
        {status === "error" && (
          <div className="bg-white rounded-2xl shadow-xl border border-red-100 p-8 text-center space-y-4">
            <div className="text-6xl" aria-hidden="true">😟</div>
            <h1 className="text-2xl font-extrabold text-gray-900">
              Something went wrong
            </h1>
            <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              {error}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-extrabold px-6 py-4 rounded-2xl transition-colors shadow-md"
            >
              Try Again
            </button>
            <p className="text-xs text-gray-400">
              Still stuck? Email{" "}
              <a
                href="mailto:support@moolabiz.shop"
                className="text-amber-700 underline"
              >
                support@moolabiz.shop
              </a>
            </p>
          </div>
        )}

        {/* ── Success / Provisioning / Already Active ── */}
        {(status === "success" ||
          status === "already_active" ||
          status === "provisioning") && (
          <>
            {/* Confetti burst + heading card */}
            <div className="bg-white rounded-2xl shadow-xl border border-amber-100 overflow-hidden">
              <div className="bg-gradient-to-br from-amber-500 to-amber-600 px-6 pt-6 pb-4">
                <ConfettiBurst />
                <div className="text-center -mt-4 pb-2">
                  <h1 className="text-3xl font-extrabold text-white drop-shadow leading-tight">
                    {status === "already_active"
                      ? "Your bot is live!"
                      : "You're all set!"}
                  </h1>
                  <p className="text-amber-100 text-sm mt-1">
                    {status === "already_active"
                      ? "Your shop is already taking orders on WhatsApp"
                      : "Your shop bot is being deployed now"}
                  </p>
                </div>
              </div>

              <div className="px-6 py-5 space-y-5">
                {/* Bot URL */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1.5">
                    Your bot will be live at
                  </p>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-amber-900 font-mono text-sm break-all flex items-center gap-2">
                    <span className="text-amber-400 text-base" aria-hidden="true">🔗</span>
                    https://{subdomain}
                  </div>
                  {status !== "already_active" && (
                    <p className="text-xs text-gray-400 mt-1.5 text-center">
                      Usually ready in 5–10 minutes
                    </p>
                  )}
                </div>

                {/* Progress timeline */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">
                    What happens next
                  </p>
                  <ProgressTimeline steps={timelineSteps} />
                </div>

                {/* WhatsApp Business reminder */}
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-start gap-3">
                  <span className="text-2xl mt-0.5 shrink-0" aria-hidden="true">💬</span>
                  <div>
                    <p className="font-bold text-emerald-800 text-sm">
                      Make sure you have WhatsApp Business
                    </p>
                    <p className="text-emerald-700 text-xs mt-0.5">
                      Download it free from the Play Store. Your bot instructions will
                      arrive on your WhatsApp number shortly.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-3">
              <a
                href={`https://wa.me/?text=I%20just%20got%20my%20own%20WhatsApp%20shop%20bot%20from%20MoolaBiz!%20Check%20it%20out%3A%20https://${subdomain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full text-center bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-extrabold px-6 py-4 rounded-2xl transition-colors shadow-lg"
              >
                📲 Tell Your Customers on WhatsApp
              </a>
              <a
                href="/"
                className="w-full text-center text-sm text-gray-400 hover:text-gray-600 transition-colors py-2"
              >
                &larr; Back to MoolaBiz
              </a>
            </div>

            {/* Support */}
            <p className="text-center text-xs text-gray-400">
              Need help?{" "}
              <a
                href="mailto:support@moolabiz.shop"
                className="text-amber-700 underline"
              >
                support@moolabiz.shop
              </a>
            </p>
          </>
        )}
      </div>
    </main>
  );
}

export default function SetupCompletePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center bg-amber-50">
          <div className="text-center space-y-3">
            <div className="w-14 h-14 border-4 border-amber-400 border-t-amber-900 rounded-full animate-spin mx-auto" />
            <p className="text-amber-800 font-semibold text-sm">Loading your setup...</p>
          </div>
        </main>
      }
    >
      <SetupContent />
    </Suspense>
  );
}
