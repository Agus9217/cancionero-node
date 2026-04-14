import { Router } from 'express';
import { handleChatRequest } from '../controller/chatController';

const router = Router();

router.post('/', handleChatRequest);

export { router as letrasRouter };
