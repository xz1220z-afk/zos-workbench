function realName(record = {}) {
  return record.merchantName || record.clientName || record.customerName || record.contactName || '';
}

export function buildRelations(records = []) {
  return records.map((record) => ({
    id: String(record.id || record.recordId || ''),
    name: String(realName(record)).trim(),
    company: record.company || record.source || 'ceo',
    owner: record.owner || record.assignee || null,
    nextAction: record.nextAction || record.nextStep || record.followUp || null,
    dueAt: record.dueAt || record.dueDate || record.nextFollowUpAt || null,
    authority: 'business_fact',
    sourceUpdatedAt: record.sourceUpdatedAt || record.updatedAt || null,
  })).filter((item) => item.id && item.name);
}
