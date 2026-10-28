import { createApp } from './app';

const port = Number(process.env.PORT ?? 3000);

const servidor = createApp().listen(port, () => {
  console.log(`API de práctica escuchando en http://localhost:${port}`);
});

// Cierre limpio al recibir señales: así Playwright y las herramientas de cobertura pueden terminar el proceso ordenadamente.
for (const senal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(senal, () => {
    servidor.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1000).unref();
  });
}
