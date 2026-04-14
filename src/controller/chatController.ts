import { Response, Request } from 'express';
import { buscarletras } from '../service/lyricsService';

export const handleChatRequest = async (
  req: Request,
  res: Response,
) => {
  try {
    const { title, author } = req.body;

    if (!title) {
      return res
        .status(400)
        .json({ error: 'El título es requerido' });
    }

    const resultado = await buscarletras(title, author);

    // Devolvemos el resultado al cliente (APK)
    return res.status(200).json(resultado);
  } catch (error) {
    console.error('Error en el controlador:', error);
    return res
      .status(500)
      .json({ error: 'Error procesando la solicitud' });
  }
};
