const label = (s) => s.replaceAll('_', ' ');

/** Plain-text report in the format from the brief: per-transaction lines, summary, flagged list. */
export function textReport({ run, results, summary }) {
  const id = (r) => r.transactionId ?? `LINE-${r.lineNumber}`;
  const lines = results.map((r) => (r.status === 'APPROVED' ? `${id(r)} APPROVED` : `${id(r)} REJECTED - ${label(r.rejectReason)}`));
  const flagged = results.filter((r) => r.flags.length);
  return [
    `Run #${run.runId} - ${run.sourceFile}`,
    '',
    ...lines,
    '',
    `Transactions Processed: ${summary.processed}`,
    `Approved: ${summary.approved}`,
    `Rejected: ${summary.rejected}`,
    `Flagged For Review: ${summary.flagged}`,
    '',
    'Flagged Transactions',
    ...(flagged.length ? flagged.flatMap((r) => r.flags.map((f) => `${id(r)} ${label(f.type)} - ${f.detail}`)) : ['(none)']),
    '',
  ].join('\n');
}
