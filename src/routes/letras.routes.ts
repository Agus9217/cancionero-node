import { Router } from 'express';
// Agregamos la importación de la nueva función
import {
  handleChatRequest,
  guardarCancionManual,
} from '../controller/chatController';

const router = Router();

// 1. Esta es tu ruta original.
// Responde a: POST /api/letras
router.post('/', handleChatRequest);

// 2. NUEVA RUTA: Para guardar manualmente.
// Responde a: POST /api/letras/guardar
router.post('/guardar', guardarCancionManual);

export { router as letrasRouter };
