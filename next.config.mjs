/** @type {import('next').NextConfig} */
const useStandaloneOutput = process.env.NEXT_OUTPUT_STANDALONE === 'true';

const nextConfig = {
  output: useStandaloneOutput ? 'standalone' : undefined,
  experimental: {
    serverActions: {
      bodySizeLimit: '500mb',
    },
  },
};

export default nextConfig;
