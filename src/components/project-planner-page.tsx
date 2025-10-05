"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";

export default function ProjectPlannerPage() {
  const [lat, setLat] = useState("34.0522");
  const [lng, setLng] = useState("-118.2437");
  const [markdown, setMarkdown] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setMarkdown("");

    try {
      const response = await fetch("https://cdovaz.app.n8n.cloud/webhook-test/3b37f24d-e83a-4c17-bd80-c83f2f6a2ad9", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ lat: parseFloat(lat), lng: parseFloat(lng) }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Ocorreu um erro na requisição ao webhook.");
      }

      // Recebe a resposta do webhook e a exibe como markdown.
      const responseText = await response.text();
      
      // Tentamos interpretar a resposta como JSON, caso o n8n retorne um objeto.
      // Se não for JSON, usamos o texto bruto.
      try {
        const data = JSON.parse(responseText);
        // Se houver uma chave "markdown", usamos ela. Senão, usamos o texto completo.
        setMarkdown(data.markdown || responseText);
      } catch (e) {
        // Se não for um JSON válido, é apenas texto.
        setMarkdown(responseText);
      }

    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-50">
      <div className="w-full max-w-4xl bg-white rounded-lg shadow-md p-8">
        <h1 className="text-3xl font-bold mb-6 text-center text-gray-800">
          Gerador de Plano de Projeto
        </h1>
        
        <form onSubmit={handleSubmit} className="mb-8">
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="flex-1">
              <label htmlFor="latitude" className="block text-sm font-medium text-gray-700 mb-1">
                Latitude
              </label>
              <input
                id="latitude"
                type="text"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Ex: 34.0522"
                required
              />
            </div>
            <div className="flex-1">
              <label htmlFor="longitude" className="block text-sm font-medium text-gray-700 mb-1">
                Longitude
              </label>
              <input
                id="longitude"
                type="text"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Ex: -118.2437"
                required
              />
            </div>
          </div>
          <button
            type="submit"
            className="w-full bg-indigo-600 text-white font-bold py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400"
            disabled={isLoading}
          >
            {isLoading ? "Enviando para n8n..." : "Gerar Plano de Projeto"}
          </button>
        </form>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md mb-6" role="alert">
            <strong className="font-bold">Erro: </strong>
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        {markdown && (
          <div className="prose prose-lg max-w-none bg-gray-100 rounded-md p-6 border">
            <ReactMarkdown>{markdown}</ReactMarkdown>
          </div>
        )}
      </div>
    </main>
  );
}