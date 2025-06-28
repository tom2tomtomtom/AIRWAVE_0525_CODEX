// Resource preloading optimization
import Head from 'next/head';

export const ResourcePreloader = ({ children }: { children: React.ReactNode }) => (
  <>
    <Head>
      {/* Preload critical resources */}
      <link rel="preload" href="/_next/static/css/main.css" as="style" />
      <link rel="preload" href="/_next/static/js/main.js" as="script" />

      {/* DNS prefetch for external resources */}
      <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
      <link rel="dns-prefetch" href="https://api.openai.com" />

      {/* Preconnect to critical origins */}
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />

      {/* Resource hints */}
      <link rel="prefetch" href="/api/v2/clients" />
    </Head>
    {children}
  </>
);
