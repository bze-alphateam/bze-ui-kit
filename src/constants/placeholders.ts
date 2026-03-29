
export const TOKEN_LOGO_PLACEHOLDER = '/images/token.svg';
export const BZE_CIRCLE_LOGO = '/images/bze_alternative_512x512.png';

// Seeded from NEXT_PUBLIC_APP_NAME so each app automatically gets the right
// memo without needing to call setDefaultTxMemo() explicitly.
// Apps can still override it if needed.
let _defaultTxMemo = process.env.NEXT_PUBLIC_APP_NAME || 'getbze.com';

export const DEFAULT_TX_MEMO = _defaultTxMemo;

export const setDefaultTxMemo = (memo: string) => {
    _defaultTxMemo = memo;
}

export const getDefaultTxMemo = (): string => {
    return _defaultTxMemo;
}
