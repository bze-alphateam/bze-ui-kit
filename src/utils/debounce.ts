const debounces: Map<string, NodeJS.Timeout> = new Map();

export async function addMultipleDebounce(name: string, delay: number, callback: () => void, times: number): Promise<void> {
    for (let index = 1; index <= times; index++) {
        addDebounce(`${name}-${index}`, delay * index, callback);
    }
}

export async function addDebounce(name: string, delay: number, callback: () => void): Promise<void> {
    cancelDebounce(name);
    const newTimer = setTimeout(() => {
        callback();
    }, delay);

    debounces.set(name, newTimer);
}

export async function cancelDebounce(name: string): Promise<void> {
    const timer = debounces.get(name);
    if (timer) {
        clearTimeout(timer);
        debounces.delete(name);
    }
}
