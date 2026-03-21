'use client';

interface PriceProps {
    value: number;
    currencyCode?: string;
}

export function Price({value, currencyCode = 'ZAR'}: PriceProps) {
    return (
        <>
            {new Intl.NumberFormat('en-ZA', {
                style: 'currency',
                currency: currencyCode,
            }).format(value / 100)}
        </>
    );
}
