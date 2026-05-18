const VALID_STATUSES = new Set([
  'Active', 'Inactive', 'Suspended', 'Pending', 'Cancelled', 'Disconnected'
]);

function validatePhone(phone) {
  if (!phone) return 'missing';
  if (!/^\d{10}$/.test(phone)) return 'invalid';
  return 'ok';
}

function validateStatus(status) {
  if (!status) return 'missing';
  if (!VALID_STATUSES.has(status)) return 'invalid';
  return 'ok';
}

function validateCampaign(campaign) {
  if (!campaign) return 'missing';
  if (!/^[A-Z0-9]{4,16}$/.test(campaign)) return 'invalid';
  return 'ok';
}

export function validateRows(parsedRows) {
  const phoneCounts = new Map();
  for (const row of parsedRows) {
    if (!row.phone) continue;
    phoneCounts.set(row.phone, (phoneCounts.get(row.phone) || 0) + 1);
  }

  return parsedRows.map((row) => {
    const validations = {
      phone: validatePhone(row.phone),
      status: validateStatus(row.status),
      campaign: validateCampaign(row.campaign)
    };

    const duplicate = row.phone ? (phoneCounts.get(row.phone) || 0) > 1 : false;

    const canImport =
      validations.phone === 'ok' &&
      validations.status === 'ok' &&
      validations.campaign === 'ok' &&
      !duplicate;

    return {
      phone: row.phone,
      status: row.status,
      campaign: row.campaign,
      validations,
      duplicate,
      canImport
    };
  });
}
