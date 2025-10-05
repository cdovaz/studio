
// DEFINIÇÃO CORRIGIDA: O payload agora inclui os indicadores
interface AnalysisPayload {
  address: string;
  indicators: string[]; // Adicionada a lista de indicadores
}

const API_ROUTE = "/api/analysis";

export const triggerAnalysis = async (payload: AnalysisPayload): Promise<any> => {
  console.log("Enviando para a rota de API interna com o payload completo:", payload);

  const response = await fetch(API_ROUTE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    // O payload completo (address + indicators) é enviado agora
    body: JSON.stringify(payload), 
  });

  // A lógica de tratamento de erro permanece a mesma
  if (!response.ok) {
    const errorBody = await response.json();
    throw new Error(errorBody.message || `A API respondeu com um erro: ${response.status}`);
  }

  return response.json();
};
