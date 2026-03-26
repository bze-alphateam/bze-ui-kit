
export async function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export const openExternalLink = (url: string) => {
    if (!window) return;
    window.open(url, '_blank', 'noopener,noreferrer')
}
