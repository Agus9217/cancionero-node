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
    Eres un experto catalogador de música cristiana. Tu única función es buscar y devolver letras EXACTAS y REALES, EXCLUSIVAMENTE del ámbito cristiano.
    El usuario busca la canción con el título: "${title}" y autor: "${author}".
    
    REGLAS ESTRICTAS:
    1. FILTRO DE GÉNERO (CRÍTICO): Antes de buscar, analiza si la canción o el autor pertenecen a la música cristiana, góspel, alabanza o adoración. Si la canción es SECULAR (pop comercial, rock, reggaeton no cristiano, etc.), DEBES rechazarla automáticamente, incluso si te sabes la letra de memoria. En ese caso, ve al punto 6.
    2. NO INVENTES NI COMPONGAS LETRAS. Solo devuelve lo que sepas con certeza que es oficial.
    3. Usa saltos de línea reales (\\n) para separar estrofas y coros.
    4. Si superó el filtro cristiano y estás 100% seguro de la letra, devuelve un JSON así:
       { "type": "exact", "title": "Nombre Real", "author": "Autor Real", "lyrics": "Letra completa..." }
    5. Si superó el filtro cristiano pero hay varias versiones o autores, devuelve hasta 5 opciones:
       { "type": "options", "list": [ {"title": "...", "author": "..."} ] }
    6. Si la canción es SECULAR, o si simplemente no la conoces en absoluto, devuelve estrictamente esto:
       { "type": "not_found" }
       
    Solo devuelve JSON válido, sin texto adicional ni formateo markdown.  
`;
  // Lista de modelos en orden de preferencia (Plan A, Plan B, Plan C)
  const modelosDeRespaldo = [
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash',
  ];

  // Recorremos la lista. Si uno falla por límite, probamos el siguiente.
  for (const modeloActual of modelosDeRespaldo) {
    try {
      console.log(
        `Intentando buscar con: ${modeloActual}...`,
      );

      const response = await ai.models.generateContent({
        model: modeloActual,
        contents: prompt,
        config: {
          temperature: 0,
          tools: [{ googleSearch: {} }],
        },
      });

      let responseText = response.text || '';

      // 1. Quitamos el markdown
      responseText = responseText
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();

      // 2. Filtro Regex de llaves
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        responseText = jsonMatch[0];
      }

      // 3. Parseo seguro
      const parsedData = JSON.parse(responseText);

      if (parsedData.type === 'not_found') {
        return {
          type: 'not_found',
          source: 'gemini',
          data: null,
        };
      }

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

      if (parsedData.type === 'options') {
        return {
          type: 'options',
          source: 'gemini',
          data: parsedData.list.map(
            (item: any, index: number) => ({
              _id: `temp-${index}`,
              title: item.title,
              author: item.author,
            }),
          ),
        };
      }
    } catch (error: any) {
      // Verificamos si el error fue por exceso de peticiones (Rate Limit / Quota)
      const isRateLimit =
        error.status === 429 ||
        error.message?.includes('429') ||
        error.message?.includes('RESOURCE_EXHAUSTED');

      if (isRateLimit) {
        console.warn(
          `⚠️ Límite alcanzado en ${modeloActual}. Cambiando al siguiente...`,
        );
        continue; // Esto le dice al código: "Ignora el error y pasa al siguiente modelo del For"
      } else {
        // Si el error fue por otra cosa (ej. sintaxis, se cayó Google), cortamos todo.
        console.error(
          `Error crítico procesando con ${modeloActual}:`,
          error,
        );
        throw new Error(
          'No se pudo obtener la letra en este momento.',
        );
      }
    }
  }

  // Si el loop intentó con los 3 modelos y los 3 dieron error 429, lanzamos este error final:
  throw new Error(
    'Nuestros servidores están saturados en este momento. Por favor, intenta en un minuto.',
  );
};
