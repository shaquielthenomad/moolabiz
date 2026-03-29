import { EmailEventListener } from '@vendure/email-plugin';
import { OrderStateTransitionEvent } from '@vendure/core';

/**
 * Fires when an order transitions to the "Shipped" state.
 * Sends the customer a shipping notification with their delivery address.
 */
export const shippingConfirmationHandler = new EmailEventListener('shipping-confirmation')
    .on(OrderStateTransitionEvent)
    .filter(event => event.toState === 'Shipped' && !!event.order.customer?.emailAddress)
    .setRecipient(event => event.order.customer?.emailAddress ?? '')
    .setFrom('{{ fromAddress }}')
    .setSubject('Your order #{{ order.code }} has been shipped!')
    .setTemplateVars(event => ({
        order: event.order,
        shippingAddress: event.order.shippingAddress,
        shippingLines: event.order.shippingLines,
    }));

/**
 * Fires when an order transitions to the "Delivered" state.
 * Sends the customer a delivery confirmation with an order summary.
 */
export const deliveryConfirmationHandler = new EmailEventListener('delivery-confirmation')
    .on(OrderStateTransitionEvent)
    .filter(event => event.toState === 'Delivered' && !!event.order.customer?.emailAddress)
    .setRecipient(event => event.order.customer?.emailAddress ?? '')
    .setFrom('{{ fromAddress }}')
    .setSubject('Your order #{{ order.code }} has been delivered!')
    .setTemplateVars(event => ({
        order: event.order,
        shippingAddress: event.order.shippingAddress,
        shippingLines: event.order.shippingLines,
    }));
