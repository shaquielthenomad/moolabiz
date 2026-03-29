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
    .loadData(async ({ event, injector }) => {
        const { OrderService } = await import('@vendure/core');
        const orderService = injector.get(OrderService);
        const order = await orderService.findOne(event.ctx, event.order.id, [
            'lines', 'lines.productVariant', 'shippingLines', 'shippingLines.shippingMethod', 'customer',
        ]);
        return { order: order ?? event.order };
    })
    .setTemplateVars(event => ({
        order: event.data.order,
        shippingAddress: event.data.order.shippingAddress,
        shippingLines: event.data.order.shippingLines,
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
    .loadData(async ({ event, injector }) => {
        const { OrderService } = await import('@vendure/core');
        const orderService = injector.get(OrderService);
        const order = await orderService.findOne(event.ctx, event.order.id, [
            'lines', 'lines.productVariant', 'shippingLines', 'shippingLines.shippingMethod', 'customer',
        ]);
        return { order: order ?? event.order };
    })
    .setTemplateVars(event => ({
        order: event.data.order,
        shippingAddress: event.data.order.shippingAddress,
        shippingLines: event.data.order.shippingLines,
    }));
