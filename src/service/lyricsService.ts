import { SongModel } from '../models/Song';
import { ai } from '../config/gemini';

export const buscarletras = async (
  title: string,
  author: string,
) => {
  // 1. Buscamos en la base de datos local
  const dbResult = await SongModel.find({
    title: { $regex: title, $options: 'i' },
    ...(author && {
      author: { $regex: author, $options: 'i' },
    }),
  });

  // 2. Si hay resultados en la DB, retornamos de inmediato
  if (dbResult.length === 1) {
    return {
      type: 'exact',
      source: 'db',
      data: dbResult[0],
    };
  } else if (dbResult.length > 1) {
    return {
      type: 'options',
      source: 'db',
      data: dbResult,
    };
  }

  // 3. Si llegamos hasta aquí, dbResult.length === 0.
  // No está en tu MongoDB. Toca pedir ayuda a Gemini.
  const prompt = `
    Eres un experto catalogador de música cristiana. Tu única función es devolver letras EXACTAS y REALES.
    El usuario busca la canción con el título: "${title}" y autor: "${author}".
En lo posible busca en la web la letra original y oficial de esa canción. Si no la encuentras, no inventes ni compongas nada. Solo devuelve lo que sabes con certeza.
    
    REGLAS ESTRICTAS:
    1. NO INVENTES NI COMPONGAS LETRAS. Si no conoces la letra original y oficial de memoria, NO trates de adivinarla.
    2. Usa saltos de línea reales (\\n) para separar estrofas y coros.
    3. Si estás 100% seguro de la canción y su letra, devuelve un JSON así:
       { "type": "exact", "title": "Nombre Real", "author": "Autor Real", "lyrics": "Letra completa..." }
    4. Si hay ambigüedad (ej. existen varias canciones llamadas igual) o solo recuerdas el coro, devuelve hasta 5 opciones:
       { "type": "options", "list": [ {"title": "...", "author": "...", "lyrics": "Letra completa..."} ] }
    5. Si no conoces la canción en absoluto, devuelve estrictamente esto:
       { "type": "not_found" }
       
    Solo devuelve JSON válido, sin texto adicional ni formateo markdown.  `;

  try {
    // Llamamos a la API con el nuevo SDK
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash', // Subimos de nivel el modelo
      contents: prompt,
      config: {
        temperature: 0, // 0 = Cero creatividad, 100% factual y robótico
        tools: [{ googleSearch: {} }], // <-- LA MAGIA: Le damos acceso a internet en tiempo real
      },
    });

    // Obtenemos el texto de la respuesta
    let responseText = response.text || '';

    // TRUCO VITAL: A veces la IA se hace la lista y envuelve el JSON en ```json ... ```
    // Esta línea limpia cualquier formateo markdown para que JSON.parse no explote.
    responseText = responseText
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    // Parseamos el string a un objeto JavaScript real
    const parsedData = JSON.parse(responseText);

    if (parsedData.type === 'not_found') {
      return {
        type: 'not_found',
        source: 'gemini',
        data: null,
      };
    }

    // 4. Si Gemini encontró la letra exacta, la guardamos en tu MongoDB para la próxima!
    if (parsedData.type === 'exact') {
      const nuevaCancion = new SongModel({
        title: parsedData.title,
        author: parsedData.author,
        lyrics: parsedData.lyrics,
        tags: parsedData.tags || [],
      });
      await nuevaCancion.save();

      return {
        type: 'exact',
        source: 'gemini',
        data: nuevaCancion,
      };
    }

    // 5. Si Gemini devolvió varias opciones, se las pasamos a la App móvil
    if (parsedData.type === 'options') {
      return {
        type: 'options',
        source: 'gemini',
        data: parsedData.list,
      };
    }
  } catch (error) {
    console.error('Error procesando con IA:', error);
    // Lanzamos el error para que el Controlador (Express) devuelva un status 500
    throw new Error(
      'No se pudo obtener la letra en este momento.',
    );
  }
};
