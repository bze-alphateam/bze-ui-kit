export const getValidatorSupportedDenoms = (): string[] => {
    const denoms = process.env.NEXT_PUBLIC_ATONE_VALIDATOR_SUPPORTED_DENOMS || '';
    return denoms.split(',').map(d => d.trim()).filter(d => d.length > 0);
}

export const getValidatorPageUrl = (): string => {
    return process.env.NEXT_PUBLIC_ATONE_VALIDATOR_PAGE_URL || '';
}

export const isPoolSupportedByValidator = (baseDenom: string, quoteDenom: string): boolean => {
    const supportedDenoms = getValidatorSupportedDenoms();
    return supportedDenoms.includes(baseDenom) || supportedDenoms.includes(quoteDenom);
}
