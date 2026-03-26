import BigNumber from 'bignumber.js';
import {toBigNumber} from './amount';

export const formatUsdAmount = (priceNum: BigNumber): string => {
    const price = priceNum.toString();
    const decimalIndex = price.indexOf('.');

    if (decimalIndex === -1) {
        return price;
    }

    const decimalPart = price.substring(decimalIndex + 1);
    let significantDigitCount = 0;
    let decimalsFound = 0;

    for (let i = 0; i < decimalPart.length; i++) {
        const digit = decimalPart[i];
        decimalsFound++;

        if (digit !== '0' || significantDigitCount > 0) {
            significantDigitCount++;
        }

        if (significantDigitCount >= 6) {
            break;
        }
    }

    return priceNum.toFixed(decimalsFound).toString();
}

export function shortNumberFormat(amount: BigNumber): string {
    if (amount.isNaN() || amount.isZero()) {
        return '0';
    }

    if (amount.lt(0.001)) {
        return '0';
    }

    const units = [
        { value: new BigNumber('1e15'), suffix: 'Q' },
        { value: new BigNumber('1e12'), suffix: 'T' },
        { value: new BigNumber('1e9'), suffix: 'B' },
        { value: new BigNumber('1e6'), suffix: 'M' },
        { value: new BigNumber('1e3'), suffix: 'K' },
    ];

    for (const unit of units) {
        if (amount.gte(unit.value)) {
            const formatted = amount.div(unit.value);
            const result = formatted.toFixed(3).replace(/\.?0+$/, '');
            return `${result}${unit.suffix}`;
        }
    }

    return amount.toFixed(3).replace(/\.?0+$/, '');
}

export const intlDateFormat = new Intl.DateTimeFormat("en-US", {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
});

export const formatDate = (date: Date): string => {
    return intlDateFormat.format(date);
}

export const formatTimeRemaining = (targetDate: Date): string => {
    const now = new Date();
    const diff = targetDate.getTime() - now.getTime();

    if (diff <= 0) {
        return 'Now';
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);

    return parts.join(' ') || 'Now';
}

export const formatTimeRemainingFromEpochs = (epochs: BigNumber): string => {
    if (epochs.lte(0)) {
        return 'Now';
    }

    const totalSeconds = epochs.multipliedBy(60).toNumber();
    const days = Math.floor(totalSeconds / (60 * 60 * 24));
    const hours = Math.floor((totalSeconds % (60 * 60 * 24)) / (60 * 60));
    const minutes = Math.floor((totalSeconds % (60 * 60)) / 60);

    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);

    return parts.join(' ') || 'Now';
}
