import { createApp } from './app';

const port = Number(process.env.PORT ?? 3000);

createApp().listen(port, () => {
  console.log(`API de práctica escuchando en http://localhost:${port}`);
});
