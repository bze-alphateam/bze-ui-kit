//chart periods
export const CHART_4H = '4H';
export const CHART_1D = '1D';
export const CHART_7D = '7D';
export const CHART_30D = '30D';
export const CHART_1Y = '1Y';

export function getNoOfIntervalsNeeded(chart: string) {
    switch (chart) {
        case CHART_4H:
            return 12 * 4;
        case CHART_1D:
            return 4 * 24;
        case CHART_7D:
            return 24 * 7;
        case CHART_30D:
            return 6 * 30;
        case CHART_1Y:
            return 365;
        default:
            return 0;
    }
}

export function getChartIntervalsLimit(chart: string) {
    switch (chart) {
        case CHART_4H:
            return (12 * 24) * 7;
        case CHART_1D:
            return (4 * 24) * 30;
        case CHART_7D:
            return 24 * 90;
        case CHART_30D:
            return 6 * 365;
        case CHART_1Y:
            return 365 * 3;
        default:
            return 12;
    }
}

export function getChartMinutes(chart: string) {
    switch (chart) {
        case CHART_4H:
            return 5;
        case CHART_1D:
            return 15;
        case CHART_7D:
            return 60;
        case CHART_30D:
            return 240;
        case CHART_1Y:
            return 1440;
        default:
            return 5;
    }
}
