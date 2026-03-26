'use client';

import {createContext} from 'react';
import {Asset} from '../types/asset';
import {Market, MarketData} from '../types/market';
import {Balance} from '../types/balance';
import {LiquidityPoolSDKType} from '@bze/bzejs/bze/tradebin/store';
import {LiquidityPoolData} from '../types/liquidity_pool';
import {EpochInfoSDKType} from '@bze/bzejs/bze/epochs/epoch';
import {ConnectionType} from '../types/settings';
import {IBCData} from '../types/asset';
import BigNumber from 'bignumber.js';

export interface AssetsContextType {
    assetsMap: Map<string, Asset>;
    updateAssets: () => Promise<Map<string, Asset>>;

    marketsMap: Map<string, Market>;
    updateMarkets: () => void;

    marketsDataMap: Map<string, MarketData>;
    updateMarketsData: () => Promise<Map<string, MarketData>>;

    poolsMap: Map<string, LiquidityPoolSDKType>;
    poolsDataMap: Map<string, LiquidityPoolData>;
    updateLiquidityPools: () => Promise<void>;

    balancesMap: Map<string, Balance>;
    updateBalances: () => void;

    usdPricesMap: Map<string, BigNumber>;

    isLoading: boolean;
    isLoadingPrices: boolean;

    ibcChains: IBCData[];

    epochs: Map<string, EpochInfoSDKType>;
    updateEpochs: () => void;

    connectionType: ConnectionType;
    updateConnectionType: (conn: ConnectionType) => void;
}

export const AssetsContext = createContext<AssetsContextType | undefined>(undefined);
