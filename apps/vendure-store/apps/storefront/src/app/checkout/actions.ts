'use server';

import {mutate, query} from '@/lib/vendure/api';
import {
    SetOrderShippingAddressMutation,
    SetOrderBillingAddressMutation,
    SetOrderShippingMethodMutation,
    AddPaymentToOrderMutation,
    CreateCustomerAddressMutation,
    TransitionOrderToStateMutation,
    SetCustomerForOrderMutation,
} from '@/lib/vendure/mutations';
import {GetActiveOrderForCheckoutQuery} from '@/lib/vendure/queries';
import {revalidatePath, updateTag} from 'next/cache';
import {redirect} from "next/navigation";
import {headers as getHeaders} from 'next/headers';

const HUB_API_URL = process.env.HUB_API_URL || 'https://moolabiz.shop';

interface AddressInput {
    fullName: string;
    streetLine1: string;
    streetLine2?: string;
    city: string;
    province: string;
    postalCode: string;
    countryCode: string;
    phoneNumber: string;
    company?: string;
}

export async function setShippingAddress(
    shippingAddress: AddressInput,
    useSameForBilling: boolean
) {
    const shippingResult = await mutate(
        SetOrderShippingAddressMutation,
        {input: shippingAddress},
        {useAuthToken: true}
    );

    if (shippingResult.data.setOrderShippingAddress.__typename !== 'Order') {
        throw new Error('Failed to set shipping address');
    }

    if (useSameForBilling) {
        await mutate(
            SetOrderBillingAddressMutation,
            {input: shippingAddress},
            {useAuthToken: true}
        );
    }

    revalidatePath('/checkout');
}

export async function setShippingMethod(shippingMethodId: string) {
    const result = await mutate(
        SetOrderShippingMethodMutation,
        {shippingMethodId: [shippingMethodId]},
        {useAuthToken: true}
    );

    if (result.data.setOrderShippingMethod.__typename !== 'Order') {
        throw new Error('Failed to set shipping method');
    }

    revalidatePath('/checkout');
}

export async function createCustomerAddress(address: AddressInput) {
    const result = await mutate(
        CreateCustomerAddressMutation,
        {input: address},
        {useAuthToken: true}
    );

    if (!result.data.createCustomerAddress) {
        throw new Error('Failed to create customer address');
    }

    revalidatePath('/checkout');
    return result.data.createCustomerAddress;
}

export async function transitionToArrangingPayment() {
    const result = await mutate(
        TransitionOrderToStateMutation,
        {state: 'ArrangingPayment'},
        {useAuthToken: true}
    );

    if (result.data.transitionOrderToState?.__typename === 'OrderStateTransitionError') {
        const errorResult = result.data.transitionOrderToState;
        throw new Error(
            `Failed to transition order state: ${errorResult.errorCode} - ${errorResult.message}`
        );
    }

    revalidatePath('/checkout');
}

export async function placeOrder(paymentMethodCode: string) {
    // Grab active order details before payment (for the merchant notification)
    let customerName = 'Guest';
    let totalWithTax = 0;
    let totalQuantity = 0;
    let shippingAddress = '';
    try {
        const activeOrder = await query(GetActiveOrderForCheckoutQuery, undefined, {
            useAuthToken: true,
        });
        const order = activeOrder.data.activeOrder;
        if (order) {
            if (order.customer) {
                customerName = `${order.customer.firstName} ${order.customer.lastName}`.trim();
            }
            totalWithTax = order.totalWithTax;
            totalQuantity = order.totalQuantity;
            if (order.shippingAddress) {
                const addr = order.shippingAddress;
                shippingAddress = [addr.streetLine1, addr.city, addr.province]
                    .filter(Boolean)
                    .join(', ');
            }
        }
    } catch {
        // Non-critical — continue with order placement even if we can't read details
    }

    // First, transition the order to ArrangingPayment state
    await transitionToArrangingPayment();

    // Prepare metadata based on payment method
    const metadata: Record<string, unknown> = {};

    // For standard payment, include the required fields
    if (paymentMethodCode === 'standard-payment') {
        metadata.shouldDecline = false;
        metadata.shouldError = false;
        metadata.shouldErrorOnSettle = false;
    }

    // Add payment to the order
    const result = await mutate(
        AddPaymentToOrderMutation,
        {
            input: {
                method: paymentMethodCode,
                metadata,
            },
        },
        {useAuthToken: true}
    );

    if (result.data.addPaymentToOrder.__typename !== 'Order') {
        const errorResult = result.data.addPaymentToOrder;
        throw new Error(
            `Failed to place order: ${errorResult.errorCode} - ${errorResult.message}`
        );
    }

    const orderCode = result.data.addPaymentToOrder.code;

    // Send merchant notification (non-blocking — fire and forget)
    // This must happen before redirect() which throws
    sendOrderNotification({
        orderCode,
        customerName,
        total: totalWithTax,
        itemCount: totalQuantity,
        shippingAddress: shippingAddress || undefined,
    }).catch((err) => {
        console.error('[checkout] Order notification failed (non-blocking):', err);
    });

    // Update the cart tag to immediately invalidate cached cart data
    updateTag('cart');
    updateTag('active-order');

    redirect(`/order-confirmation/${orderCode}`);
}

/**
 * Fire-and-forget: notify the merchant about a new order via the Hub API.
 * Uses the Vendure channel token (from middleware) to authenticate.
 */
async function sendOrderNotification(orderDetails: {
    orderCode: string;
    customerName: string;
    total: number;
    itemCount: number;
    shippingAddress?: string;
}): Promise<void> {
    try {
        const hdrs = await getHeaders();
        const channelToken = hdrs.get('x-vendure-channel-token');

        if (!channelToken) {
            console.warn('[checkout] No channel token available, skipping order notification');
            return;
        }

        const res = await fetch(
            `${HUB_API_URL}/api/storefront/order-notification`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-vendure-channel-token': channelToken,
                },
                body: JSON.stringify(orderDetails),
            }
        );

        if (!res.ok) {
            const text = await res.text();
            console.error(`[checkout] Order notification HTTP ${res.status}:`, text);
        }
    } catch (err) {
        // Swallow — notification must never block checkout
        console.error('[checkout] Order notification error:', err);
    }
}

interface GuestCustomerInput {
    emailAddress: string;
    firstName: string;
    lastName: string;
    phoneNumber?: string;
}

export type SetCustomerForOrderResult =
    | { success: true }
    | { success: false; errorCode: 'EMAIL_CONFLICT'; message: string }
    | { success: false; errorCode: 'GUEST_CHECKOUT_DISABLED'; message: string }
    | { success: false; errorCode: 'NO_ACTIVE_ORDER'; message: string }
    | { success: false; errorCode: 'UNKNOWN'; message: string };

export async function setCustomerForOrder(
    input: GuestCustomerInput
): Promise<SetCustomerForOrderResult> {
    const result = await mutate(
        SetCustomerForOrderMutation,
        { input },
        { useAuthToken: true }
    );

    const response = result.data.setCustomerForOrder;

    switch (response.__typename) {
        case 'Order':
            revalidatePath('/checkout');
            return { success: true };
        case 'AlreadyLoggedInError':
            return { success: true };
        case 'EmailAddressConflictError':
            return { success: false, errorCode: 'EMAIL_CONFLICT', message: response.message };
        case 'GuestCheckoutError':
            return { success: false, errorCode: 'GUEST_CHECKOUT_DISABLED', message: response.message };
        case 'NoActiveOrderError':
            return { success: false, errorCode: 'NO_ACTIVE_ORDER', message: response.message };
        default:
            return { success: false, errorCode: 'UNKNOWN', message: 'Unknown error' };
    }
}
