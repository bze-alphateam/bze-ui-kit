import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  splitting: false,
  sourcemap: true,
  external: [
    'react',
    'react-dom',
    '@bze/bzejs',
    '@chakra-ui/react',
    '@interchain-kit/core',
    '@interchain-kit/react',
    '@interchainjs/cosmos',
    '@interchainjs/encoding',
    '@chain-registry/types',
    '@chain-registry/utils',
    '@chain-registry/v2',
    '@chain-registry/v2-types',
    'bignumber.js',
    'chain-registry',
    'next-themes',
    'react-icons',
  ],
})
