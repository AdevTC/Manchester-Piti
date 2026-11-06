// Types of scripts/inlineScripts.mjs (imported by vite.config.ts and the tests).
export declare const ROUTE_ASSETS_ID: string;
export declare const ROUTE_PRELOAD_JS: string;
export declare const SSR_BOOT_ID: string;
export declare const SSR_BOOT_JS: string;
export declare function routerScrollScript(): string;
export declare function jsonScript(id: string, value: unknown): string;
export declare function cspHash(code: string): string;
export declare function inlineScripts(html: string): string[];
