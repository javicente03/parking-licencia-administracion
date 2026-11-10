import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '@/utils/prisma';
import { sendPasswordResetEmail } from '@/services/email.service';
import { config } from '@/utils/config';

export const login = async (req: Request, res: Response): Promise<any> => {
    try {
        const { email, password } = req.body;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const token = jwt.sign(
            { userId: user.id, role: user.role },
            config.JWT_SECRET || 'supersecret_admin_key',
            { expiresIn: '12h' }
        );

        return res.json({
            token,
            user: { id: user.id, email: user.email, name: user.name, role: user.role }
        });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
};

export const forgotPassword = async (req: Request, res: Response): Promise<any> => {
    try {
        const { email } = req.body;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            // Retornar mensaje neutro para evitar la enumeración de usuarios
            return res.json({ message: 'Si el correo existe en el sistema, se ha enviado un enlace de recuperación.' });
        }

        // Generar un token aleatorio seguro
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetPasswordExpires = new Date(Date.now() + 3600000); // 1 hora de vigencia

        await prisma.user.update({
            where: { id: user.id },
            data: {
                resetPasswordToken: resetToken,
                resetPasswordExpires,
            },
        });

        await sendPasswordResetEmail(user.email, resetToken);

        return res.json({ message: 'Si el correo existe en el sistema, se ha enviado un enlace de recuperación.' });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
};

export const resetPassword = async (req: Request, res: Response): Promise<any> => {
    try {
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
            return res.status(400).json({ error: 'Token y nueva contraseña son obligatorios.' });
        }

        const user = await prisma.user.findFirst({
            where: {
                resetPasswordToken: token,
                resetPasswordExpires: {
                    gt: new Date(), // El token no debe haber expirado
                },
            },
        });

        if (!user) {
            return res.status(400).json({ error: 'El enlace de recuperación es inválido o ha expirado.' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await prisma.user.update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                resetPasswordToken: null,
                resetPasswordExpires: null,
            },
        });

        return res.json({ message: 'Contraseña actualizada con éxito. Ya puedes iniciar sesión.' });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
};