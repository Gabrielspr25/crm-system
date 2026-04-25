import { getClient, query } from '../database/db.js';
import { getTangoPool } from '../database/externalPools.js';
import { serverError, badRequest, notFound } from '../middlewares/errorHandler.js';
import { execFile } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const PHONE_REGEX = /(\d{3})[-\s]?(\d{3})[-\s]?(\d{4})/;
const OCR_PHONE_GLOBAL_REGEX = /\b([0-9O]{3})[-\s]?([0-9O]{3})[-\s]?([0-9O]{4})\b/g;
const STATUS_WORD_REGEX = /^(active|activo|canceled|cancelled|cancelado|suspended|suspendido|pending)$/i;
const OCR_HEADER_TOKENS = new Set([
    'BAN',
    'SUBSCRIBER',
    'SUBSCRIBERS',
    'SUBSCRIBERLIST',
    'LIST',
    'TYPE',
    'STATUS',
    'PRICE',
    'PLAN',
    'PRICEPLAN',
    'ACCOUNT',
    'NUMBER',
    'VOICE',
    'SERVICE'
]);
const OCR_ALLOWED_TYPE_TOKENS = new Set(['G', 'C', 'B', 'H', 'M']);
const OCR_STATUS_ALIASES = new Map([
    ['ACTIVE', 'Active'],
    ['ACTVE', 'Active'],
    ['ACIVE', 'Active'],
    ['ACT1VE', 'Active'],
    ['ACTIVO', 'Active'],
    ['CANCELED', 'Canceled'],
    ['CANCELLED', 'Canceled'],
    ['CANCELADO', 'Canceled'],
    ['SUSPENDED', 'Suspended'],
    ['SUSPENDIDO', 'Suspended'],
    ['PENDING', 'Pending'],
    ['PEND1NG', 'Pending']
]);

function normalizePhoneDigits(raw) {
    const digits = String(raw || '').replace(/\D/g, '');
    if (digits.length < 10) return null;
    return digits.slice(-10);
}

function normalizePhone(raw) {
    const phone = normalizePhoneDigits(raw);
    if (!phone) return null;
    return `${phone.slice(0, 3)}-${phone.slice(3, 6)}-${phone.slice(6)}`;
}

function normalizePlanCode(raw) {
    const value = String(raw || '').trim().toUpperCase();
    if (!value) return null;
    const cleaned = value.replace(/[^A-Z0-9]/g, '');
    return cleaned || null;
}

function stripTrailingPhoneNoiseFromPlanCode(raw) {
    let normalized = normalizePlanCode(raw);
    if (!normalized) return null;

    const candidates = [];
    if (normalized.length >= 13) {
        candidates.push(normalized.replace(/(?:787|939)\d{7}$/, ''));
        candidates.push(normalized.replace(/\d{10}$/, ''));
    }

    for (const candidate of candidates) {
        if (candidate && candidate !== normalized && /[A-Z]/.test(candidate)) {
            normalized = candidate;
            break;
        }
    }

    return normalized || null;
}

function normalizeIncomingStatus(raw) {
    const value = String(raw || '').trim().toLowerCase();
    if (!value) {
        return { status: null, warning: 'Status vacio; fila rechazada (solo se aceptan A/Activo o C/Cancelado).' };
    }
    if (['active', 'activo', 'a'].includes(value)) return { status: 'activo', warning: null };
    if (['canceled', 'cancelled', 'cancelado', 'c'].includes(value)) return { status: 'cancelado', warning: null };
    if (['suspended', 'suspendido'].includes(value)) {
        return { status: null, warning: 'Status Suspended/Suspendido no se acepta; fila rechazada.' };
    }
    if (value === 'pending') {
        return { status: null, warning: 'Status Pending no se acepta; fila rechazada.' };
    }
    return { status: null, warning: `Status "${raw}" no reconocido; fila rechazada (solo A/Activo o C/Cancelado).` };
}

function looksLikePlanCode(line) {
    const normalized = normalizePlanCode(line);
    return Boolean(normalized && /[A-Z]/.test(normalized) && /\d/.test(normalized));
}

function normalizeOcrLine(raw) {
    return String(raw || '')
        .replace(/[|¦]/g, ' ')
        .replace(/[“”"']/g, ' ')
        .replace(/[‘’`´]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizeOcrBody(raw) {
    return String(raw || '')
        .replace(/\r/g, '\n')
        .split('\n')
        .map(normalizeOcrLine)
        .filter(Boolean)
        .join('\n');
}

function normalizeOcrToken(raw) {
    return String(raw || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
}

function isHeaderLikeToken(token) {
    const normalized = normalizeOcrToken(token).replace(/-/g, '');
    return OCR_HEADER_TOKENS.has(normalized);
}

function normalizeOcrStatus(raw) {
    const normalized = normalizeOcrToken(raw).replace(/-/g, '');
    return OCR_STATUS_ALIASES.get(normalized) || null;
}

function normalizeOcrType(raw) {
    const normalized = normalizeOcrToken(raw).replace(/-/g, '');
    return OCR_ALLOWED_TYPE_TOKENS.has(normalized) ? normalized : null;
}

function normalizePlanFromOcr(raw) {
    let normalized = stripTrailingPhoneNoiseFromPlanCode(raw);
    if (!normalized) return null;

    normalized = normalized
        .replace(/^8(?=[A-Z])/, 'B')
        .replace(/^BAH0/, 'BAHO')
        .replace(/^BARO/, 'BAHO');

    return normalized;
}

function splitOcrTextIntoPhoneChunks(text) {
    const normalizedBody = normalizeOcrBody(text);
    if (!normalizedBody) return [];

    const matches = [...normalizedBody.matchAll(OCR_PHONE_GLOBAL_REGEX)];
    if (matches.length === 0) {
        return normalizedBody
            .split('\n')
            .map(normalizeOcrLine)
            .filter(Boolean);
    }

    const chunks = [];
    for (let index = 0; index < matches.length; index += 1) {
        const start = matches[index].index ?? 0;
        const end = matches[index + 1]?.index ?? normalizedBody.length;
        const chunk = normalizedBody.slice(start, end).replace(/\n+/g, ' ').trim();
        if (chunk) {
            chunks.push(chunk);
        }
    }

    return chunks;
}

function extractBanNumbersFromText(text) {
    const matches = [...String(text || '').matchAll(/\bBAN\b[\s#:.-]*(\d{6,})/gi)];
    return [...new Set(matches.map(match => match[1]))];
}

function buildStructuredSubscriberText(rows) {
    const lines = rows.map(row => {
        return [
            row.subscriber,
            row.status || 'Active',
            row.pricePlan || ''
        ].filter(Boolean).join(' ');
    });
    return lines.join('\n').trim();
}

function isStrictValidOcrRow(row) {
    return Boolean(
        row?.subscriber
        && row?.type
        && row?.status
        && row?.pricePlan
        && looksLikePlanCode(row.pricePlan)
    );
}

function extractRowFromOcrChunk(chunk) {
    const normalizedChunk = normalizeOcrLine(chunk);
    if (!normalizedChunk) return null;

    const phoneMatch = normalizedChunk.match(/\b[0-9O]{3}[-\s]?[0-9O]{3}[-\s]?[0-9O]{4}\b/);
    if (!phoneMatch) return null;

    const subscriber = normalizePhone(phoneMatch[0].replace(/[Oo]/g, '0'));
    if (!subscriber) return null;

    const phoneStart = phoneMatch.index ?? 0;
    const afterPhone = normalizedChunk.slice(phoneStart + phoneMatch[0].length).trim();
    const searchTokens = afterPhone
        .split(' ')
        .map(token => token.trim())
        .filter(token => token && !isHeaderLikeToken(token));

    let type = null;
    let status = null;
    let pricePlan = null;

    for (let index = 0; index < searchTokens.length; index += 1) {
        const token = searchTokens[index];

        if (!type) {
            type = normalizeOcrType(token) || type;
        }

        if (!status) {
            status = normalizeOcrStatus(token)
                || normalizeOcrStatus(`${token}${searchTokens[index + 1] || ''}`)
                || status;
        }

        if (!pricePlan) {
            const candidatePlan = normalizePlanFromOcr(`${token}${searchTokens[index + 1] || ''}`)
                || normalizePlanFromOcr(token);
            if (
                candidatePlan
                && looksLikePlanCode(candidatePlan)
                && !normalizeOcrStatus(token)
                && !normalizeOcrType(token)
            ) {
                pricePlan = candidatePlan;
            }
        }
    }

    const fallbackPlanTokens = normalizedChunk.match(/\b[A-Z0-9]{1,}\b/g) || [];
    if (!pricePlan) {
        for (let index = 0; index < fallbackPlanTokens.length; index += 1) {
            const token = fallbackPlanTokens[index];
            const candidate = normalizePlanFromOcr(`${token}${fallbackPlanTokens[index + 1] || ''}`)
                || normalizePlanFromOcr(token);
            if (
                candidate
                && looksLikePlanCode(candidate)
                && !isHeaderLikeToken(token)
                && !normalizeOcrStatus(token)
                && !normalizeOcrType(token)
            ) {
                pricePlan = candidate;
                break;
            }
        }
    }

    const candidateRow = {
        subscriber,
        type,
        status,
        pricePlan
    };

    if (!isStrictValidOcrRow(candidateRow)) {
        return null;
    }

    return candidateRow;
}

function extractRowsFromOcrText(text) {
    const cleanedChunks = splitOcrTextIntoPhoneChunks(text);
    const rows = [];
    const seenPhones = new Set();
    let ignoredNoiseLines = 0;

    for (const chunk of cleanedChunks) {
        const row = extractRowFromOcrChunk(chunk);
        if (!row) {
            ignoredNoiseLines += 1;
            continue;
        }

        if (seenPhones.has(row.subscriber)) {
            continue;
        }

        seenPhones.add(row.subscriber);
        rows.push(row);
    }

    return { rows, ignoredNoiseLines };
}

function scoreOcrRow(row) {
    let score = 0;
    if (row?.subscriber) score += 5;
    if (row?.type) score += 1;
    if (row?.status) score += 2;
    if (row?.pricePlan) score += 3;
    if (looksLikePlanCode(row?.pricePlan || '')) score += 2;
    if (/\d$/.test(String(row?.pricePlan || ''))) score += 1;
    return score;
}

function mergeOcrRows(existingRows, candidateRows) {
    const merged = new Map();

    for (const row of existingRows || []) {
        if (isStrictValidOcrRow(row)) {
            merged.set(row.subscriber, row);
        }
    }

    for (const row of candidateRows || []) {
        if (!row?.subscriber) continue;
        if (!isStrictValidOcrRow(row)) continue;
        const previous = merged.get(row.subscriber);
        if (!previous) {
            merged.set(row.subscriber, row);
            continue;
        }
        if (scoreOcrRow(row) > scoreOcrRow(previous)) {
            merged.set(row.subscriber, row);
        }
    }

    return [...merged.values()];
}

async function getAvailablePythonOcrConfig() {
    const candidates = [
        {
            pythonPath: '/root/ocr-test/venv/bin/python3',
            scriptPath: '/root/ocr-test/ocr_engine.py'
        },
        {
            pythonPath: 'python3',
            scriptPath: path.join(process.cwd(), 'ocr_engine.py')
        }
    ];

    for (const candidate of candidates) {
        try {
            if (candidate.pythonPath !== 'python3') {
                await fs.access(candidate.pythonPath);
            }
            await fs.access(candidate.scriptPath);
            return candidate;
        } catch {
            continue;
        }
    }

    return null;
}

function normalizePythonOcrRows(items) {
    return (Array.isArray(items) ? items : [])
        .map((item) => {
            const normalizedStatus = normalizeIncomingStatus(item?.status).status;
            if (!normalizedStatus) {
                return null; // Status invalido (vacio, suspended, pending, etc.): descartar fila.
            }
            const status = normalizedStatus === 'cancelado' ? 'Canceled' : 'Active';

            return {
                subscriber: normalizePhone(item?.subscriber || item?.phone),
                type: 'G',
                status,
                pricePlan: normalizePlanFromOcr(item?.pricePlan || item?.plan || '')
            };
        })
        .filter((row) => row && isStrictValidOcrRow(row));
}

async function runPythonOcrFallback(fileBuffer, originalName = 'ocr-upload.png') {
    const ocrConfig = await getAvailablePythonOcrConfig();
    if (!ocrConfig) {
        return null;
    }

    const tempFile = path.join(os.tmpdir(), `ventaspro-ocr-${Date.now()}-${Math.random().toString(16).slice(2)}${path.extname(originalName) || '.png'}`);

    try {
        await fs.writeFile(tempFile, fileBuffer);
        const { stdout } = await execFileAsync(ocrConfig.pythonPath, [ocrConfig.scriptPath, tempFile], {
            timeout: 30000,
            maxBuffer: 2 * 1024 * 1024
        });

        const parsed = JSON.parse(String(stdout || '{}'));
        if (parsed?.error) {
            return { rows: [], warnings: [`Fallback OCR Python devolvio error: ${parsed.error}`] };
        }

        return {
            rows: normalizePythonOcrRows(parsed?.data),
            warnings: []
        };
    } catch (error) {
        return {
            rows: [],
            warnings: [`Fallback OCR Python no disponible: ${error?.message || error}`]
        };
    } finally {
        try {
            await fs.unlink(tempFile);
        } catch {
            // noop
        }
    }
}

function parseStructuredSubscribers(subscribers) {
    return subscribers.map((item, index) => {
        const phone = normalizePhone(item?.subscriber || item?.phone);
        const statusMeta = normalizeIncomingStatus(item?.status);
        const planCode = stripTrailingPhoneNoiseFromPlanCode(item?.plan || item?.pricePlan || item?.price_plan);
        const rawLine = [
            item?.subscriber || item?.phone || '',
            item?.status || '',
            item?.plan || item?.pricePlan || item?.price_plan || ''
        ].filter(Boolean).join('\t');

        return {
            line_no: index + 1,
            raw_line: rawLine,
            phone,
            status_norm: phone ? statusMeta.status : null,
            plan_code: phone ? planCode : null,
            warning: phone ? statusMeta.warning : 'Teléfono inválido.'
        };
    });
}

function parseInlineClipboardSubscriber(line, lineNo) {
    const compact = String(line || '').replace(/\s+/g, ' ').trim();
    const phoneMatch = compact.match(/\b[0-9O]{3}[-\s]?[0-9O]{3}[-\s]?[0-9O]{4}\b/i);
    if (!phoneMatch) return null;

    const phone = normalizePhone(phoneMatch[0].replace(/[Oo]/g, '0'));
    if (!phone) return null;

    const afterPhone = compact.slice((phoneMatch.index ?? 0) + phoneMatch[0].length).trim();
    if (!afterPhone) return null;

    const tokens = afterPhone
        .split(' ')
        .map(token => token.trim())
        .filter(Boolean);

    if (!tokens.length) return null;

    let cursor = 0;
    if (normalizeOcrType(tokens[cursor])) {
        cursor += 1;
    }

    if (cursor >= tokens.length) return null;

    let statusRaw = tokens[cursor];
    let statusConsumed = 0;
    if (normalizeOcrStatus(statusRaw) || STATUS_WORD_REGEX.test(statusRaw)) {
        statusConsumed = 1;
    } else if (tokens[cursor + 1]) {
        const combinedStatus = `${tokens[cursor]}${tokens[cursor + 1]}`;
        if (normalizeOcrStatus(combinedStatus) || STATUS_WORD_REGEX.test(combinedStatus)) {
            statusRaw = combinedStatus;
            statusConsumed = 2;
        }
    }

    if (!statusConsumed) return null;

    const statusMeta = normalizeIncomingStatus(normalizeOcrStatus(statusRaw) || statusRaw);
    const planCode = stripTrailingPhoneNoiseFromPlanCode(tokens.slice(cursor + statusConsumed).join(''));

    return {
        line_no: lineNo,
        raw_line: line,
        phone,
        status_norm: statusMeta.status,
        plan_code: planCode,
        warning: statusMeta.warning
    };
}

function parseClipboardSubscribers(text) {
    const lines = String(text || '')
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean);

    const parsed = [];
    const warnings = [];

    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        const lineNo = index + 1;

        if (/^100-/.test(line)) {
            parsed.push({
                line_no: lineNo,
                raw_line: line,
                phone: null,
                status_norm: null,
                plan_code: null,
                warning: 'Subscriber ignorado por prefijo 100-.',
                ignored100: true
            });
            continue;
        }

        const compact = line.replace(/\s+/g, ' ').trim();
        const tabParts = compact.split(/\s{2,}|\t+/).map(part => part.trim()).filter(Boolean);
        const directPhone = normalizePhone(line);
        const next = lines[index + 1];
        const next2 = lines[index + 2];
        const next3 = lines[index + 3];
        const inlineParsed = parseInlineClipboardSubscriber(line, lineNo);

        if (inlineParsed) {
            parsed.push(inlineParsed);
            continue;
        }

        if (tabParts.length >= 3 && normalizePhone(tabParts[0]) && STATUS_WORD_REGEX.test(tabParts[1])) {
            const statusMeta = normalizeIncomingStatus(tabParts[1]);
            parsed.push({
                line_no: lineNo,
                raw_line: line,
                phone: normalizePhone(tabParts[0]),
                status_norm: statusMeta.status,
                plan_code: stripTrailingPhoneNoiseFromPlanCode(tabParts.slice(2).join('')),
                warning: statusMeta.warning
            });
            continue;
        }

        if (looksLikePlanCode(line) && normalizePhone(next) && STATUS_WORD_REGEX.test(String(next2 || ''))) {
            const statusMeta = normalizeIncomingStatus(next2);
            parsed.push({
                line_no: lineNo,
                raw_line: `${line} | ${next} | ${next2}`,
                phone: normalizePhone(next),
                status_norm: statusMeta.status,
                plan_code: stripTrailingPhoneNoiseFromPlanCode(line),
                warning: statusMeta.warning
            });
            index += 2;
            continue;
        }

        if (directPhone && STATUS_WORD_REGEX.test(String(next || '')) && looksLikePlanCode(next2)) {
            const statusMeta = normalizeIncomingStatus(next);
            parsed.push({
                line_no: lineNo,
                raw_line: `${line} | ${next} | ${next2}`,
                phone: directPhone,
                status_norm: statusMeta.status,
                plan_code: stripTrailingPhoneNoiseFromPlanCode(next2),
                warning: statusMeta.warning
            });
            index += 2;
            continue;
        }

        if (directPhone && /^[A-Z]$/i.test(String(next || '').trim()) && STATUS_WORD_REGEX.test(String(next2 || '')) && looksLikePlanCode(next3)) {
            const statusMeta = normalizeIncomingStatus(next2);
            parsed.push({
                line_no: lineNo,
                raw_line: `${line} | ${next} | ${next2} | ${next3}`,
                phone: directPhone,
                status_norm: statusMeta.status,
                plan_code: stripTrailingPhoneNoiseFromPlanCode(next3),
                warning: statusMeta.warning
            });
            index += 3;
            continue;
        }

        parsed.push({
            line_no: lineNo,
            raw_line: line,
            phone: null,
            status_norm: null,
            plan_code: null,
            warning: 'Línea no reconocida.'
        });
    }

    const byPhone = new Map();
    for (const row of parsed) {
        if (!row.phone || row.ignored100) continue;
        const previous = byPhone.get(row.phone);
        if (previous) {
            previous.warning = previous.warning
                ? `${previous.warning} Duplicada en el texto; se conserva la última ocurrencia.`
                : 'Duplicada en el texto; se conserva la última ocurrencia.';
            warnings.push(`Teléfono ${row.phone}: se conservó la última ocurrencia del paste.`);
        }
        byPhone.set(row.phone, row);
    }

    const rows = parsed.filter(row => !row.phone || !byPhone.has(row.phone) || byPhone.get(row.phone) === row);
    return { rows, warnings };
}

async function resolveMonthlyValue(planCode) {
    const normalized = normalizePlanCode(planCode);
    if (!normalized) return { value: null, source: null };

    const localExact = await query(
        `SELECT COALESCE(price, price_autopay) AS monthly_value
           FROM plans
          WHERE UPPER(TRIM(COALESCE(code, ''))) = $1
             OR UPPER(TRIM(COALESCE(alpha_code, ''))) = $1
          ORDER BY id ASC
          LIMIT 1`,
        [normalized]
    );
    if (localExact[0]?.monthly_value != null) {
        return { value: Number(localExact[0].monthly_value), source: 'plans-exact' };
    }

    const localSimilar = await query(
        `SELECT COALESCE(price, price_autopay) AS monthly_value
           FROM plans
          WHERE UPPER(TRIM(COALESCE(code, ''))) LIKE $1
             OR UPPER(TRIM(COALESCE(alpha_code, ''))) LIKE $1
          ORDER BY id ASC
          LIMIT 5`,
        [`%${normalized}%`]
    );
    if (localSimilar[0]?.monthly_value != null) {
        return { value: Number(localSimilar[0].monthly_value), source: 'plans-similar' };
    }

    try {
        const tangoPool = getTangoPool();
        const tangoExact = await tangoPool.query(
            `SELECT rate FROM tipoplan WHERE UPPER(TRIM(COALESCE(codigovoz, ''))) = $1 LIMIT 1`,
            [normalized]
        );
        if (tangoExact.rows[0]?.rate != null) {
            return { value: Number(tangoExact.rows[0].rate), source: 'tipoplan-exact' };
        }

        const tangoSimilar = await tangoPool.query(
            `SELECT rate FROM tipoplan WHERE UPPER(TRIM(COALESCE(codigovoz, ''))) LIKE $1 ORDER BY codigovoz ASC LIMIT 5`,
            [`%${normalized}%`]
        );
        if (tangoSimilar.rows[0]?.rate != null) {
            return { value: Number(tangoSimilar.rows[0].rate), source: 'tipoplan-similar' };
        }
    } catch (error) {
        console.warn('[paste-sync] No se pudo consultar Tango tipoplan:', error?.message || error);
    }

    return { value: null, source: null };
}

export const getSubscribers = async (req, res) => {
    const { ban_id, client_id } = req.query;
    try {
        let sql = 'SELECT s.* FROM subscribers s';
        const params = [];
        if (ban_id) {
            sql += ' WHERE s.ban_id = $1';
            params.push(ban_id);
        } else if (client_id) {
            sql += ' JOIN bans b ON s.ban_id = b.id WHERE b.client_id = $1';
            params.push(client_id);
        }
        sql += ' ORDER BY s.created_at DESC';

        const subscribers = await query(sql, params);
        res.json(subscribers);
    } catch (error) {
        serverError(res, error, 'Error obteniendo suscriptores');
    }
};

export const createSubscriber = async (req, res) => {
    const {
        ban_id,
        phone,
        plan,
        monthly_value,
        remaining_payments = null,
        contract_term = null,
        contract_end_date = null
    } = req.body;

    if (!ban_id || !phone) {
        return badRequest(res, 'BAN y número de teléfono son obligatorios');
    }

    try {
        // Verificar si ya existe
        const existing = await query('SELECT id FROM subscribers WHERE phone = $1', [phone]);
        if (existing.length > 0) {
            return badRequest(res, 'El número de teléfono ya existe');
        }

        const result = await query(
            `INSERT INTO subscribers
        (ban_id, phone, plan, monthly_value, remaining_payments, contract_term, contract_end_date, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW())
       RETURNING *`,
            [ban_id, phone, plan, monthly_value, remaining_payments, contract_term, contract_end_date]
        );

        res.status(201).json(result[0]);
    } catch (error) {
        serverError(res, error, 'Error creando suscriptor');
    }
};

export const updateSubscriber = async (req, res) => {
    const { id } = req.params;
    const {
        phone,
        plan,
        monthly_value,
        remaining_payments,
        contract_term,
        contract_end_date,
        status,
        cancel_reason
    } = req.body;

    try {
        const existing = await query('SELECT id FROM subscribers WHERE id = $1', [id]);
        if (existing.length === 0) {
            return notFound(res, 'Suscriptor');
        }

        // Convertir strings vacíos a null para permitir actualizaciones
        const hasPlan = Object.prototype.hasOwnProperty.call(req.body, 'plan');
        const hasContractTerm = Object.prototype.hasOwnProperty.call(req.body, 'contract_term');
        const hasRemainingPayments = Object.prototype.hasOwnProperty.call(req.body, 'remaining_payments');
        const hasMonthlyValue = Object.prototype.hasOwnProperty.call(req.body, 'monthly_value');
        const hasContractEndDate = Object.prototype.hasOwnProperty.call(req.body, 'contract_end_date');

        const cleanPlan = hasPlan ? (plan?.trim() || null) : undefined;
        const cleanContractTerm = hasContractTerm ? (contract_term !== '' ? contract_term : null) : undefined;
        const cleanRemainingPayments = hasRemainingPayments ? (remaining_payments !== '' ? remaining_payments : null) : undefined;
        const cleanMonthlyValue = hasMonthlyValue ? (monthly_value !== '' ? monthly_value : null) : undefined;
        const cleanContractEndDate = hasContractEndDate ? (contract_end_date || null) : undefined;

        const cleanStatus = status?.trim() || null;
        const cleanCancelReason = cancel_reason !== undefined ? (cancel_reason || null) : undefined;

        const result = await query(
            `UPDATE subscribers
              SET phone = COALESCE($1, phone),
              plan = COALESCE($2, plan),
              monthly_value = COALESCE($3, monthly_value),
              remaining_payments = COALESCE($4, remaining_payments),
              contract_term = COALESCE($5, contract_term),
              contract_end_date = COALESCE($6, contract_end_date),
              status = COALESCE($7, status),
              cancel_reason = COALESCE($8, cancel_reason),
              updated_at = NOW()
        WHERE id = $9
        RETURNING *`,
            [
                phone,
                cleanPlan,
                cleanMonthlyValue,
                cleanRemainingPayments,
                cleanContractTerm,
                cleanContractEndDate,
                cleanStatus,
                cleanCancelReason,
                id
            ]
        );

        res.json(result[0]);
    } catch (error) {
        serverError(res, error, 'Error actualizando suscriptor');
    }
};

export const cancelSubscriber = async (req, res) => {
    const { id } = req.params;
    const { cancel_reason = null } = req.body || {};

    try {
        const existing = await query('SELECT id, status FROM subscribers WHERE id = $1', [id]);
        if (existing.length === 0) {
            return notFound(res, 'Suscriptor');
        }

        const result = await query(
            `UPDATE subscribers
             SET status = 'cancelado',
                 cancel_reason = $1,
                 updated_at = NOW()
             WHERE id = $2
             RETURNING *`,
            [cancel_reason, id]
        );

        res.json(result[0]);
    } catch (error) {
        serverError(res, error, 'Error cancelando suscriptor');
    }
};

export const reactivateSubscriber = async (req, res) => {
    const { id } = req.params;

    try {
        const existing = await query('SELECT id FROM subscribers WHERE id = $1', [id]);
        if (existing.length === 0) {
            return notFound(res, 'Suscriptor');
        }

        const result = await query(
            `UPDATE subscribers
             SET status = 'activo',
                 cancel_reason = NULL,
                 updated_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [id]
        );

        res.json(result[0]);
    } catch (error) {
        serverError(res, error, 'Error reactivando suscriptor');
    }
};

export const markNoRenewNow = async (req, res) => {
    const { id } = req.params;
    const { note = null } = req.body || {};

    if (!note || !String(note).trim()) {
        return badRequest(res, 'La nota es obligatoria para marcar "No renueva ahora".');
    }

    try {
        const existing = await query('SELECT id FROM subscribers WHERE id = $1', [id]);
        if (existing.length === 0) {
            return notFound(res, 'Suscriptor');
        }

        const result = await query(
            `UPDATE subscribers
             SET status = 'no_renueva_ahora',
                 cancel_reason = $1,
                 updated_at = NOW()
             WHERE id = $2
             RETURNING *`,
            [String(note).trim(), id]
        );

        res.json(result[0]);
    } catch (error) {
        serverError(res, error, 'Error marcando suscriptor como "No renueva ahora"');
    }
};

export const markPendingRenewal = async (req, res) => {
    const { id } = req.params;

    try {
        const existing = await query('SELECT id FROM subscribers WHERE id = $1', [id]);
        if (existing.length === 0) {
            return notFound(res, 'Suscriptor');
        }

        const result = await query(
            `UPDATE subscribers
             SET status = 'activo',
                 cancel_reason = NULL,
                 updated_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [id]
        );

        res.json(result[0]);
    } catch (error) {
        serverError(res, error, 'Error reactivando suscriptor a "Por renovar"');
    }
};

export const renewSubscriber = async (req, res) => {
    const { id } = req.params;
    const {
        plan,
        monthly_value,
        contract_term,
        remaining_payments,
        contract_end_date
    } = req.body || {};

    const hasPlan = Object.prototype.hasOwnProperty.call(req.body || {}, 'plan');
    const hasMonthlyValue = Object.prototype.hasOwnProperty.call(req.body || {}, 'monthly_value');
    const hasContractTerm = Object.prototype.hasOwnProperty.call(req.body || {}, 'contract_term');
    const hasRemainingPayments = Object.prototype.hasOwnProperty.call(req.body || {}, 'remaining_payments');
    const hasContractEndDate = Object.prototype.hasOwnProperty.call(req.body || {}, 'contract_end_date');

    try {
        const existing = await query('SELECT id FROM subscribers WHERE id = $1', [id]);
        if (existing.length === 0) {
            return notFound(res, 'Suscriptor');
        }

        const result = await query(
            `UPDATE subscribers
             SET status = 'activo',
                 cancel_reason = NULL,
                 plan = COALESCE($1, plan),
                 monthly_value = COALESCE($2, monthly_value),
                 contract_term = COALESCE($3, contract_term),
                 remaining_payments = COALESCE($4, remaining_payments),
                 contract_end_date = COALESCE($5, contract_end_date),
                 updated_at = NOW()
             WHERE id = $6
             RETURNING *`,
            [
                hasPlan ? (plan?.trim() || null) : null,
                hasMonthlyValue ? (monthly_value !== '' ? monthly_value : null) : null,
                hasContractTerm ? (contract_term !== '' ? contract_term : null) : null,
                hasRemainingPayments ? (remaining_payments !== '' ? remaining_payments : null) : null,
                hasContractEndDate ? (contract_end_date || null) : null,
                id
            ]
        );

        res.json(result[0]);
    } catch (error) {
        serverError(res, error, 'Error renovando suscriptor');
    }
};

export const extractImage = async (req, res) => {
    if (!req.file) {
        return badRequest(res, 'No se proporcionó ninguna imagen');
    }

    try {
        console.log("Iniciando extracción OCR local estricta con Tesseract.js...");

        // --- 1. PRE-PROCESAMIENTO CON SHARP ---
        // Aumentamos tamaño para mejor legibilidad, convertimos a B/N y forzamos contraste para matar el fondo azul
        const processedImageBuffer = await sharp(req.file.buffer)
            .resize({ width: 2000, withoutEnlargement: true })
            .grayscale()
            .normalize()
            .linear(1.5, -(128 * 1.5) + 128)
            .toBuffer();

        // --- 2. EXTRACCIÓN CON TESSERACT ---
        const worker = await createWorker('eng');
        const ret = await worker.recognize(processedImageBuffer);
        const text = ret.data.text;
        await worker.terminate();

        console.log("-> Tesseract Raw Text:\n", text);

        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 5);
        const rows = [];

        // Regex para buscar el patrón específico de la tabla:
        // 1. Teléfono: (xxx-xxx-xxxx)
        // 2. Tipo: G, C, etc.
        // 3. Status: Active (o similar)
        // 4. Plan: Letras y números (ej. BAHOT40L)

        const lineRegex = /(\d{3}[-\s]?\d{3}[-\s]?\d{4})\s+([A-Za-z])\s+(Active|Cancelado|Suspendido|Pending|Activo|Suspended|Cancelled)(?:\s+|\|+|I+)([A-Z0-9]+)/i;

        // Un fallback en caso de que Tesseract una palabras (ej. "G Active" -> "GActive")
        const fallbackRegex = /(\d{3}[-\s]?\d{3}[-\s]?\d{4})[^\w]*([A-Za-z])[^\w]*(Active|Cancelado|Suspendido|Pending|Activo|Suspended|Cancelled)[^\w]*([A-Z0-9]+)/i;

        for (const line of lines) {
            let match = line.match(lineRegex);
            if (!match) {
                match = line.match(fallbackRegex);
            }

            if (match) {
                let subscriber = match[1].replace(/\s/g, '-').replace(/O/gi, '0');
                if (!subscriber.includes('-') && subscriber.length === 10) {
                    subscriber = `${subscriber.slice(0, 3)}-${subscriber.slice(3, 6)}-${subscriber.slice(6)}`;
                }

                let type = match[2].toUpperCase();
                let status = match[3];
                // Tesseract a veces confunde 0 y O en los planes
                let pricePlan = match[4].replace(/O/g, '0').replace(/I/g, '1');

                // Corrección forzada para el plan específico que mencionó el usuario si Tesseract lee BAROTAOL -> BAHOT40L
                const planUpper = match[4].toUpperCase();
                if (planUpper.includes('BAHO') || planUpper.includes('BARO') || planUpper.includes('BAH0')) {
                    pricePlan = 'BAHOT40L';
                }

                rows.push({
                    subscriber,
                    type,
                    status,
                    pricePlan
                });
            }
        }

        console.log("-> Filas extraídas:", rows.length);

        res.json({ ok: true, rows: rows, text: text, warnings: [] });
    } catch (error) {
        console.error("Error OCR Tesseract:", error);
        serverError(res, error, 'Error extrayendo datos con OCR Local');
    }
};

// ── PASTE SYNC — Procesa resultados del OCR y actualiza la BD ──
// Reglas:
//   Activo → Activo:    actualiza plan
//   Activo → Cancelled: cancela el suscriptor
//   Activo → Suspended: no toca nada (puede volver a pagar)
//   Suspended → *:      no toca nada
export const extractImageFiltered = async (req, res) => {
    if (!req.file) {
        return badRequest(res, 'No se proporciono ninguna imagen');
    }

    try {
        console.log('Iniciando OCR filtrado para BAN/suscriptores/planes...');

        const { createWorker, PSM } = await import('tesseract.js');
        const worker = await createWorker('eng');

        try {
            const ocrPasses = [
                { mode: PSM.SPARSE_TEXT, label: 'sparse' },
                { mode: PSM.AUTO, label: 'auto' },
                { mode: PSM.SINGLE_BLOCK, label: 'block' }
            ];

            let rawTexts = [];
            let mergedRows = [];
            let ignoredNoiseLines = 0;
            const warnings = [];

            for (const pass of ocrPasses) {
                await worker.setParameters({
                    preserve_interword_spaces: '1',
                    tessedit_pageseg_mode: String(pass.mode)
                });

                const result = await worker.recognize(req.file.buffer);
                const rawText = String(result?.data?.text || '').trim();
                if (!rawText) {
                    continue;
                }

                rawTexts.push(`[${pass.label}]\n${rawText}`);

                const extracted = extractRowsFromOcrText(rawText);
                mergedRows = mergeOcrRows(mergedRows, extracted.rows);
                ignoredNoiseLines += extracted.ignoredNoiseLines;
            }

            const pythonFallback = await runPythonOcrFallback(req.file.buffer, req.file.originalname);
            if (pythonFallback?.rows?.length) {
                mergedRows = mergeOcrRows(mergedRows, pythonFallback.rows);
                warnings.push(`Se agrego fallback OCR Python con ${pythonFallback.rows.length} filas detectadas.`);
            }
            if (pythonFallback?.warnings?.length) {
                warnings.push(...pythonFallback.warnings);
            }

            const rawText = rawTexts.join('\n\n').trim();
            const rows = mergedRows.filter((row) => isStrictValidOcrRow(row));
            const detectedBanNumbers = extractBanNumbersFromText(rawText);

            if (ignoredNoiseLines > 0) {
                warnings.push(`Se ignoraron ${ignoredNoiseLines} lineas sin datos utiles del sistema.`);
            }
            if (rawTexts.length > 1) {
                warnings.push(`Se combinaron ${rawTexts.length} pasadas OCR para mejorar la deteccion de filas.`);
            }
            if (detectedBanNumbers.length > 0) {
                warnings.push(`BAN detectado en imagen: ${detectedBanNumbers.join(', ')}`);
            }
            if (rows.length === 0) {
                return res.status(422).json({
                    ok: false,
                    error: 'No se detectaron filas utiles de suscriptores. La imagen debe contener telefono, status y/o plan.',
                    warnings
                });
            }

            res.json({
                ok: true,
                rows,
                text: buildStructuredSubscriberText(rows),
                raw_text: rawText,
                warnings
            });
        } finally {
            await worker.terminate();
        }
    } catch (error) {
        console.error('Error OCR Tesseract:', error);
        serverError(res, error, 'Error extrayendo datos con OCR Local');
    }
};

const legacyPasteSync = async (req, res) => {
    const { subscribers } = req.body;
    if (!Array.isArray(subscribers) || subscribers.length === 0) {
        return badRequest(res, 'Se requiere un array de suscriptores del OCR');
    }

    const results = { updated: 0, cancelled: 0, skipped: 0, notFound: 0 };

    try {
        for (const item of subscribers) {
            const { subscriber: phone, status: newStatus, plan } = item;
            if (!phone) { results.skipped++; continue; }

            // Buscar en BD por teléfono
            const rows = await query(
                'SELECT id, status FROM subscribers WHERE phone = $1 LIMIT 1',
                [phone]
            );

            if (rows.length === 0) { results.notFound++; continue; }

            const sub = rows[0];
            const currentStatus = (sub.status || 'activo').toLowerCase();
            const incomingStatus = (newStatus || '').toLowerCase();

            // Suspended en CRM → no tocar
            if (currentStatus === 'suspended' || currentStatus === 'suspendido') {
                results.skipped++;
                continue;
            }

            // Activo → Cancelled
            if (['cancelled', 'cancelado', 'canceled'].includes(incomingStatus)) {
                await query(
                    `UPDATE subscribers SET status = 'cancelado', updated_at = NOW() WHERE id = $1`,
                    [sub.id]
                );
                results.cancelled++;
                continue;
            }

            // Activo → Suspended → no tocar
            if (['suspended', 'suspendido'].includes(incomingStatus)) {
                results.skipped++;
                continue;
            }

            // Activo → Activo → actualizar plan
            if (plan) {
                await query(
                    `UPDATE subscribers SET plan = $1, updated_at = NOW() WHERE id = $2`,
                    [plan, sub.id]
                );
            }
            results.updated++;
        }

        res.json({ ok: true, results });
    } catch (error) {
        serverError(res, error, 'Error en paste-sync OCR');
    }
};

export const pasteSync = async (req, res) => {
    const { ban_id, ban_number, clipboard_text, subscribers, dry_run = true } = req.body || {};
    const hasStructuredRows = Array.isArray(subscribers) && subscribers.length > 0;
    const hasClipboardText = String(clipboard_text || '').trim().length > 0;

    if (!ban_id && !String(ban_number || '').trim()) {
        return badRequest(res, 'ban_id o ban_number es requerido');
    }
    if (!hasStructuredRows && !hasClipboardText) {
        return badRequest(res, 'Se requiere texto pegado o filas OCR.');
    }

    try {
        const banRows = ban_id
            ? await query(`SELECT id, ban_number FROM bans WHERE id = $1 LIMIT 1`, [ban_id])
            : await query(`SELECT id, ban_number FROM bans WHERE ban_number = $1 LIMIT 1`, [String(ban_number).trim()]);

        if (!banRows.length) {
            return notFound(res, 'BAN');
        }

        const ban = banRows[0];
        const parseResult = hasStructuredRows
            ? { rows: parseStructuredSubscribers(subscribers), warnings: [] }
            : parseClipboardSubscribers(clipboard_text);

        const previewRows = [];
        const warnings = [...parseResult.warnings];
        const stats = {
            total_lines: parseResult.rows.length,
            valid_rows: 0,
            ignored_100_prefix: 0,
            invalid_lines: 0,
            duplicated_in_paste: 0,
            conflicts_other_ban: 0,
            inserted: 0,
            updated: 0,
            canceled: 0,
            deleted: 0,
            unchanged: 0,
            set_active: 0,
            set_cancelled: 0,
            price_not_found: 0
        };

        const validRows = parseResult.rows.filter(row => row.phone && !row.ignored100);
        stats.duplicated_in_paste = parseResult.rows.reduce((count, row) => {
            return count + (String(row.warning || '').includes('Duplicada en el texto') ? 1 : 0);
        }, 0);
        stats.ignored_100_prefix = parseResult.rows.filter(row => row.ignored100).length;
        stats.invalid_lines = parseResult.rows.filter(row => !row.ignored100 && (!row.phone || !row.status_norm)).length;
        stats.valid_rows = validRows.filter(row => row.status_norm).length;

        const existingSameBan = await query(
            `SELECT id, phone, plan, monthly_value, status, cancel_reason
               FROM subscribers
              WHERE ban_id = $1`,
            [ban.id]
        );
        const existingByPhone = new Map(existingSameBan.map(row => [normalizePhone(row.phone), row]));

        const conflictPhoneDigits = [...new Set(validRows.map(row => normalizePhoneDigits(row.phone)).filter(Boolean))];
        const conflicts = conflictPhoneDigits.length > 0
            ? await query(
                `SELECT s.phone, b.ban_number
                   FROM subscribers s
                   JOIN bans b ON b.id = s.ban_id
                  WHERE NULLIF(regexp_replace(COALESCE(s.phone::text, ''), '[^0-9]', '', 'g'), '') = ANY($1::text[])
                    AND s.ban_id <> $2`,
                [conflictPhoneDigits, ban.id]
            )
            : [];
        const conflictsByPhone = new Map();
        for (const row of conflicts) {
            const phone = normalizePhone(row.phone);
            if (!phone) continue;
            if (!conflictsByPhone.has(phone)) conflictsByPhone.set(phone, []);
            conflictsByPhone.get(phone).push(String(row.ban_number || '').trim());
        }

        const operations = [];
        for (const row of parseResult.rows) {
            if (row.ignored100) {
                previewRows.push({ ...row, action: 'ignorada' });
                continue;
            }
            if (!row.phone) {
                previewRows.push({ ...row, action: 'invalida' });
                continue;
            }
            if (!row.status_norm) {
                const reason = row.warning || 'Status invalido (solo A/Activo o C/Cancelado).';
                previewRows.push({ ...row, action: 'invalida', warning: reason });
                warnings.push(`${row.phone}: ${reason}`);
                continue;
            }

            const sameBanSub = existingByPhone.get(row.phone);
            const conflictBans = conflictsByPhone.get(row.phone) || [];
            let warning = row.warning || null;
            if (conflictBans.length > 0) {
                stats.conflicts_other_ban += 1;
                const conflictMsg = `Telefono existe en otro BAN: ${conflictBans.join(', ')}`;
                warning = warning ? `${warning} ${conflictMsg}` : conflictMsg;
                warnings.push(`${row.phone} ya existe en otro BAN (${conflictBans.join(', ')})`);
            }

            const nextStatus = row.status_norm || 'activo';
            const priceMeta = nextStatus === 'cancelado' ? { value: null, source: null } : await resolveMonthlyValue(row.plan_code);
            if (nextStatus !== 'cancelado' && row.plan_code && priceMeta.value == null) {
                stats.price_not_found += 1;
                const priceWarning = `No se encontró precio para plan ${row.plan_code}`;
                warning = warning ? `${warning} ${priceWarning}` : priceWarning;
                warnings.push(priceWarning);
            }

            let action = 'sin_cambios';

            if (!sameBanSub && conflictBans.length > 0) {
                previewRows.push({ ...row, action: 'conflicto_otro_ban', warning });
                continue;
            }

            if (sameBanSub) {
                const currentStatus = String(sameBanSub.status || 'activo').trim().toLowerCase();
                const currentPlan = normalizePlanCode(sameBanSub.plan);
                const currentMonthly = sameBanSub.monthly_value != null ? Number(sameBanSub.monthly_value) : null;
                const desiredMonthly = priceMeta.value != null ? Number(priceMeta.value) : currentMonthly;

                if (nextStatus === 'cancelado') {
                    action = currentStatus === 'cancelado' ? 'sin_cambios' : 'cancelar';
                } else if (nextStatus === 'suspendido') {
                    action = 'sin_cambios';
                    warning = warning ? `${warning} Suspended no cambia CRM.` : 'Suspended no cambia CRM.';
                } else if (currentStatus === 'cancelado') {
                    action = 'reactivar';
                } else if (currentPlan !== row.plan_code || currentMonthly !== desiredMonthly) {
                    action = 'actualizar';
                }

                operations.push({ row, action, sameBanSub, desiredMonthly });
            } else {
                action = nextStatus === 'suspendido' ? 'insertar_activo' : 'insertar';
                if (nextStatus === 'suspendido') {
                    warning = warning ? `${warning} Suspended se insertará como activo.` : 'Suspended se insertará como activo.';
                }
                operations.push({ row, action, sameBanSub: null, desiredMonthly: priceMeta.value });
            }

            previewRows.push({ ...row, action, warning });
        }

        if (!dry_run && stats.invalid_lines === 0 && stats.conflicts_other_ban === 0) {
            const client = await getClient();
            try {
                await client.query('BEGIN');

                for (const op of operations) {
                    const { row, action, sameBanSub, desiredMonthly } = op;
                    if (!row.phone) continue;

                    if (sameBanSub) {
                        if (action === 'cancelar') {
                            await client.query(
                                `UPDATE subscribers
                                    SET status = 'cancelado',
                                        cancel_reason = 'Cancelado via pegado masivo',
                                        updated_at = NOW()
                                  WHERE id = $1`,
                                [sameBanSub.id]
                            );
                            stats.canceled += 1;
                            stats.set_cancelled += 1;
                            continue;
                        }

                        if (action === 'reactivar' || action === 'actualizar') {
                            await client.query(
                                `UPDATE subscribers
                                    SET status = CASE WHEN $1 = 'cancelado' THEN 'cancelado' ELSE 'activo' END,
                                        cancel_reason = CASE WHEN $1 = 'cancelado' THEN 'Cancelado via pegado masivo' ELSE NULL END,
                                        plan = COALESCE($2, plan),
                                        monthly_value = COALESCE($3, monthly_value),
                                        updated_at = NOW()
                                  WHERE id = $4`,
                                [row.status_norm, row.plan_code, desiredMonthly, sameBanSub.id]
                            );
                            stats.updated += 1;
                            if (action === 'reactivar') stats.set_active += 1;
                            continue;
                        }

                        stats.unchanged += 1;
                        continue;
                    }

                    await client.query(
                        `INSERT INTO subscribers
                            (ban_id, phone, plan, monthly_value, status, cancel_reason, created_at, updated_at)
                         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
                        [
                            ban.id,
                            row.phone,
                            row.plan_code,
                            desiredMonthly,
                            row.status_norm === 'cancelado' ? 'cancelado' : 'activo',
                            row.status_norm === 'cancelado' ? 'Cancelado via pegado masivo' : null
                        ]
                    );
                    if (row.status_norm === 'cancelado') {
                        stats.canceled += 1;
                        stats.set_cancelled += 1;
                    } else {
                        stats.inserted += 1;
                    }
                }

                await client.query('COMMIT');
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }
        } else if (dry_run) {
            for (const row of previewRows) {
                if (row.action === 'insertar' || row.action === 'insertar_activo') stats.inserted += 1;
                else if (row.action === 'actualizar' || row.action === 'reactivar') stats.updated += 1;
                else if (row.action === 'cancelar') stats.canceled += 1;
                else if (row.action === 'sin_cambios') stats.unchanged += 1;
            }
        }

        res.json({
            ok: true,
            dry_run: Boolean(dry_run),
            stats,
            rows: previewRows,
            warnings
        });
    } catch (error) {
        if (error?.constraint === 'subscribers_phone_norm_uniq') {
            return badRequest(res, 'Uno o más teléfonos ya existen en otro BAN. Previsualiza otra vez para ver los conflictos.');
        }
        serverError(res, error, 'Error en paste-sync OCR');
    }
};
