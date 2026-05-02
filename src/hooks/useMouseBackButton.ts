// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (c) 2024-2026 axpnet — AI-assisted (see AI-TRANSPARENCY.md)

import { useEffect } from 'react';

/**
 * Wire the mouse Back / Forward side buttons (X1 = button 3, X2 = button 4)
 * to two distinct outcomes depending on whether a modal is currently open:
 *
 *   - Modal open  → synthesize an Escape keydown so the topmost dialog
 *                   closes via its existing handler (unchanged behavior;
 *                   stacked-modal correctness is preserved because each
 *                   dialog typically self-removes its listener on close).
 *   - No modal    → dispatch a window-level custom event that the
 *                   AeroFile local panel listens for to walk its own path
 *                   history (mimicking the Back/Forward buttons in the
 *                   OS file manager). If no listener consumes the event
 *                   (user is in DevTools / AeroAgent / etc.) the event
 *                   is silently ignored, which is the desired no-op.
 *
 * Detecting "a modal is open":
 *   - The `modal-open` class on <html> set by 5 dialogs in this codebase.
 *   - Any `[role="dialog"]` or `[aria-modal="true"]` element mounted in
 *     the DOM (54 files use this pattern; dialogs unmount on close).
 *
 * Reference: HTML mouse buttons spec
 *   - event.button === 3 → 4th physical button = "Back"  / "X1"
 *   - event.button === 4 → 5th physical button = "Forward" / "X2"
 *
 * preventDefault on `mousedown` AND `mouseup` is required to suppress
 * the native browser back-history navigation that recent WebKitGTK
 * builds began honoring.
 *
 * Reported by @EhudKirsh (#133, #134).
 */
export function useMouseBackButton(): void {
    useEffect(() => {
        const isAnyModalOpen = (): boolean => {
            if (document.documentElement.classList.contains('modal-open')) return true;
            if (document.querySelector('[role="dialog"], [aria-modal="true"]')) return true;
            return false;
        };

        const swallow = (e: MouseEvent) => {
            if (e.button === 3 || e.button === 4) {
                e.preventDefault();
                e.stopPropagation();
            }
        };
        const onUp = (e: MouseEvent) => {
            if (e.button !== 3 && e.button !== 4) return;
            e.preventDefault();
            e.stopPropagation();
            if (isAnyModalOpen()) {
                // Modal path: synthesize Escape on the focused element so
                // contenteditable / input handlers also see it.
                const target: EventTarget = document.activeElement ?? window;
                target.dispatchEvent(
                    new KeyboardEvent('keydown', {
                        key: 'Escape',
                        code: 'Escape',
                        keyCode: 27,
                        which: 27,
                        bubbles: true,
                        cancelable: true,
                    }),
                );
                return;
            }
            // No-modal path: navigate AeroFile history. Unhandled by
            // listeners outside AeroFile context.
            const eventName = e.button === 3 ? 'aerofile-navigate-back' : 'aerofile-navigate-forward';
            window.dispatchEvent(new CustomEvent(eventName));
        };
        // Capture phase so we win against any inner element that swallows
        // mouseup before bubbling.
        document.addEventListener('mousedown', swallow, true);
        document.addEventListener('mouseup', onUp, true);
        // Some browsers also fire `auxclick` for the side buttons —
        // suppress it too to avoid double-firing on link targets.
        const onAux = (e: MouseEvent) => {
            if (e.button === 3 || e.button === 4) {
                e.preventDefault();
                e.stopPropagation();
            }
        };
        document.addEventListener('auxclick', onAux, true);
        return () => {
            document.removeEventListener('mousedown', swallow, true);
            document.removeEventListener('mouseup', onUp, true);
            document.removeEventListener('auxclick', onAux, true);
        };
    }, []);
}
