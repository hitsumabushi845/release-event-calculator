import { PUBLIC_GA_MEASUREMENT_ID } from '$env/static/public';

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

let initialized = false;

export function initGa(): void {
  if (initialized) return;
  if (!PUBLIC_GA_MEASUREMENT_ID) return;
  if (typeof window === 'undefined') return;

  const id = PUBLIC_GA_MEASUREMENT_ID;
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', id, { anonymize_ip: true });
  initialized = true;
}

export function trackEvent(name: string, params: Record<string, unknown> = {}): void {
  if (typeof window === 'undefined') return;
  if (!window.gtag) return;
  window.gtag('event', name, params);
}
