'use client'

import { Button } from "@chakra-ui/react"
import { LuSettings } from "react-icons/lu"
import { Sidebar } from "./sidebar/sidebar"
import { SettingsSidebarContent } from "./sidebar/settings-sidebar"

interface SettingsToggleProps {
    accentColor?: string
}

export function SettingsToggle({ accentColor }: SettingsToggleProps) {
    return (
        <Sidebar
            ariaLabel="Settings"
            trigger={
                <Button variant="subtle" size={{ base: 'sm', md: 'md' }}>
                    <LuSettings />
                </Button>
            }
        >
            <SettingsSidebarContent accentColor={accentColor} />
        </Sidebar>
    )
}
