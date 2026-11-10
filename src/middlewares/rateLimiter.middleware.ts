import { Request, Response, NextFunction } from 'express';
import { redis } from '@/utils/redis';
import { logger } from '@/utils/winston';

export const rateLimiter = (maxRequests: number, windowInSeconds: number) => {
    return async (req: Request, res: Response, next: NextFunction): Promise<any> => {
        try {
            const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown_ip';
            const key = `ratelimit:${req.baseUrl}${req.path}:${clientIp}`;

            const currentRequests = await redis.incr(key);

            if (currentRequests === 1) {
                await redis.expire(key, windowInSeconds);
            }

            if (currentRequests > maxRequests) {
                const ttl = await redis.ttl(key);
                return res.status(429).json({
                    error: `Demasiadas peticiones. Por favor, reintenta en ${ttl} segundos.`
                });
            }

            next();
        } catch (error) {
            // Si Redis cae por alguna razón, permitimos el flujo normal para no bloquear la app
            logger.error('Fallback RateLimiter Error:', error);
            next();
        }
    };
};