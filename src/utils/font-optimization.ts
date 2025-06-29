// Font optimization
import { Inter, Roboto } from 'next/font/google';

// Optimize Google Fonts
export const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  preload: true,
  variable: '--font-inter' });

export const roboto = Roboto({
  weight: ['300', '400', '500', '700'],
  subsets: ['latin'],
  display: 'swap',
  preload: true,
  variable: '--font-roboto' });

// Font loading optimization
export const optimizeFontLoading = () => {
  if (typeof document !== 'undefined') {
    const linkElem = document.createElement('link');
    linkElem.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap';
    linkElem.rel = 'preload';
    linkElem.as = 'style';
    linkElem.onload = function() { (this as HTMLLinkElement).rel = 'stylesheet'; };
    document.head.appendChild(linkElem);
  }
};
