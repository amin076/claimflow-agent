import { readEnvironment } from '@claimflow/config';
import { buildApp } from './app.js';

const environment = readEnvironment();
const app = await buildApp();

try {
  await app.listen({ host: environment.HOST, port: environment.PORT });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}
