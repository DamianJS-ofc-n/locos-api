import { createApp } from './src/app.js';

const port = Number.parseInt(process.env.PORT ?? '10000', 10);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('PORT debe ser un puerto válido (1-65535).');
  process.exit(1);
}

const server = createApp();
server.listen(port, '0.0.0.0', () => {
  console.log(`Locos API escuchando en 0.0.0.0:${port}`);
});

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.once(signal, () => {
    server.close(() => process.exit(0));
  });
}
