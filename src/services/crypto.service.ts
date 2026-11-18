import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { config } from '@/utils/config';

export interface LicenseJwtPayload {
    clientName: string;
    plan: string; // Ahora es un string libre
    features: string[]; // Array dinámico inyectado desde el controlador
    cashBoxes: { code: string; description: string }[];
    cashBoxesCount: number;
    hwid: string;
    superAdminMail?: string;
    superAdminPassword?: string;
    miniPcMail?: string;
    miniPcPassword?: string;
    expiresAt: string;
}

export class CryptoService {
    private static privateKey: string;

    private static getPrivateKey(): string {
        if (!this.privateKey) {
            const keyPath = config.PRIVATE_KEY_PATH || path.join(process.cwd(), 'keys', 'private.key');
            if (!fs.existsSync(keyPath)) {
                throw new Error(`No se encontró la clave privada en la ruta: ${keyPath}`);
            }
            this.privateKey = fs.readFileSync(keyPath, 'utf8');
        }
        return this.privateKey;
    }

    static signLicensePayload(payload: LicenseJwtPayload): string {
        const privateKey = this.getPrivateKey();
        return jwt.sign(payload, privateKey, { algorithm: 'RS256' });
    }
}