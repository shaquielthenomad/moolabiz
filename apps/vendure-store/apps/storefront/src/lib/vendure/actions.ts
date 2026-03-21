import {query} from './api';
import {GetActiveCustomerQuery} from './queries';
import {getActiveChannelCached} from './cached';
import {cache} from "react";
import {readFragment} from "@/graphql";
import {ActiveCustomerFragment} from "@/lib/vendure/fragments";
import {getAuthToken} from "@/lib/auth";


export const getActiveCustomer = cache(async () => {
    try {
        const token = await getAuthToken();
        const result = await query(GetActiveCustomerQuery, undefined, {
            token
        });
        return readFragment(ActiveCustomerFragment, result.data.activeCustomer);
    } catch {
        // API unreachable at build time — return null (not logged in)
        return null;
    }
})

export const getActiveChannel = getActiveChannelCached;
