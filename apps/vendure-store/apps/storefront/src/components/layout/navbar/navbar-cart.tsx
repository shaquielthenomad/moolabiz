import {CartIcon} from './cart-icon';
import {query} from '@/lib/vendure/api';
import {GetActiveOrderQuery} from '@/lib/vendure/queries';

export async function NavbarCart() {
    let cartItemCount = 0;
    try {
        const orderResult = await query(GetActiveOrderQuery, undefined, {
            useAuthToken: true,
            tags: ['cart'],
        });
        cartItemCount = orderResult.data.activeOrder?.totalQuantity || 0;
    } catch {
        // API unreachable at build time — render with empty cart
    }

    return <CartIcon cartItemCount={cartItemCount} />;
}
