import { readFileSync } from 'fs';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';

/**
 * `import text from 'pkg/file?raw'` → the file's content as a string.
 * Used to embed the MapLibre worker so the card stays a single file.
 */
const rawPlugin = () => ({
  name: 'raw',
  async resolveId(source, importer) {
    if (!source.endsWith('?raw')) return null;
    const resolved = await this.resolve(source.slice(0, -4), importer, {
      skipSelf: true,
    });
    return resolved ? `${resolved.id}?raw` : null;
  },
  load(id) {
    if (!id.endsWith('?raw')) return null;
    return `export default ${JSON.stringify(readFileSync(id.slice(0, -4), 'utf8'))};`;
  },
});

export default {
  input: 'src/history-map-card.ts',
  output: {
    file: 'history-map-card.js',
    format: 'es',
    sourcemap: false,
    // Single file for HACS / /config/www — the lazily imported map engine
    // is inlined instead of emitted as a separate chunk.
    inlineDynamicImports: true,
  },
  plugins: [
    rawPlugin(),
    resolve({ browser: true }),
    commonjs(),
    typescript({ tsconfig: './tsconfig.json' }),
  ],
};
