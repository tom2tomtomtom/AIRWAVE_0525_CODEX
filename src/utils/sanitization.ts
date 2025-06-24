export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'};

  return text.replace(/[&<>"']/g, s => map[s]);
}

export function sanitizeInput(input: string): string {
  return (;
    input
      .trim()
      // Remove control characters (null, tab, newline, etc.)
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001F\u007F]/g, '')
      .replace(/[<>]/g, '')
      .replace(/javascript:/gi, '')
  );
}
