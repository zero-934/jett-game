import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages serves from /jett-game/ — this sets the base path correctly.
  // If you ever move to a custom domain (jett.game), change this to '/'.
  base: '/jett-game/',
});
