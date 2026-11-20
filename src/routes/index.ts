import { Router } from 'express';
import { login, forgotPassword, resetPassword } from '@/controllers/auth.controller';
import {
  getClients,
  createClient,
  getClientById,
  updateClient,
  updateClientStatus,
} from '@/controllers/client.controller';
import { getLicenses, generateLicense, downloadLicenseFile, revokeLicense } from '@/controllers/license.controller';
import { authenticateJwt } from '@/middlewares/auth.middleware';
import { rateLimiter } from '@/middlewares/rateLimiter.middleware';
import { idempotency } from '@/middlewares/idempotency.middleware';

const router = Router();

router.get('/raiz', (req, res) => {
  res.json({ message: 'API is running' });
});

// ==========================================
// RUTAS PÚBLICAS
// ==========================================
router.post('/auth/login', rateLimiter(5, 15 * 60), login);
router.post('/auth/forgot-password', rateLimiter(3, 60 * 60), forgotPassword);
router.post('/auth/reset-password', rateLimiter(5, 15 * 60), resetPassword);

// ==========================================
// RUTAS PROTEGIDAS
// ==========================================
router.use(authenticateJwt);

/* Rutas de Clientes */
router.get('/clients', getClients);
router.post('/clients', idempotency(3600), createClient);
router.get('/clients/:id', getClientById);
router.put('/clients/:id', updateClient);
router.patch('/clients/:id/status', updateClientStatus);

/* Rutas de Licencias */
router.get('/licenses', getLicenses);
router.post('/licenses/generate', idempotency(86400), generateLicense);
router.get('/licenses/:id/download', downloadLicenseFile);
router.patch('/licenses/:id/revoke', revokeLicense);

export default router;