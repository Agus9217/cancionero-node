import { Response, Request } from 'express';
import { buscarletras } from '../service/lyricsService';
// IMPORTANTE: Asegurate de que la ruta al modelo sea la correcta según tus carpetas
import { SongModel } from '../models/Song';

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

// --- NUEVA FUNCIÓN PARA GUARDAR ---
export const guardarCancionManual = async (
  req: Request,
  res: Response,
) => {
  try {
    const { title, author, lyrics, tags } = req.body;

    if (!title || !author || !lyrics) {
      return res
        .status(400)
        .json({
          error:
            'Faltan datos obligatorios (title, author, lyrics)',
        });
    }

    // Evitamos guardar duplicados
    const existe = await SongModel.findOne({
      title: title.toLowerCase(),
      author: author.toLowerCase(),
    });

    if (existe) {
      return res
        .status(400)
        .json({
          error:
            'Esta canción ya existe en tu base de datos',
        });
    }

    const nuevaCancion = new SongModel({
      title,
      author,
      lyrics,
      tags: tags || [],
    });

    await nuevaCancion.save();

    return res
      .status(201)
      .json({
        mensaje: 'Canción guardada con éxito',
        data: nuevaCancion,
      });
  } catch (error) {
    console.error(
      'Error al guardar la canción manualmente:',
      error,
    );
    return res
      .status(500)
      .json({
        error:
          'Ocurrió un error en el servidor al intentar guardar',
      });
  }
};
