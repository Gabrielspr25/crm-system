
import { GoogleGenAI, Modality } from "@google/genai";
import { BusinessPlan } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const transcribeAudio = async (audioBlob: Blob): Promise<string> => {
  try {
    const base64Audio = await blobToBase64(audioBlob);
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [{ inlineData: { mimeType: audioBlob.type || 'audio/wav', data: base64Audio } }, { text: "Transcribe this audio precisely." }]
      }
    });
    return response.text || "Error en transcripción.";
  } catch (error) { return ""; }
};

export const generateSpeech = async (text: string): Promise<string | null> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: { parts: [{ text }] },
      config: { 
        responseModalities: [Modality.AUDIO], 
        speechConfig: { 
          voiceConfig: { 
            prebuiltVoiceConfig: { voiceName: 'Kore' } 
          } 
        } 
      },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
  } catch (error) { return null; }
};

export const chatWithAgent = async (
  message: string, 
  history: { role: 'user' | 'model'; text: string }[],
  contextPlans: BusinessPlan[],
  clientType: 'REGULAR' | 'CONVERGENTE' = 'REGULAR'
) => {
  const isConvergent = clientType === 'CONVERGENTE';
  const systemInstruction = `
    Eres un consultor experto en Soluciones Empresariales de Claro Puerto Rico (B2B).
    
    PRODUCTOS:
    - 1 PLAY: Voz pura (Individual/Trunk).
    - 2 PLAY: Internet + Voz.
    - 3 PLAY: Triple Play (Voz+Int+TV).
    
    CATÁLOGO ACTUAL: ${JSON.stringify(contextPlans)}.
    ESTADO CLIENTE: ${isConvergent ? 'CONVERGENTE' : 'REGULAR'}.
    
    REGLA: Si es convergente, busca bonos máximos.
  `;

  const chat = ai.chats.create({
    model: 'gemini-3-pro-preview',
    config: { systemInstruction, temperature: 0.1 }, 
    history: history.map(h => ({ role: h.role as 'user' | 'model', parts: [{ text: h.text }] }))
  });

  return await chat.sendMessageStream({ message });
};

export const analyzePlanDocument = async (file: File, textContext?: string, currentPlans?: BusinessPlan[]): Promise<any> => {
  try {
    let parts: any[] = [];
    if (textContext) {
      parts = [{ text: `DATA DEL DOCUMENTO:\n${textContext}` }];
    } else {
      const base64Data = await fileToBase64(file);
      parts = [{ inlineData: { mimeType: file.type, data: base64Data } }];
    }
    
    const prompt = `
      Actúa como Auditor de Ofertas B2B de Claro Puerto Rico. 
      Compara el documento con la estructura maestra: ${JSON.stringify(currentPlans)}.
      
      IMPORTANTE:
      - Extrae PRECIO NUEVO, CÓDIGO JOB y VIGENCIA (Fecha Inicio y Fin).
      - Si no hay fecha en el documento, reportar "Sin vigencia definida".
      
      SALIDA JSON:
      {
        "changes": [
          {
            "planId": "Nombre o ID del plan",
            "field": "price",
            "oldValue": "valor actual",
            "newValue": "valor nuevo",
            "message": "VIGENCIA: Del DD/MM al DD/MM. Motivo: Cambio boletín."
          }
        ],
        "discrepancies": [
          {"code": "JOB-XYZ", "issue": "Código no existe en el maestro"}
        ]
      }
    `;

    parts.push({ text: prompt });

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: { parts },
      config: { responseMimeType: "application/json" }
    });

    const text = response.text || "{}";
    return JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
  } catch (error) {
    console.error(error);
    return { changes: [], discrepancies: [] };
  }
};

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
  });
};
const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
};
