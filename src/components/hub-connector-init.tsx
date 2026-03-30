'use client'

import { useEffect } from "react"
import { initHubConnector } from "@bze/hub-connector"

/**
 * HubConnectorInit — renders nothing, initializes the BZE Hub connector on mount.
 *
 * Add this component to your app's layout alongside <Toaster />.
 * When the app runs inside BZE Hub, it creates a Keplr-compatible wallet bridge.
 * When running in a normal browser, it does nothing.
 *
 * @example
 * ```tsx
 * import { HubConnectorInit, Toaster } from "@bze/bze-ui-kit";
 *
 * export default function RootLayout({ children }) {
 *   return (
 *     <Provider>
 *       {children}
 *       <Toaster />
 *       <HubConnectorInit />
 *     </Provider>
 *   );
 * }
 * ```
 */
export const HubConnectorInit = () => {
    useEffect(() => {
        initHubConnector().catch(() => {})
    }, [])

    return null
}
