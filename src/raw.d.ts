/* Files imported with a `?raw` suffix are bundled as plain strings
 * (rollup: see `rawPlugin` in rollup.config.js; vitest supports it natively). */
declare module '*?raw' {
  const content: string;
  export default content;
}
