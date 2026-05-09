import { promises as fs } from 'fs';
import path from 'path';

/** @type {import('next').NextConfig} */
const useStandaloneOutput = process.env.NEXT_OUTPUT_STANDALONE === 'true';

const fixServerRuntimePlugin = {
  apply(compiler) {
    compiler.hooks.afterEmit.tapPromise('FixServerRuntimePlugin', async () => {
      const runtimePath = path.join(compiler.options.output.path, 'webpack-runtime.js');
      try {
        let source = await fs.readFile(runtimePath, 'utf8');
        const updated = source.replace(
          'return "" + chunkId + ".js";',
          'return chunkId.startsWith("vendor-chunks/") ? chunkId + ".js" : "chunks/" + chunkId + ".js";'
        );
        if (updated !== source) {
          await fs.writeFile(runtimePath, updated, 'utf8');
        }
      } catch (error) {
        // ignore failures during patching; build may still continue
      }
    });
  },
};

const nextConfig = {
  output: useStandaloneOutput ? 'standalone' : undefined,
  webpack(config, { isServer }) {
    if (isServer) {
      config.plugins.push(fixServerRuntimePlugin);
    }
    return config;
  },
};

export default nextConfig;
