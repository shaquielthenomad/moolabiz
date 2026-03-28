import { NextResponse } from "next/server";
import type { ProvisionResponse } from "@/lib/types";

/**
 * POST /api/provision
 *
 * This endpoint was the old Coolify-based manual provisioner.
 * Provisioning is now fully automated via the Stripe payment webhook
 * (/api/webhook/payment) and the provision-after-payment flow.
 *
 * Kept as a 410 stub to avoid silent 404s if any old scripts hit it.
 */
export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error:
        "This endpoint is retired. Provisioning is handled automatically after payment.",
    } satisfies ProvisionResponse,
    { status: 410 }
  );
}
