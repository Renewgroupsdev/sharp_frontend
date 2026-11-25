/**
 * Some .pptx files (exported or edited by other tools) list parts in [Content_Types].xml that are not in the package, for
 * example slideMaster2..6. PowerPoint tolerates that; pptx-preview does not: it stops at the first missing part, swallows the
 * error and draws nothing. Dropping the dangling entries lets it read the slides. Files that are already consistent are
 * returned untouched.
 */
export async function repairPptx(data: ArrayBuffer): Promise<ArrayBuffer> {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(data);
  const types = zip.file('[Content_Types].xml');
  if (!types) return data;

  const xml = await types.async('text');
  const cleaned = xml.replace(/<Override\b[^>]*\bPartName="([^"]+)"[^>]*\/>/g, (entry, part: string) => (zip.file(part.replace(/^\//, '')) ? entry : ''));
  if (cleaned === xml) return data;

  zip.file('[Content_Types].xml', cleaned);
  return zip.generateAsync({ type: 'arraybuffer' });
}
