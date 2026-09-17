/**
 * Telegram WebApp SDK global tiplari
 * Telegram ichida ochilganda `window.Telegram.WebApp` mavjud bo'ladi.
 *
 * DIQQAT: bu obyekt o'z-o'zidan paydo bo'lmaydi — `telegram-web-app.js`
 * skripti `app/layout.tsx` da yuklanadi. Skriptsiz `window.Telegram`
 * undefined bo'ladi va Telegram orqali kirish ham, oynani kengaytirish ham
 * ishlamaydi.
 *
 * Eski klientlarda ba'zi metodlar yo'q, shuning uchun yangilari ixtiyoriy
 * (`?:`) qilib belgilangan — chaqirishdan oldin mavjudligini tekshiring.
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

        /** Ilovaga ajratilgan joriy balandlik (px) */
        viewportHeight?: number;
        /** Klaviatura/animatsiyalardan xoli barqaror balandlik (px) */
        viewportStableHeight?: number;
        isExpanded?: boolean;
        platform?: string;
        version?: string;

        onEvent?: (event: string, handler: () => void) => void;
        offEvent?: (event: string, handler: () => void) => void;

        /** Bot API 6.9+ — HEX rang qabul qiladi */
        setBackgroundColor?: (color: string) => void;
        setHeaderColor?: (color: string) => void;
        /** Bot API 7.7+ — pastga tortganda ilova yopilmasligi uchun */
        disableVerticalSwipes?: () => void;
      };
    };
  }
}
