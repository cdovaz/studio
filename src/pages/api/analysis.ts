
import type { NextApiRequest, NextApiResponse } from 'next';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

type ApiResponse = {
  success: boolean;
  message?: string;
  analysis?: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse<ApiResponse>) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Método não permitido. Use POST.' });
  }
  if (!GEMINI_API_KEY) {
    console.error('A chave da API do Gemini não foi encontrada nas variáveis de ambiente.');
    return res.status(500).json({ success: false, message: 'Erro de configuração no servidor: Chave da API ausente.' });
  }

  try {
    const { address, indicators } = req.body;
    if (!address || !indicators || !Array.isArray(indicators) || indicators.length === 0) {
      return res.status(400).json({ success: false, message: 'Os parâmetros "address" e "indicators" (como uma lista) são obrigatórios.' });
    }

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });

    const prompt = `
      Atue como um urbanista e analista de geodados.
      Sua tarefa é elaborar um plano de projeto de urbanismo preliminar para a seguinte localização: ${address}.
      
      A análise deve ser focada nos seguintes indicadores-chave selecionados:
      - ${indicators.join('\n- ')}

      O plano deve ser estruturado em seções claras e concisas. Apresente um texto corrido, sem usar markdown como quebras de linha extras, listas ou tabelas, apenas parágrafos.
      Comece com um parágrafo introdutório sobre o potencial da área. 
      Em seguida, para cada indicador selecionado, escreva um parágrafo detalhando os desafios e oportunidades específicas.
      Finalize com um parágrafo de conclusão, resumindo as recomendações e os próximos passos sugeridos para um estudo aprofundado.

      Seja profissional, técnico e criativo em suas sugestões.
    `;

    const generationConfig = {
      temperature: 0.6,
      topK: 1,
      topP: 1,
      maxOutputTokens: 2048,
    };
    
    const safetySettings = [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    ];

    const result = await model.generateContent({ contents: [{ role: "user", parts: [{text: prompt}] }], generationConfig, safetySettings });
    const response = result.response;

    if (response.promptFeedback?.blockReason) {
        const blockReason = response.promptFeedback.blockReason;
        console.error(`Análise bloqueada pela IA. Motivo: ${blockReason}`);
        return res.status(500).json({ success: false, message: `A IA bloqueou a geração do conteúdo. Motivo: ${blockReason}.` });
    }

    if (!response.text) {
        return res.status(500).json({ success: false, message: "A IA não retornou um texto. A resposta pode ter sido bloqueada ou finalizada sem conteúdo." });
    }
    
    const analysisText = response.text();
    return res.status(200).json({ success: true, analysis: analysisText });

  } catch (error) {
    console.error('[GEMINI_API_ERROR]:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido.';
    return res.status(500).json({ 
        success: false, 
        message: `Erro ao chamar a API do Gemini: ${errorMessage}` 
    });
  }
}
