import { exec } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { extractText } from '../services/ocrEngineService.js';
import { parseRowsFromText } from '../services/ocrParserService.js';
import { validateRows } from '../services/ocrValidationService.js';

export const processOCR = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se subió ninguna imagen' });
  }

  const tempFilename = `${uuidv4()}${path.extname(req.file.originalname)}`;
  const tempPath = path.join('/root/ocr-test', tempFilename); // Using the test directory on server

  try {
    // Save buffer to temporary file on server disk
    await fs.writeFile(tempPath, req.file.buffer);

    // Call Python script
    const pythonPath = '/root/ocr-test/venv/bin/python3';
    const scriptPath = '/root/ocr-test/ocr_engine.py';
    
    exec(`${pythonPath} ${scriptPath} ${tempPath}`, async (error, stdout, stderr) => {
      // Clean up temp file
      try {
        await fs.unlink(tempPath);
      } catch (e) {
        console.error('Error deleting temp OCR file:', e);
      }

      if (error) {
        console.error('OCR Exec Error:', stderr);
        return res.status(500).json({ error: 'Error procesando la imagen con OCR' });
      }

      try {
        const result = JSON.parse(stdout);
        if (result.error) {
          return res.status(422).json({ error: result.error });
        }
        res.json(result);
      } catch (e) {
        console.error('OCR Parse Error:', stdout);
        res.status(500).json({ error: 'Error al interpretar los resultados del OCR' });
      }
    });
  } catch (error) {
    console.error('OCR Controller Error:', error);
    res.status(500).json({ error: 'Error interno en el servidor OCR' });
  }
};

// Fase 1 — OCR Inteligente: preview puro (no toca DB ni /process).
// Lee la imagen con tesseract.js en Node, parsea y valida.
export const previewOCR = async (req, res) => {
  if (!req.file || !req.file.buffer) {
    return res.status(400).json({ error: 'No se subió ninguna imagen' });
  }

  try {
    const { rawText, engine, warnings } = await extractText(req.file.buffer);
    const parsed = parseRowsFromText(rawText);
    const rows = validateRows(parsed);

    return res.json({ rawText, rows, engine, warnings });
  } catch (error) {
    console.error('OCR Preview Error:', error);
    return res.status(500).json({ error: 'Error al procesar OCR preview' });
  }
};
