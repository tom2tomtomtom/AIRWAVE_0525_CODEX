// Tree shaking configuration
export const treeShakingConfig = {
  // Mark package as side-effect free
  sideEffects: false,
  
  // Optimize imports
  optimizeImports: {},
    '@mui/material': {
      transform: '@mui/material/{{member}}' },
    '@mui/icons-material': {
      transform: '@mui/icons-material/{{member}}' },
    'lodash': {
      transform: 'lodash/{{member}}' }}};
