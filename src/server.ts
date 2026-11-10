import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import routes from '@/routes';
import { redis } from '@/utils/redis';
import { config } from '@/utils/config';
import { logger } from '@/utils/winston';

dotenv.config();

const app = express();
const PORT = config.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', routes);

const server = app.listen(PORT, () => {
  logger.info(`Servidor corriendo en http://localhost:${PORT}`);
});

// Graceful Shutdown
const gracefulShutdown = async () => {
  logger.info('Cerrando servidor y conexiones...');
  server.close(async () => {
    await redis.quit();
    logger.info('Servidor cerrado. Saliendo del proceso...');
    process.exit(0);
  });
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);