import { Router } from 'express';
import { registerController, loginController } from '../controllers/authController.js';

const router = Router();
router.post('/registrar', registerController);
router.post('/login', loginController);

export default router;
