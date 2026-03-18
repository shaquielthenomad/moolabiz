"use client";

import { useState, useEffect, useCallback } from "react";

type Status = "loading" | "qr" | "connected";

function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={`animate-spin rounded-full border-[3px] border-slate-200 border-t-emerald-600 ${className || "h-10 w-10"}`}
    />
  );
}

function CheckCircle({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
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

export default function OnboardPage() {
  const [status, setStatus] = useState<Status>("loading");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState("Your Store");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const title = document.title;
      if (title && title !== "MoolaBiz Shop") {
        setBusinessName(title);
      }
    }
  }, []);

  // Fetch QR code on mount
  const fetchQr = useCallback(async () => {
    try {
      const res = await fetch("/api/onboard/qr");
      if (!res.ok) return;
      const data = await res.json();
      if (data.connected) {
        setStatus("connected");
        return true;
      }
      if (data.qrCode) {
        setQrCode(data.qrCode);
        setStatus("qr");
      } else {
        // Gateway is up but no QR yet — show the QR state anyway
        // so we can display the iframe fallback
        setStatus("qr");
      }
    } catch {
      // Gateway not ready — stay in loading
    }
    return false;
  }, []);

  useEffect(() => {
    fetchQr();
  }, [fetchQr]);

  // Poll for connection status
  useEffect(() => {
    if (status === "connected") return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/onboard/status");
        if (!res.ok) return;
        const data = await res.json();
        if (data.connected) {
          setStatus("connected");
        } else if (data.qrReady && status === "loading") {
          fetchQr();
        }
      } catch {
        // ignore
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [status, fetchQr]);

  // Re-fetch QR every 30s (QR codes expire)
  useEffect(() => {
    if (status !== "qr") return;

    const interval = setInterval(() => {
      fetchQr();
    }, 30000);

    return () => clearInterval(interval);
  }, [status, fetchQr]);

  return (
    <main className="min-h-screen bg-white flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full text-center space-y-8">
        {/* Branding */}
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600">
            MoolaBiz
          </p>
          <h1 className="text-2xl font-bold text-slate-900">
            Connect your WhatsApp
          </h1>
          <p className="text-slate-500 text-sm mt-2">
            Link your WhatsApp number to <span className="font-medium text-slate-700">{businessName}</span>
          </p>
        </div>

        {/* Loading state */}
        {status === "loading" && (
          <div className="flex flex-col items-center gap-4 py-12">
            <Spinner />
            <p className="text-sm text-slate-500">
              Connecting to WhatsApp gateway...
            </p>
          </div>
        )}

        {/* QR code state */}
        {status === "qr" && (
          <div className="space-y-6">
            <div className="inline-block rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              {qrCode ? (
                <img
                  src={qrCode.startsWith("data:") ? qrCode : `data:image/png;base64,${qrCode}`}
                  alt="WhatsApp linking QR code"
                  className="w-64 h-64"
                />
              ) : (
                <div className="w-64 h-64 flex flex-col items-center justify-center gap-3">
                  <Spinner />
                  <p className="text-xs text-slate-400">Waiting for QR code...</p>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-700">
                Scan this QR code with your WhatsApp
              </p>
              <ol className="text-sm text-slate-500 space-y-1.5 text-left max-w-xs mx-auto">
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold flex items-center justify-center mt-0.5">
                    1
                  </span>
                  Open WhatsApp on your phone
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold flex items-center justify-center mt-0.5">
                    2
                  </span>
                  Go to Settings &gt; Linked Devices
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold flex items-center justify-center mt-0.5">
                    3
                  </span>
                  Tap &quot;Link a Device&quot; and scan the code above
                </li>
              </ol>
            </div>

            <p className="text-xs text-slate-400">
              The QR code refreshes automatically. If it expires, wait a moment.
            </p>
          </div>
        )}

        {/* Connected / success state */}
        {status === "connected" && (
          <div className="space-y-6">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-50">
              <CheckCircle className="w-10 h-10 text-emerald-600" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-slate-900">Connected!</h2>
              <p className="text-sm text-slate-500">
                Your WhatsApp is now linked. Your bot is ready to go.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-left space-y-4">
              <p className="text-sm font-medium text-slate-700">
                Message your bot on WhatsApp to start setting up your store:
              </p>
              <div className="space-y-2.5">
                <CommandRow
                  command="/add-product"
                  description="Add a product to your catalog"
                />
                <CommandRow
                  command="/set-payment-key"
                  description="Configure payment integration"
                />
                <CommandRow
                  command="/orders"
                  description="View and manage incoming orders"
                />
              </div>
            </div>

            <a
              href="/"
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
            >
              <WhatsAppIcon className="w-4 h-4" />
              Go to your store
            </a>
          </div>
        )}

        {/* Footer */}
        <p className="text-xs text-slate-300 pt-4">
          Powered by MoolaBiz
        </p>
      </div>
    </main>
  );
}

function CommandRow({
  command,
  description,
}: {
  command: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <code className="flex-shrink-0 rounded-md bg-white border border-slate-200 px-2 py-1 text-xs font-mono text-emerald-700">
        {command}
      </code>
      <span className="text-sm text-slate-500 pt-0.5">{description}</span>
    </div>
  );
}
