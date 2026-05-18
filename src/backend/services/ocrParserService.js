const STATUS_KEYWORDS = [
  { label: 'Active', patterns: [/\bactive\b/i, /\bactivo\b/i, /\bactiva\b/i] },
  { label: 'Inactive', patterns: [/\binactive\b/i, /\binactivo\b/i, /\binactiva\b/i] },
  { label: 'Suspended', patterns: [/\bsuspended\b/i, /\bsuspendido\b/i, /\bsuspendida\b/i] },
  { label: 'Pending', patterns: [/\bpending\b/i, /\bpendiente\b/i] },
  { label: 'Cancelled', patterns: [/\bcancel(l)?ed\b/i, /\bcancelado\b/i, /\bcancelada\b/i] },
  { label: 'Disconnected', patterns: [/\bdisconnect(ed)?\b/i, /\bdesconectado\b/i] }
];

const PHONE_REGEX = /(?:\+?1[\s.-]?)?\(?(\d{3})\)?[\s.-]?(\d{3})[\s.-]?(\d{4})\b/;
const CAMPAIGN_REGEX = /\b([A-Z]{2,}[A-Z0-9]{2,})\b/g;

const CAMPAIGN_BLACKLIST = new Set([
  'ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING', 'CANCELLED', 'CANCELED',
  'DISCONNECTED', 'ACTIVO', 'ACTIVA', 'INACTIVO', 'INACTIVA',
  'SUSPENDIDO', 'SUSPENDIDA', 'PENDIENTE', 'CANCELADO', 'CANCELADA',
  'DESCONECTADO', 'TRUE', 'FALSE', 'NULL', 'NONE'
]);

function extractPhone(line) {
  const match = line.match(PHONE_REGEX);
  if (!match) return null;
  return `${match[1]}${match[2]}${match[3]}`;
}

function extractStatus(line) {
  for (const { label, patterns } of STATUS_KEYWORDS) {
    if (patterns.some((p) => p.test(line))) {
      return label;
    }
  }
  return null;
}

function extractCampaign(line) {
  const matches = line.match(CAMPAIGN_REGEX);
  if (!matches) return null;

  for (const candidate of matches) {
    const upper = candidate.toUpperCase();
    if (CAMPAIGN_BLACKLIST.has(upper)) continue;
    if (!/\d/.test(upper) && upper.length < 5) continue;
    if (upper.length < 4 || upper.length > 16) continue;
    return upper;
  }
  return null;
}

export function parseRowsFromText(rawText) {
  const lines = String(rawText || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const rows = [];

  for (const line of lines) {
    const phone = extractPhone(line);
    if (!phone) continue;

    const status = extractStatus(line);
    const campaign = extractCampaign(line);

    rows.push({
      phone,
      status: status || null,
      campaign: campaign || null,
      sourceLine: line
    });
  }

  return rows;
}
