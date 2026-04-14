// /src/services/songService.ts (o donde tengas este archivo)

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

  // 2. Si no está en DB, vamos a Gemini
  const prompt = `
    Eres un experto catalogador de música cristiana. Tu única función es devolver letras EXACTAS y REALES.
    El usuario busca la canción con el título: "${title}" y autor: "${author}".
    En lo posible busca en la web la letra original y oficial de esa canción. Si no la encuentras, no inventes ni compongas nada. Solo devuelve lo que sabes con certeza.
    
    REGLAS ESTRICTAS:
    1. NO INVENTES NI COMPONGAS LETRAS. Si no conoces la letra original y oficial de memoria, NO trates de adivinarla.
    2. Usa saltos de línea reales (\\n) para separar estrofas y coros.
    3. Si estás 100% seguro de la canción y su letra, devuelve un JSON así:
       { "type": "exact", "title": "Nombre Real", "author": "Autor Real", "lyrics": "Letra completa..." }
    4. Si hay ambigüedad o solo recuerdas el coro, devuelve hasta 5 opciones:
       { "type": "options", "list": [ {"title": "...", "author": "..."} ] }
    5. Si no conoces la canción en absoluto, devuelve estrictamente esto:
       { "type": "not_found" }
       
    Solo devuelve JSON válido, sin texto adicional ni formateo markdown.  
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        temperature: 0,
        tools: [{ googleSearch: {} }],
      },
    });

    let responseText = response.text || '';
    responseText = responseText
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();
    const parsedData = JSON.parse(responseText);

    if (parsedData.type === 'not_found') {
      return {
        type: 'not_found',
        source: 'gemini',
        data: null,
      };
    }

    // --- EL CAMBIO PRINCIPAL ESTÁ AQUÍ ---
    // 3. Si Gemini encontró la letra exacta, la devolvemos a la App PERO NO LA GUARDAMOS en Mongo
    if (parsedData.type === 'exact') {
      return {
        type: 'exact',
        source: 'gemini',
        data: {
          title: parsedData.title,
          author: parsedData.author,
          lyrics: parsedData.lyrics,
          tags: parsedData.tags || [],
        },
      };
    }

    // 4. Arreglo para que React Native no se queje de las "keys"
    if (parsedData.type === 'options') {
      return {
        type: 'options',
        source: 'gemini',
        // Le inyectamos un _id falso temporal para que React Native pueda armar la lista
        data: parsedData.list.map(
          (item: any, index: number) => ({
            _id: `temp-${index}`,
            title: item.title,
            author: item.author,
          }),
        ),
      };
    }
  } catch (error) {
    console.error('Error procesando con IA:', error);
    throw new Error(
      'No se pudo obtener la letra en este momento.',
    );
  }
};
