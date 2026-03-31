'use client'

import { useEffect } from "react"
import { initHubConnector, useIsInHub } from "@bze/hub-connector"
import { useTheme } from "next-themes"
import { getStorageKeyVersion } from "../storage/storage"

/**
 * HubConnectorInit — renders nothing, initializes the BZE Hub connector on mount.
 *
 * Add this component to your app's layout alongside <Toaster />.
 * When the app runs inside BZE Hub, it creates a Keplr-compatible wallet bridge
 * and syncs the color mode with the Hub shell.
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
    const { setTheme } = useTheme()
    const inHub = useIsInHub()

    useEffect(() => {
        initHubConnector({ storageKeyVersion: getStorageKeyVersion() }).catch(() => {})
    }, [])

    // Sync color mode from Hub shell to dApp
    useEffect(() => {
        if (!inHub) return

        const handler = (event: Event) => {
            const theme = (event as CustomEvent).detail
            if (theme === "light" || theme === "dark") {
                setTheme(theme)
            }
        }

        window.addEventListener("bze-hub:theme-changed", handler)
        return () => window.removeEventListener("bze-hub:theme-changed", handler)
    }, [setTheme, inHub])

    return null
}
