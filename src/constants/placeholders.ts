
export const TOKEN_LOGO_PLACEHOLDER = '/images/token.svg';
export const BZE_CIRCLE_LOGO = '/images/bze_alternative_512x512.png';

// Apps should override this with their own memo via setDefaultTxMemo()
let _defaultTxMemo = 'getbze.com';

export const DEFAULT_TX_MEMO = _defaultTxMemo;

export const setDefaultTxMemo = (memo: string) => {
    _defaultTxMemo = memo;
}

export const getDefaultTxMemo = (): string => {
    return _defaultTxMemo;
}
