
export async function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export const openExternalLink = (url: string) => {
    if (typeof window === 'undefined') return;

    // In BZE Hub: request the shell to open in system browser
    if (window.parent !== window) {
        try {
            window.parent.postMessage({
                type: "bze-hub:open-url",
                url,
            }, "*");
            return;
        } catch {
            // Fall through to normal open
        }
    }

    window.open(url, '_blank', 'noopener,noreferrer')
}
