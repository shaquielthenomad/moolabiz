/**
 * Shared merchant provisioning logic.
 *
 * Used by both the Stripe webhook handler and the provision-after-payment
 * API route to avoid divergence between the two code paths.
 */

import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { merchants } from "@/lib/db/schema";
import { deployOpenClaw } from "@/lib/openclaw";
import {
  createMerchantChannel,
  createMerchantSeller,
  createDefaultShippingMethod,
  deleteMerchantChannel,
} from "@/lib/vendure-admin";
import { sendWelcomeEmail } from "@/lib/email";
import { getPlan } from "@/lib/plans";

export interface ProvisionMerchantInput {
  merchantId: string;
  slug: string;
  businessName: string;
  whatsappNumber: string;
  paymentProvider: string;
  plan: string;
  email: string | null;
  /** Pre-existing Vendure channel ID (from a previous partial attempt) */
  existingVendureChannelId?: string | null;
  /** Pre-existing Vendure channel token (from a previous partial attempt) */
  existingVendureChannelToken?: string | null;
}

export interface ProvisionMerchantResult {
  success: boolean;
  vendureChannelId: string | null;
  openclawContainerId: string | null;
  error?: string;
}

/**
 * Provision a merchant's Vendure channel, seller, and OpenClaw instance.
 *
 * This function assumes the caller has already set the merchant status to
 * "provisioning" and performed any necessary guards (idempotency, auth, etc.).
 *
 * On failure, it rolls back the Vendure channel (if newly created) and
 * resets the merchant status to "pending".
 */
export async function provisionMerchant(
  input: ProvisionMerchantInput
): Promise<ProvisionMerchantResult> {
  const {
    merchantId,
    slug,
    businessName,
    whatsappNumber,
    paymentProvider,
    plan,
    email,
    existingVendureChannelId,
    existingVendureChannelToken,
  } = input;

  let vendureChannelId: string | null = existingVendureChannelId ?? null;
  let channelToken: string | null | undefined = existingVendureChannelToken;
  let createdNewChannel = false;

  try {
    // 1. Create Vendure channel (skip if already exists from previous attempt)
    if (!vendureChannelId || !channelToken) {
      const channel = await createMerchantChannel(slug, businessName);
      vendureChannelId = channel.channelId;
      channelToken = channel.channelToken;
      createdNewChannel = true;

      // Create a seller and assign to the channel
      await createMerchantSeller(vendureChannelId, businessName);

      // Create a default shipping method for checkout to work
      await createDefaultShippingMethod(vendureChannelId);

      // Store Vendure channel info immediately
      await db
        .update(merchants)
        .set({
          vendureChannelId,
          vendureChannelToken: channelToken,
          updatedAt: new Date(),
        })
        .where(eq(merchants.id, merchantId));

      console.log(`[provision] Vendure channel created: ${vendureChannelId}`);
    }

    // 2. Generate API secret
    const apiSecret = crypto.randomBytes(32).toString("hex");
    await db
      .update(merchants)
      .set({ apiSecret, updatedAt: new Date() })
      .where(eq(merchants.id, merchantId));

    // 3. Deploy OpenClaw WhatsApp bot
    let openclawContainerId: string | null = null;
    try {
      const ocResult = await deployOpenClaw({
        slug,
        businessName,
        ownerPhone: whatsappNumber,
        paymentProvider,
        apiSecret,
        vendureChannelToken: channelToken!,
      });
      openclawContainerId = ocResult.containerId;
      console.log(`[provision] OpenClaw deployed: ${openclawContainerId}`);
    } catch (ocErr) {
      console.error("[provision] OpenClaw failed (non-fatal):", ocErr);
    }

    // 4. Update merchant status to active
    await db
      .update(merchants)
      .set({ status: "active", openclawContainerId, updatedAt: new Date() })
      .where(eq(merchants.id, merchantId));

    // 5. Send welcome email
    if (email) {
      const planInfo = getPlan(plan);
      sendWelcomeEmail({
        to: email,
        businessName,
        slug,
        plan: planInfo ? `${planInfo.name} — ${planInfo.priceDisplay}/mo` : plan,
      }).catch((err) => console.error("[email] Welcome email failed:", err));
    }

    return {
      success: true,
      vendureChannelId,
      openclawContainerId,
    };
  } catch (err) {
    console.error("[provision] Provisioning failed:", err);

    // Rollback Vendure channel if we just created it
    if (vendureChannelId && createdNewChannel) {
      try {
        await deleteMerchantChannel(vendureChannelId);
      } catch (cleanupErr) {
        console.error("[provision] Failed to cleanup Vendure channel:", cleanupErr);
      }
    }

    // Reset status to pending so merchant can retry
    if (createdNewChannel || !existingVendureChannelId) {
      try {
        await db
          .update(merchants)
          .set({ status: "pending", updatedAt: new Date() })
          .where(eq(merchants.id, merchantId));
      } catch (rollbackErr) {
        console.error(
          "[provision] Failed to reset merchant status to pending:",
          rollbackErr
        );
      }
    }

    return {
      success: false,
      vendureChannelId: null,
      openclawContainerId: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
