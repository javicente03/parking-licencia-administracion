export const config = {
    PORT: process.env.PORT,
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_SECRET: process.env.JWT_SECRET || 'ClaveSuperSeguraParaElLoginDelPanelAdmin',
    PRIVATE_KEY_PATH: process.env.PRIVATE_KEY_PATH,

    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : undefined,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS,
    SMTP_FROM: process.env.SMTP_FROM,

    FRONTEND_URL: process.env.FRONTEND_URL,

    REDIS_HOST: process.env.REDIS_HOST,
    REDIS_PORT: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : undefined,
    REDIS_PASSWORD: process.env.REDIS_PASSWORD,
    REDIS_KEY_PREFIX: process.env.REDIS_KEY_PREFIX,
};