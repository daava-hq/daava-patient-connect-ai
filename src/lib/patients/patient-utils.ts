/**
 * Formats an Open Dental birthdate string (e.g. "1985-04-12" or "1985-04-12T00:00:00")
 * into "MM/DD/YYYY" format without timezone shift issues.
 * Returns "—" for missing, empty, or default Open Dental placeholder ("0001-01-01").
 */
export function formatDob(birthdate?: string): string {
  if (!birthdate || birthdate.startsWith('0001')) {
    return '—';
  }

  const datePart = birthdate.split(/[T ]/)[0];
  const parts = datePart.split('-');

  if (parts.length === 3) {
    const [year, month, day] = parts;
    if (year && month && day && Number(year) > 1) {
      return `${month.padStart(2, '0')}/${day.padStart(2, '0')}/${year}`;
    }
  }

  const parsed = new Date(birthdate);
  if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 1) {
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    const year = parsed.getFullYear();
    return `${month}/${day}/${year}`;
  }

  return '—';
}
