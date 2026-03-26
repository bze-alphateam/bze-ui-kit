
export function stringTruncateFromCenter(str: string, maxLength: number) {
    const midChar = '\u2026'; // character to insert into the center of the result

    if (str.length <= maxLength) return str;

    // length of beginning part
    const left = Math.ceil(maxLength / 2);

    // start index of ending part
    const right = str.length - Math.floor(maxLength / 2) + 1;

    return str.substring(0, left) + midChar + str.substring(right);
}

export function removeLeadingZeros(str: string): string {
    return str.replace(/^0+/, '') || '0';
}
