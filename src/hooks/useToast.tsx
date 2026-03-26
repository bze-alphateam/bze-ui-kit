'use client';

import { useCallback, useMemo } from 'react';
import { toaster } from '../components/toaster';

export const useToast = () => {
    const clickableSuccess = useCallback((title: string, actionFn: () => void, actionLabel?: string, description?: string, duration = 5000) => {
        toaster.create({
            title,
            description,
            type: 'success',
            duration,
            closable: true,
            action: {
                label: actionLabel ?? '',
                onClick: actionFn,
            }
        });
    }, []);

    const success = useCallback((title: string, description?: string, duration = 5000) => {
        toaster.create({
            title,
            description,
            type: 'success',
            duration,
            closable: true,
        });
    }, []);

    const error = useCallback((title: string, description?: string, duration = 8000) => {
        toaster.create({
            title,
            description,
            type: 'error',
            duration,
            closable: true,
        });
    }, []);

    const warning = useCallback((title: string, description?: string, duration = 6000) => {
        toaster.create({
            title,
            description,
            type: 'warning',
            duration,
            closable: true,
        });
    }, []);

    const info = useCallback((title: string, description?: string, duration = 5000) => {
        toaster.create({
            title,
            description,
            type: 'info',
            duration,
            closable: true,
        });
    }, []);

    const loading = useCallback((title: string, description?: string) => {
        return toaster.create({
            title,
            description,
            type: 'loading',
            closable: false,
        });
    }, []);

    const dismiss = useCallback((id: string) => {
        toaster.dismiss(id);
    }, []);

    const toast = useMemo(() => ({
        clickableSuccess,
        success,
        error,
        warning,
        info,
        loading,
        dismiss,
    }), [clickableSuccess, success, error, warning, info, loading, dismiss]);

    return { toast };
};
