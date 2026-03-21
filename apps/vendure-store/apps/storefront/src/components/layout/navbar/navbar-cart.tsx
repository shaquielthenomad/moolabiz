import {CartIcon} from './cart-icon';
import {query} from '@/lib/vendure/api';
import {GetActiveOrderQuery} from '@/lib/vendure/queries';

export async function NavbarCart() {
    const orderResult = await query(GetActiveOrderQuery, undefined, {
        useAuthToken: true,
        tags: ['cart'],
    });

    const cartItemCount = orderResult.data.activeOrder?.totalQuantity || 0;

    return <CartIcon cartItemCount={cartItemCount} />;
}
