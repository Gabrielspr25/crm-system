import { authFetch } from "@/react-app/utils/auth";

type ExtractedRow = {
  subscriber: string;
  type?: string;
  status?: string;
  pricePlan?: string;
};

type ExtractResult = {
  text: string;
  engine: "gemini" | "local-ocr";
  warnings?: string[];
  rawText?: string;
  rows?: ExtractedRow[];
};

function normalizeTextValue(value: unknown): string {
  return String(value ?? "").trim();
}

function rowsToClipboardText(rows: ExtractedRow[]): string {
  const lines = rows.map((row) => {
    const subscriber = normalizeTextValue(row.subscriber);
    const status = normalizeTextValue(row.status || "Active");
    const pricePlan = normalizeTextValue(row.pricePlan);
    return [subscriber, status, pricePlan].filter(Boolean).join(" ");
  });
  return lines.join("\n").trim();
}

function normalizeRows(payload: any): ExtractedRow[] {
  const rawRows = Array.isArray(payload?.rows)
    ? payload.rows
    : Array.isArray(payload?.subscribers)
      ? payload.subscribers
      : Array.isArray(payload?.data?.rows)
        ? payload.data.rows
        : [];

  return rawRows
    .map((item: any) => ({
      subscriber: normalizeTextValue(item?.subscriber || item?.phone || item?.line),
      type: normalizeTextValue(item?.type),
      status: normalizeTextValue(item?.status),
      pricePlan: normalizeTextValue(item?.pricePlan || item?.plan || item?.price_plan)
    }))
    .filter((row: ExtractedRow) => row.subscriber);
}

async function postOcrAttempt(endpoint: string, fieldName: string, file: File) {
  const form = new FormData();
  form.append(fieldName, file);

  const response = await authFetch(endpoint, {
    method: "POST",
    body: form,
    headers: {}
  });

  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

export async function extractSubscriberTextFromImage(file: File): Promise<ExtractResult> {
  const attempts = [
    { endpoint: "/api/subscribers/extract-image", fieldName: "file" },
    { endpoint: "/api/ocr/process", fieldName: "image" },
    { endpoint: "/api/ocr/process", fieldName: "file" }
  ];

  let lastErrorMessage = "No se pudo procesar la imagen.";

  for (const attempt of attempts) {
    const { response, payload } = await postOcrAttempt(attempt.endpoint, attempt.fieldName, file);

    if (response.status === 404) {
      lastErrorMessage = String(payload?.error || "Ruta no encontrada");
      continue;
    }

    if (!response.ok || payload?.ok === false) {
      throw new Error(payload?.error || `OCR error: ${response.status}`);
    }

    const rows = normalizeRows(payload);
    const text =
      String(payload?.text || payload?.raw_text || payload?.rawText || "").trim()
      || rowsToClipboardText(rows);

    if (!text) {
      throw new Error("Local OCR no detecto texto estructurado.");
    }

    return {
      text,
      engine: "local-ocr",
      warnings: Array.isArray(payload?.warnings) ? payload.warnings : [],
      rawText: String(payload?.raw_text || payload?.rawText || payload?.text || "").trim(),
      rows
    };
  }

  throw new Error(lastErrorMessage);
}
