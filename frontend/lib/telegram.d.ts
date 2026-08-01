/**
 * Telegram WebApp SDK global tiplari
 * Telegram ichida ochilganda `window.Telegram.WebApp` mavjud bo'ladi.
 */
export {};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        initDataUnsafe: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
          };
        };
        ready: () => void;
        expand: () => void;
        close: () => void;
        colorScheme: string;
        themeParams: Record<string, string>;
      };
    };
  }
}
