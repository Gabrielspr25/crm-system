import { createWorker } from 'tesseract.js';

let cachedWorkerPromise = null;

async function getWorker() {
  if (!cachedWorkerPromise) {
    cachedWorkerPromise = (async () => {
      const worker = await createWorker(['eng', 'spa']);
      return worker;
    })();
  }
  return cachedWorkerPromise;
}

export async function extractTextFromBuffer(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error('Buffer de imagen inválido');
  }

  const worker = await getWorker();
  const { data } = await worker.recognize(buffer);

  const rawText = (data && data.text) ? String(data.text) : '';
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return { rawText, lines };
}

export async function shutdownOcrWorker() {
  if (cachedWorkerPromise) {
    try {
      const worker = await cachedWorkerPromise;
      await worker.terminate();
    } catch {
      // ignorar
    } finally {
      cachedWorkerPromise = null;
    }
  }
}
