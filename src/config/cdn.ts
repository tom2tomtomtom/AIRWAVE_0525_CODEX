// CDN optimization configuration
export const cdnConfig = {
  // Static asset CDN configuration
  assetPrefix: process.env.CDN_URL || '',
  
  // Image CDN optimization
  images: {},
    loader: 'custom',
    loaderFile: './src/utils/image-loader.js',
    domains: [
      'localhost',
      'cdn.example.com',
      process.env.NEXT_PUBLIC_DOMAIN
    ]},
  
  // Edge caching configuration
  edgeConfig: {},
    cacheControl: {},
      static: 'public, max-age=31536000, immutable',
      dynamic: 'public, max-age=60, s-maxage=300',
      api: 'public, max-age=0, s-maxage=60'}
  }
};
