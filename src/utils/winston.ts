// logger.js
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

// Configuración de niveles (opcional, pero buena práctica)
const logLevels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 5,
};

// Formato común para ambos transportes
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf((info: any) =>
        `[${info.timestamp}] ${info.level.toUpperCase()}: ${info.message}`
    )
);

// 2. Crea la configuración del transporte de rotación diario
const fileTransport = new DailyRotateFile({
    // Directorio donde se guardarán los logs
    dirname: 'logs',

    // Nombre del archivo base. %DATE% se reemplazará por el datePattern.
    // Esto producirá archivos como '2025-10-20.log'
    filename: '%DATE%.log',

    // Define la frecuencia de la rotación: 'YYYY-MM-DD' asegura una rotación diaria
    datePattern: 'YYYY-MM-DD',

    // Nivel mínimo de logs a registrar en este archivo
    // 'info' incluye 'info', 'warn', y 'error'
    level: 'info',

    // Opcional: comprimir archivos antiguos (buena práctica para ahorrar espacio)
    zippedArchive: false,

    // Opcional: Número máximo de días o archivos a conservar ('14d' = 14 días)
    maxFiles: '14d',

    // Usar el formato de log definido
    format: logFormat
});

// Opcional: Manejador de eventos para el transporte de archivo
fileTransport.on('rotate', (oldFilename: any, newFilename: any) => {
});

// Crea la instancia del logger
export const logger = winston.createLogger({
    levels: logLevels,

    transports: [
        // Transporte A: Consola (para desarrollo y visualización inmediata)
        new winston.transports.Console({
            level: 'debug', // Mostrar todo en consola durante desarrollo
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        }),

        // Transporte B: Archivo con Rotación Diaria (el que tú solicitaste)
        fileTransport
    ]
});