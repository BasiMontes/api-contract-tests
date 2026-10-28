import { defineConfig } from '@playwright/test';

const port = Number(process.env.PORT ?? 3000);
// Con API_URL se prueba contra un servidor ya levantado (p. ej. otro entorno). Sin ella, Playwright arranca el local.
const baseURL = process.env.API_URL ?? `http://localhost:${port}`;

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL,
  },
  webServer: process.env.API_URL
    ? undefined
    : {
        command: 'npm run server',
        url: `${baseURL}/pistas`,
        reuseExistingServer: !process.env.CI,
        env: { PORT: String(port) },
      },
});
