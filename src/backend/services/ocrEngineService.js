import { existsSync } from 'fs';
import { extractTextFromBuffer as extractTextWithTesseract } from './ocrTextService.js';
import { extractTextWithVision } from './ocrVisionService.js';

function getMode() {
  return String(process.env.OCR_ENGINE || 'tesseract').toLowerCase().trim();
}

function visionConfigured() {
  const credsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credsPath) return false;
  try {
    return existsSync(credsPath);
  } catch {
    return false;
  }
}

async function runTesseract(buffer) {
  const { rawText } = await extractTextWithTesseract(buffer);
  return { rawText, engine: 'tesseract' };
}

async function runVision(buffer) {
  const { rawText } = await extractTextWithVision(buffer);
  return { rawText, engine: 'google' };
}

// Devuelve { rawText, engine, warnings: [] }.
// Política según OCR_ENGINE:
//   tesseract → siempre Tesseract.
//   google    → siempre Vision; si falla, propaga error (caller decide 500).
//   auto      → Vision si hay credenciales accesibles; si falla, fallback a Tesseract con warning.
//               Si no hay credenciales, usa Tesseract sin warning.
export async function extractText(buffer) {
  const mode = getMode();

  if (mode === 'tesseract') {
    const r = await runTesseract(buffer);
    return { ...r, warnings: [] };
  }

  if (mode === 'google') {
    const r = await runVision(buffer);
    return { ...r, warnings: [] };
  }

  // auto
  if (visionConfigured()) {
    try {
      const r = await runVision(buffer);
      return { ...r, warnings: [] };
    } catch (err) {
      const msg = err?.message || 'unknown error';
      console.warn('[ocr] Vision falló, fallback a Tesseract:', msg);
      const r = await runTesseract(buffer);
      return { ...r, warnings: [`vision_failed: ${msg}`] };
    }
  }

  const r = await runTesseract(buffer);
  return { ...r, warnings: [] };
}
