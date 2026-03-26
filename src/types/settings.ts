// Validation result type
export interface ValidationResult {
    isValid: boolean
    error?: string
}

// BeeZee endpoint configuration
export interface BeeZeeEndpoints {
    restEndpoint: string
    rpcEndpoint: string
}

// Main application settings
export interface AppSettings {
    endpoints: BeeZeeEndpoints
    preferredFeeDenom?: string // User's preferred token for paying fees
}

// Validation results for both endpoints
export interface EndpointValidationResults {
    rest?: ValidationResult
    rpc?: ValidationResult
}

export const CONNECTION_TYPE_WS = 2;
export const CONNECTION_TYPE_POLLING = 1;
export const CONNECTION_TYPE_NONE = 0;

export type ConnectionType = 0 | 1 | 2;
