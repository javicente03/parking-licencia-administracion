import Redis from 'ioredis';
import { config } from '@/utils/config';
import { logger } from '@/utils/winston';

const redisHost = config.REDIS_HOST || '127.0.0.1';
const redisPort = config.REDIS_PORT || 6379;
const redisPassword = config.REDIS_PASSWORD || undefined;
const keyPrefix = config.REDIS_KEY_PREFIX;

export const redis = new Redis({
    host: redisHost,
    port: redisPort,
    password: redisPassword,
    keyPrefix: keyPrefix,
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
        const delay = Math.min(times * 100, 3000);
        return delay;
    },
});

redis.on('connect', () => {
    logger.info('Conexión exitosa a Redis Server');
});

redis.on('error', (err) => {
    logger.error(`Error en conexión Redis: ${err.message}`);
});