type ClipboardNavigation = { clipboard?: { writeText(value: string): Promise<void> } };

export async function copyText(value: string, navigation: ClipboardNavigation = navigator, page: Document = document) {
  if (navigation.clipboard?.writeText) {
    try { await navigation.clipboard.writeText(value); return true; }
    catch { /* Fall back when browser clipboard permission is denied. */ }
  }
  const field = page.createElement('textarea');
  field.value = value;
  field.setAttribute('readonly', '');
  field.style.position = 'fixed';
  field.style.top = '-9999px';
  field.style.opacity = '0';
  page.body.appendChild(field);
  try {
    field.focus();
    field.select();
    return page.execCommand('copy');
  } catch { return false; }
  finally { field.remove(); }
}
