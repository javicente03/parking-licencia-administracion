import { config } from '@/utils/config';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    host: config.SMTP_HOST || 'smtp.gmail.com',
    port: config.SMTP_PORT || 587,
    secure: config.SMTP_PORT === 465, // true para puerto 465, false para otros
    auth: {
        user: config.SMTP_USER,
        pass: config.SMTP_PASS,
    },
});

export const sendPasswordResetEmail = async (toEmail: string, resetToken: string): Promise<void> => {
    const resetUrl = `${config.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

    const mailOptions = {
        from: config.SMTP_FROM || '"Licencias Parking" <no-reply@ejesoft.cl>',
        to: toEmail,
        subject: 'Restablecimiento de Contraseña - Gestor de Licencias',
        html: `
            <div style="font-family: Arial, sans-serif; background-color: #0f172a; color: #f8fafc; padding: 30px; border-radius: 10px; max-width: 500px; margin: 0 auto;">
                <h2 style="color: #38bdf8; text-align: center;">Recuperación de Contraseña</h2>
                <p>Has solicitado restablecer tu contraseña de acceso al Panel de Administración de Licencias.</p>
                <p>Haz clic en el siguiente botón para establecer una nueva contraseña. Este enlace expira en 1 hora:</p>
                <div style="text-align: center; margin: 30px 0;">
                <a href="${resetUrl}" style="background-color: #0284c7; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                    Restablecer Contraseña
                </a>
                </div>
                <p style="font-size: 12px; color: #94a3b8;">Si no solicitaste este cambio, puedes ignorar este correo de manera segura.</p>
            </div>
        `,
    };

    await transporter.sendMail(mailOptions);
};