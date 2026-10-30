/**
 * Utilitário de conversão de imagens para WebP no navegador via HTML5 Canvas.
 * O backend aceita exclusivamente imagens em formato WebP ou GIFs animados.
 */

export function isWebpOrGif(file) {
  if (!file) return false;
  const type = (file.type || '').toLowerCase();
  const name = (file.name || '').toLowerCase();
  return type === 'image/webp' || type === 'image/gif' || name.endsWith('.webp') || name.endsWith('.gif');
}

/**
 * Converte qualquer imagem (JPEG, PNG, AVIF, BMP, etc.) para WebP otimizado no navegador.
 * Redimensiona para no máximo 1900px e remove dados EXIF de geolocalização.
 * 
 * @param {File|Blob} file Arquivo de imagem original
 * @param {number} [quality=0.92] Qualidade de compressão WebP (0 a 1)
 * @returns {Promise<File>} Arquivo WebP pronto para upload
 */
export async function convertImageToWebp(file, quality = 0.92) {
  if (!file) return file;
  if (isWebpOrGif(file)) return file;

  // Fallback seguro em ambientes sem suporte a DOM / Canvas (ex: testes JSDOM)
  if (typeof document === 'undefined' || typeof window === 'undefined' || !document.createElement) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    const cleanUp = () => {
      try {
        URL.revokeObjectURL(objectUrl);
      } catch (_) {}
    };

    img.onload = () => {
      try {
        const MAX_DIM = 1900;
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (width > MAX_DIM || height > MAX_DIM) {
          const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          cleanUp();
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            cleanUp();
            if (!blob) {
              resolve(file);
              return;
            }
            const baseName = (file.name || 'imagem').replace(/\.[^/.]+$/, '');
            const webpFile = new File([blob], `${baseName}.webp`, { type: 'image/webp' });
            resolve(webpFile);
          },
          'image/webp',
          quality
        );
      } catch (err) {
        cleanUp();
        reject(err);
      }
    };

    img.onerror = () => {
      cleanUp();
      reject(new Error('Não foi possível carregar a imagem para conversão em WebP.'));
    };

    img.src = objectUrl;
  });
}
