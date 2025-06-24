import * as React from 'react';
import Document, {
  Html,
  Head,
  Main,
  NextScript,
  DocumentContext,
  DocumentInitialProps} from 'next/document';
import createEmotionServer from '@emotion/server/create-instance';
import { AppType } from 'next/app';
import { lightTheme } from '@/styles/theme';
import createEmotionCache from '@/lib/createEmotionCache';
import { MyAppProps } from './_app';

interface MyDocumentProps extends DocumentInitialProps {
  emotionStyleTags: JSX.Element[];
}

export default class MyDocument extends Document<MyDocumentProps> {
  render() {
    return (
      <Html lang="en">
        <Head>
          {/* PWA primary color */}
          <meta name="theme-color" content={lightTheme.palette.primary.main} />
          <link rel="shortcut icon" href="/favicon.ico" />

          {/* Using system fonts only - no external font loading for performance */}

          {/* Emotion insertion point */}
          <meta name="emotion-insertion-point" content="" />

          {/* Inject MUI styles */}
          {this.props.emotionStyleTags}
        </Head>
        <body>
          {/* Prevent theme flash by setting initial theme before render */}
          <script
            dangerouslySetInnerHTML={{
              __html: `
                (function() {
                  function getInitialTheme() {
                    try {
                      const persistedTheme = localStorage.getItem('themeMode');
                      if (persistedTheme) {
                        return persistedTheme;
                      }
                      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                    } catch (e: any) {
                      return 'light';
                    }
                  }
                  
                  const theme = getInitialTheme();
                  document.documentElement.setAttribute('data-mui-color-scheme', theme);
                  document.documentElement.style.colorScheme = theme;
                })();
              `}}
          />
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}

// `getInitialProps` belongs to `_document` (instead of `_app`),
// it's compatible with static-site generation (SSG).
MyDocument.getInitialProps = async (ctx: DocumentContext): Promise<MyDocumentProps> => {
  const originalRenderPage = ctx.renderPage;

  // You can consider sharing the same Emotion cache between all the SSR requests to speed up performance.
  // However, be aware that it can have global side effects.
  const cache = createEmotionCache();
  const { extractCriticalToChunks } = createEmotionServer(cache);

  ctx.renderPage = () =>
    originalRenderPage({
      enhanceApp: (App: React.ComponentType<React.ComponentProps<AppType> & MyAppProps>) =>
        function EnhanceApp(props: any) {
          return <App emotionCache={cache} {...props} />;
        }});

  const initialProps = await Document.getInitialProps(ctx);
  // This is important. It prevents Emotion to render invalid HTML.
  // See https://github.com/mui/material-ui/issues/26561#issuecomment-855286153
  const emotionStyles = extractCriticalToChunks(initialProps.html);
  const emotionStyleTags = emotionStyles.styles.map((style: any) => (
    <style
      data-emotion={`${style.key} ${style.ids.join(' ')}`}
      key={style.key}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: style.css }}
    />
  ));

  return {
    ...initialProps,
    emotionStyleTags};
};
