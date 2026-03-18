"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

type ProvisionStatus = "loading" | "provisioning" | "success" | "already_active" | "error";

/* ── Step indicator ──────────────────────────────────────────────────────── */

type Step = {
  label: string;
  detail: string;
  done: boolean;
  active: boolean;
};

function StepList({ steps }: { steps: Step[] }) {
  return (
    <ol className="space-y-3">
      {steps.map((step, idx) => (
        <li key={idx} className="flex items-start gap-3">
          {/* Status indicator */}
          <div className="shrink-0 mt-0.5">
            {step.done ? (
              <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="white"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-3 h-3"
                  aria-hidden="true"
                >
                  <polyline points="2.5 8.5 6 12 13.5 4.5" />
                </svg>
              </div>
            ) : step.active ? (
              <div className="w-5 h-5 rounded-full bg-amber-100 border-2 border-amber-400 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              </div>
            ) : (
              <div className="w-5 h-5 rounded-full bg-slate-100 border-2 border-slate-200" />
            )}
          </div>
          <div className={step.done || step.active ? "" : "opacity-40"}>
            <p
              className={`text-sm font-medium leading-tight ${
                step.done ? "text-emerald-700" : step.active ? "text-slate-800" : "text-slate-500"
              }`}
            >
              {step.label}
            </p>
            <p className="text-xs text-slate-400 mt-0.5 leading-snug">{step.detail}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/* ── Check mark icon ──────────────────────────────────────────────────────── */

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
    </svg>
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

  const timelineSteps: Step[] = [
    {
      label: "Payment confirmed",
      detail: "Your subscription is active",
      done: true,
      active: false,
    },
    {
      label: "Store being deployed",
      detail: "Your online store and WhatsApp bot are being set up",
      done: status === "success" || status === "already_active",
      active: status === "provisioning" || status === "loading",
    },
    {
      label: "Connect your WhatsApp",
      detail: "Scan the QR code to link your WhatsApp number to your bot",
      done: status === "already_active",
      active: status === "success" || status === "provisioning",
    },
    {
      label: "Start selling",
      detail: "Share your store link and start taking orders",
      done: status === "already_active",
      active: status === "success",
    },
  ];

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full space-y-4">

        {/* Loading state */}
        {status === "loading" && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center space-y-5">
            <div
              role="status"
              aria-label="Setting up your store"
              className="mx-auto w-10 h-10 border-3 border-slate-200 border-t-slate-700 rounded-full animate-spin"
            />
            <div>
              <h1 className="text-xl font-bold text-slate-900">Setting up your store</h1>
              <p className="text-sm text-slate-500 mt-1">Just a moment...</p>
            </div>
            <div className="text-left">
              <StepList steps={timelineSteps} />
            </div>
          </div>
        )}

        {/* Error state */}
        {status === "error" && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-6 h-6 text-red-500"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">Setup failed</h1>
              <p className="text-sm text-slate-500 mt-1">Your payment was successful. We just need to retry setup.</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 text-left">
              {error}
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-slate-900 hover:bg-slate-700 text-white font-semibold text-sm px-5 py-3 rounded-lg transition-colors"
            >
              Try again
            </button>
            <p className="text-xs text-slate-400">
              Still stuck?{" "}
              <a
                href="mailto:support@moolabiz.shop"
                className="text-emerald-600 hover:underline"
              >
                support@moolabiz.shop
              </a>
            </p>
          </div>
        )}

        {/* Success / Provisioning / Already Active */}
        {(status === "success" || status === "already_active" || status === "provisioning") && (
          <>
            {/* Main card */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              {/* Top section */}
              <div className="bg-emerald-600 px-6 py-6 flex flex-col items-center text-center gap-3">
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                  <CheckCircleIcon className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">
                    {status === "already_active" ? "Your store is live" : "You're all set"}
                  </h1>
                  <p className="text-emerald-100 text-sm mt-1">
                    {status === "already_active"
                      ? "Your store is already taking orders"
                      : "Your store is being deployed now"}
                  </p>
                </div>
              </div>

              <div className="px-6 py-5 space-y-5">
                {/* Store URL */}
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    Your store URL
                  </p>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 font-mono text-sm text-slate-800 break-all">
                    https://{subdomain}
                  </div>
                  {status !== "already_active" && (
                    <p className="text-xs text-slate-400 mt-1.5">
                      Usually ready within 5–10 minutes
                    </p>
                  )}
                </div>

                {/* Progress steps */}
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                    What happens next
                  </p>
                  <StepList steps={timelineSteps} />
                </div>

                {/* Connect WhatsApp */}
                <a
                  href={`https://${subdomain}/onboard`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                      <WhatsAppIcon className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-emerald-800">
                        Connect your WhatsApp
                      </p>
                      <p className="text-xs text-emerald-600 mt-0.5 leading-snug">
                        Scan the QR code to link your WhatsApp number to your store bot. Use any WhatsApp number — personal or business.
                      </p>
                    </div>
                  </div>
                </a>
              </div>
            </div>

            {/* Action buttons */}
            <div className="space-y-2">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`I just set up my online store with MoolaBiz! Browse and order here: https://${subdomain}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm px-5 py-3 rounded-lg transition-colors"
              >
                <WhatsAppIcon className="w-4 h-4" />
                Share store link on WhatsApp
              </a>
              <a
                href="/"
                className="flex items-center justify-center w-full text-sm text-slate-500 hover:text-slate-700 transition-colors py-2"
              >
                Back to MoolaBiz
              </a>
            </div>

            {/* Support */}
            <p className="text-center text-xs text-slate-400">
              Questions?{" "}
              <a
                href="mailto:support@moolabiz.shop"
                className="text-emerald-600 hover:underline"
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
        <main className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="text-center space-y-3">
            <div className="w-10 h-10 border-3 border-slate-200 border-t-slate-700 rounded-full animate-spin mx-auto" />
            <p className="text-sm text-slate-500 font-medium">Loading...</p>
          </div>
        </main>
      }
    >
      <SetupContent />
    </Suspense>
  );
}
