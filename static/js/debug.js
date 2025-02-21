// debug.js
export const DEBUG_MODE = true;

export function debugLog(...messages) {
    if (DEBUG_MODE) console.log(...messages);
}