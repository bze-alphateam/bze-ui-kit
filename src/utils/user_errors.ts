const errorsMap: { [key: string]: string } = {
    "failed to execute message; message index: 0: amount is smaller than staking reward min stake": "Amount is smaller than minimum required stake",
    "the resulted amount is too low": "Swap minimum amount could not be met. Increase the slippage and try again.",
    "amount is too low to be traded": "Amount is too low to be traded",
    "can not buy more than 50 tickets": "You can only contribute up to 50 times per transaction.",
};

export const prettyError = (err: string|undefined): string|undefined => {
    if (!err) return undefined;

    if (errorsMap[err]) {
        return errorsMap[err];
    }

    for (const [key, value] of Object.entries(errorsMap)) {
        if (err.includes(key)) {
            return value;
        }
    }

    return err;
}
