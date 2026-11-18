import { Request, Response } from 'express';
import prisma from '@/utils/prisma';
import { redis } from '@/utils/redis';
import { logger } from '@/utils/winston';
import { CryptoService, LicenseJwtPayload } from '@/services/crypto.service';

const CACHE_TTL = 3600; // 1 hora en segundos

/* Limpieza de cache en Redis para licencias y clientes cruzados */
const invalidateLicensesCache = async (licenseId?: string): Promise<void> => {
    try {
        const prefix = redis.options.keyPrefix || '';

        /* Limpiar cache de licencias */
        const licenseKeys = await redis.keys(prefix ? `${prefix}cache:licenses:*` : 'cache:licenses:*');
        if (licenseKeys.length > 0) {
            const cleanKeys = licenseKeys.map((key) =>
                prefix && key.startsWith(prefix) ? key.slice(prefix.length) : key
            );
            await redis.del(...cleanKeys);
        }

        /* Limpiar cache de clientes por el cambio en _count.licenses */
        const clientKeys = await redis.keys(prefix ? `${prefix}cache:clients:*` : 'cache:clients:*');
        if (clientKeys.length > 0) {
            const cleanKeys = clientKeys.map((key) =>
                prefix && key.startsWith(prefix) ? key.slice(prefix.length) : key
            );
            await redis.del(...cleanKeys);
        }

        if (licenseId) {
            await redis.del(`cache:licenses:${licenseId}`);
        }
    } catch (error) {
        logger.error('Error al invalidar la cache de licencias en Redis:', error);
    }
};

export const getLicenses = async (req: Request, res: Response): Promise<any> => {
    try {
        const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
        const limit = Math.max(1, parseInt(req.query.limit as string, 10) || 10);
        const search = ((req.query.search as string) || '').trim();

        const skip = (page - 1) * limit;
        const cacheKey = `cache:licenses:p${page}:l${limit}:s:${search}`;

        /* 1. Intentar responder desde la cache en Redis */
        const cachedData = await redis.get(cacheKey);
        if (cachedData) {
            return res.json(JSON.parse(cachedData));
        }

        /* 2. Filtro de busqueda */
        const whereClause = search
            ? {
                OR: [
                    { hwid: { contains: search } },
                    { plan: { contains: search } },
                    { client: { name: { contains: search } } },
                ],
            }
            : {};

        /* 3. Consulta transaccional */
        const [totalItems, licenses] = await prisma.$transaction([
            prisma.license.count({ where: whereClause }),
            prisma.license.findMany({
                where: whereClause,
                skip,
                take: limit,
                include: {
                    client: {
                        select: { id: true, name: true, contactEmail: true, taxId: true },
                    },
                },
                orderBy: { createdAt: 'desc' },
            }),
        ]);

        const totalPages = Math.ceil(totalItems / limit) || 1;

        const responsePayload = {
            data: licenses,
            meta: {
                totalItems,
                currentPage: page,
                totalPages,
                limit,
            },
        };

        /* 4. Guardar en Redis */
        await redis.set(cacheKey, JSON.stringify(responsePayload), 'EX', CACHE_TTL);

        return res.json(responsePayload);
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
};

export const generateLicense = async (req: Request, res: Response): Promise<any> => {
    try {
        const {
            clientId,
            hwid,
            planName,
            features,
            cashBoxes,
            expiresAt,
            superAdminMail,
            superAdminPassword,
            miniPcMail,
            miniPcPassword
        } = req.body;

        if (!hwid || typeof hwid !== 'string') {
            return res.status(400).json({ error: 'El Hardware ID (HWID) es obligatorio.' });
        }

        if (!superAdminMail || !superAdminPassword) {
            return res.status(400).json({ error: 'Se requiere superAdminMail y superAdminPassword.' });
        }

        if (!miniPcMail || !miniPcPassword) {
            return res.status(400).json({ error: 'Se requiere miniPcMail y miniPcPassword.' });
        }

        if (superAdminMail === miniPcMail) {
            return res.status(400).json({ error: 'superAdminMail y miniPcMail no pueden ser iguales.' });
        }

        if (!features || !Array.isArray(features)) {
            return res.status(400).json({ error: 'Debes proporcionar un array de features.' });
        }

        const client = await prisma.client.findUnique({ where: { id: clientId } });
        if (!client) {
            return res.status(404).json({ error: 'Cliente especificado no existe.' });
        }

        const formattedCashBoxes =
            cashBoxes && cashBoxes.length > 0
                ? cashBoxes
                : [{ code: 'CASHBOX1', description: 'Caja Principal' }];

        const payload: LicenseJwtPayload = {
            clientName: client.name,
            plan: planName || 'CUSTOM',
            features,
            cashBoxes: formattedCashBoxes,
            cashBoxesCount: formattedCashBoxes.length,
            hwid,
            superAdminMail: superAdminMail || '',
            superAdminPassword: superAdminPassword || '',
            miniPcMail: miniPcMail || '',
            miniPcPassword: miniPcPassword || '',
            expiresAt: new Date(expiresAt).toISOString(),
        };

        /* Firmar el token JWT con RS256 */
        const token = CryptoService.signLicensePayload(payload);

        /* Guardar registro en BD central */
        const license = await prisma.license.create({
            data: {
                clientId: client.id,
                hwid,
                plan: planName || 'CUSTOM',
                features,
                cashBoxes: formattedCashBoxes,
                cashBoxesCount: formattedCashBoxes.length,
                superAdminMail,
                superAdminPassword,
                miniPcMail,
                miniPcPassword,
                expiresAt: new Date(expiresAt),
                signedToken: token,
            },
        });

        /* Limpiar caches afectadas */
        await invalidateLicensesCache();

        return res.status(201).json({
            message: 'Licencia generada con exito',
            licenseId: license.id,
            token,
        });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
};

export const revokeLicense = async (req: Request, res: Response): Promise<any> => {
    try {
        const { id } = req.params;

        const license = await prisma.license.findUnique({ where: { id: String(id) } });
        if (!license) {
            return res.status(404).json({ error: 'Licencia no encontrada.' });
        }

        const updatedLicense = await prisma.license.update({
            where: { id: String(id) },
            data: { status: 'REVOKED' },
        });

        await invalidateLicensesCache(String(id));

        return res.json({ message: 'Licencia revocada con exito.', license: updatedLicense });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
};

export const downloadLicenseFile = async (req: Request, res: Response): Promise<any> => {
    try {
        const { id } = req.params;

        const license = await prisma.license.findUnique({ where: { id: String(id) } });
        if (!license) {
            return res.status(404).json({ error: 'Licencia no encontrada.' });
        }

        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename="license.key"`);
        return res.send(license.signedToken);
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
};