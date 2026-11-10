import { Request, Response } from 'express';
import prisma from '@/utils/prisma';
import { redis } from '@/utils/redis';
import { logger } from '@/utils/winston';

const CACHE_TTL = 3600; // 1 hora en segundos

/* Limpieza de cache en Redis para listados y registros individuales */
const invalidateClientsCache = async (clientId?: string): Promise<void> => {
    try {
        const prefix = redis.options.keyPrefix || '';

        /* 1. Incluir el prefijo en el patron de busqueda para que Redis encuentre las claves reales */
        const searchPattern = prefix ? `${prefix}cache:clients:*` : 'cache:clients:*';
        const keys = await redis.keys(searchPattern);
        logger.info(`Prefijo de claves en Redis: ${prefix}`);

        logger.info(`Claves de caché de clientes encontradas en Redis: ${keys.length}`);

        if (keys.length > 0) {
            /* 2. Remover el prefijo de cada clave obtenida para pasarselas a ioredis.del() */
            const cleanKeys = keys.map((key) =>
                prefix && key.startsWith(prefix) ? key.slice(prefix.length) : key
            );

            /* 3. ioredis volvera a anadir el keyPrefix a cada clave enviada en del() */
            const deletedCount = await redis.del(...cleanKeys);
            logger.info(`Caché de clientes invalidada en Redis. Claves eliminadas: ${deletedCount}`);
        }

        if (clientId) {
            await redis.del(`cache:clients:${clientId}`);
        }
    } catch (error) {
        logger.error('Error al invalidar la caché de clientes en Redis:', error);
    }
};

export const getClients = async (req: Request, res: Response): Promise<any> => {
    try {
        const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
        const limit = Math.max(1, parseInt(req.query.limit as string, 10) || 10);
        const search = ((req.query.search as string) || '').trim();

        const skip = (page - 1) * limit;
        const cacheKey = `cache:clients:p${page}:l${limit}:s:${search}`;

        /* 1. Intentar responder desde la cache de Redis */
        const cachedData = await redis.get(cacheKey);
        if (cachedData) {
            return res.json(JSON.parse(cachedData));
        }

        /* 2. Filtro de busqueda */
        const whereClause = search
            ? {
                OR: [
                    { name: { contains: search } },
                    { taxId: { contains: search } },
                    { contactEmail: { contains: search } },
                ],
            }
            : {};

        /* 3. Consulta transaccional */
        const [totalItems, clients] = await prisma.$transaction([
            prisma.client.count({ where: whereClause }),
            prisma.client.findMany({
                where: whereClause,
                skip,
                take: limit,
                include: {
                    _count: { select: { licenses: true } },
                    licenses: {
                        select: { id: true, plan: true, hwid: true, expiresAt: true, status: true },
                    },
                },
                orderBy: { createdAt: 'desc' },
            }),
        ]);

        const totalPages = Math.ceil(totalItems / limit) || 1;

        const responsePayload = {
            data: clients,
            meta: {
                totalItems,
                currentPage: page,
                totalPages,
                limit,
            },
        };

        /* 4. Cachear en Redis */
        await redis.set(cacheKey, JSON.stringify(responsePayload), 'EX', CACHE_TTL);

        return res.json(responsePayload);
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
};

export const getClientById = async (req: Request, res: Response): Promise<any> => {
    try {
        const { id } = req.params;
        const cacheKey = `cache:clients:${id}`;

        const cachedClient = await redis.get(cacheKey);
        if (cachedClient) {
            return res.json(JSON.parse(cachedClient));
        }

        const client = await prisma.client.findUnique({
            where: { id: String(id) },
            include: { licenses: true },
        });

        if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });

        await redis.set(cacheKey, JSON.stringify(client), 'EX', CACHE_TTL);
        return res.json(client);
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
};

export const createClient = async (req: Request, res: Response): Promise<any> => {
    try {
        const { name, taxId, contactEmail, contactPhone, address } = req.body;

        const client = await prisma.client.create({
            data: { name, taxId, contactEmail, contactPhone, address },
        });

        await invalidateClientsCache();

        return res.status(201).json(client);
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
};

export const updateClient = async (req: Request, res: Response): Promise<any> => {
    try {
        const { id } = req.params;
        const { name, taxId, contactEmail, contactPhone, address, isActive } = req.body;

        const existingClient = await prisma.client.findUnique({ where: { id: String(id) } });
        if (!existingClient) {
            return res.status(404).json({ error: 'Cliente no encontrado' });
        }

        const updatedClient = await prisma.client.update({
            where: { id: String(id) },
            data: { name, taxId, contactEmail, contactPhone, address, isActive },
        });

        await invalidateClientsCache(String(id));

        return res.json(updatedClient);
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
};

export const updateClientStatus = async (req: Request, res: Response): Promise<any> => {
    try {
        const { id } = req.params;
        const { isActive } = req.body;

        if (typeof isActive !== 'boolean') {
            return res.status(400).json({ error: 'El campo isActive es obligatorio y debe ser un booleano.' });
        }

        const updatedClient = await prisma.client.update({
            where: { id: String(id) },
            data: { isActive },
        });

        await invalidateClientsCache(String(id));

        return res.json(updatedClient);
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
};