
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
    return res.status(405).json({ success: false, message: 'Method not allowed. Use POST.' });
  }
  if (!GEMINI_API_KEY) {
    console.error('Gemini API key not found in environment variables.');
    return res.status(500).json({ success: false, message: 'Server configuration error: API key is missing.' });
  }

  try {
    const { address, indicators } = req.body;
    if (!address || !indicators || !Array.isArray(indicators) || indicators.length === 0) {
      return res.status(400).json({ success: false, message: 'The "address" and "indicators" (as a list) parameters are required.' });
    }

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });

    const prompt = `
      Act as an urban planner and geodata analyst.
      Your task is to draft a preliminary urban design project plan for the following location: ${address}.
      
      The analysis should focus on the following selected key indicators:
      - ${indicators.join('\n- ')}

      The plan must be structured in clear and concise sections. Present it as continuous text, without using markdown like extra line breaks, lists, or tables, only paragraphs.
      Start with an introductory paragraph about the area's potential. 
      Create an short, medium and long deadline projects for each parte o the plan
      Then, for each selected indicator, write a paragraph detailing the specific challenges and opportunities.
      Conclude with a summary paragraph, outlining the recommendations and suggested next steps for a detailed study.

      Be professional, technical, and creative in your suggestions.
    `;

    const generationConfig = {
      temperature: 0.6,
      topK: 1,
      topP: 1,
      maxOutputTokens: 2400,
    };
    
    const safetySettings = [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    ];

    const result = await model.generateContent({ contents: [{ role: "user", parts: [{text: prompt}] }], generationConfig, safetySettings });
    const response = result.response;

    // LOG: Adicionando logs para depuração
    console.log("--- [GEMINI API RESPONSE] ---");
    console.log(JSON.stringify(response, null, 2));
    console.log("-----------------------------");

    if (response.promptFeedback?.blockReason) {
        const blockReason = response.promptFeedback.blockReason;
        console.error(`AI analysis blocked. Reason: ${blockReason}`);
        return res.status(500).json({ success: false, message: `The AI blocked content generation. Reason: ${blockReason}.` });
    }

    const analysisText = response.text();
    console.log("--- [EXTRACTED TEXT] ---");
    console.log(analysisText);
    console.log("------------------------");

    if (!analysisText) {
        console.error('AI returned an empty response.');
        return res.status(500).json({ success: false, message: "The AI returned an empty response. This might be due to content safety filters." });
    }
    
    return res.status(200).json({ success: true, analysis: analysisText });

  } catch (error) {
    console.error('[GEMINI_API_ERROR]:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error.';
    return res.status(500).json({ 
        success: false, 
        message: `Error calling the Gemini API: ${errorMessage}` 
    });
  }
}
