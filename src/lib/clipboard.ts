/**
 * Copy HTML to clipboard while embedding any external images as data URLs.
 *
 * This is useful when pasting into editors (Outlook, etc.) where external image
 * URLs may be stripped or not fetched.
 */
export async function copyHtmlWithEmbeddedImages(html: string, plainText: string = ''): Promise<void> {
  const container = document.createElement('div');
  container.innerHTML = html;

  const imgs = Array.from(container.querySelectorAll('img')) as HTMLImageElement[];
  await Promise.all(imgs.map(async (img) => {
    const src = img.src;
    if (!src || src.startsWith('data:')) return;

    try {
      const response = await fetch(src);
      if (!response.ok) return;
      const blob = await response.blob();
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            resolve(reader.result.split(',')[1] || '');
          } else {
            reject(new Error('Failed to convert blob to base64'));
          }
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      img.src = `data:${blob.type};base64,${base64}`;
    } catch {
      // Ignore failing images; leave the src as-is.
    }
  }));

  const copiedHtml = container.innerHTML;
  const clipboardItems: Record<string, Blob> = {
    'text/html': new Blob([copiedHtml], { type: 'text/html' }),
    'text/plain': new Blob([plainText], { type: 'text/plain' }),
  };

  // Some browsers have incomplete ClipboardItem type definitions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await navigator.clipboard.write([new (ClipboardItem as any)(clipboardItems)]);
}
