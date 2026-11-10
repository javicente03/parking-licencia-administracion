import { Request, Response, NextFunction } from 'express';
import { redis } from '@/utils/redis';
import { logger } from '@/utils/winston';

export const idempotency = (ttlInSeconds: number = 86400) => { // TTL por defecto: 24 horas
    return async (req: Request, res: Response, next: NextFunction): Promise<any> => {
        const idempotencyKey = req.headers['idempotency-key'] as string;

        // Si la petición POST no incluye el header, la dejamos pasar normalmente (opcional)
        if (!idempotencyKey) {
            return next();
        }

        const redisKey = `idempotency:${idempotencyKey}`;

        try {
            // Intentar adquirir el candado atómico (SET key value NX EX seconds)
            const lockAcquired = await redis.set(redisKey, JSON.stringify({ status: 'PROCESSING' }), 'EX', 30, 'NX');

            if (!lockAcquired) {
                // La clave ya existía: leemos su estado
                const cachedRecord = await redis.get(redisKey);

                if (cachedRecord) {
                    const parsed = JSON.parse(cachedRecord);
                    if (parsed.status === 'PROCESSING') {
                        return res.status(409).json({ error: 'La solicitud se está procesando actualmente. Intenta nuevamente.' });
                    }

                    // Si ya finalizó previamente, respondemos con el resultado cacheado directamente
                    return res.status(parsed.statusCode).json(parsed.body);
                }
            }

            // Interceptamos res.json para capturar la respuesta original y almacenarla en Redis
            const originalJson = res.json.bind(res);

            res.json = (body: any): Response => {
                // Solo almacenamos respuestas exitosas (2xx)
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    redis.set(
                        redisKey,
                        JSON.stringify({ statusCode: res.statusCode, body }),
                        'EX',
                        ttlInSeconds
                    ).catch(err => logger.error('Error guardando Idempotency Key:', err));
                } else {
                    // Si falló el controlador, liberamos el candado para permitir reintentos
                    redis.del(redisKey).catch(err => logger.error('Error liberando Idempotency Key:', err));
                }

                return originalJson(body);
            };

            next();
        } catch (error) {
            logger.error('Error en Middleware de Idempotencia:', error);
            next();
        }
    };
};