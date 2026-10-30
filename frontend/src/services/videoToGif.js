import { GIFEncoder, quantize, applyPalette } from 'gifenc';

/**
 * Detecta se o arquivo selecionado é um vídeo através do MIME type ou extensão.
 */
export function isVideoFile(file) {
  if (!file) return false;
  const type = (file.type || '').toLowerCase();
  if (type.startsWith('video/')) return true;
  const name = (file.name || '').toLowerCase();
  return /\.(mp4|mov|webm|avi|mkv|m4v|3gp|ogv)$/i.test(name);
}

/**
 * Converte um arquivo de vídeo (até 10 segundos) diretamente no navegador para GIF animado.
 * O backend recebe estritamente uma imagem/GIF, sem necessidade de processamento pesado no servidor.
 * 
 * @param {File|Blob} file Arquivo de vídeo original
 * @param {Function} [onProgress] Callback com o progresso da conversão (0 a 100)
 * @returns {Promise<File>} Arquivo GIF animado pronto para envio
 */
export async function convertVideoToGif(file, onProgress = () => {}) {
  if (!isVideoFile(file)) {
    return file;
  }

  // Em ambientes de teste (Node/JSDOM sem decodificador de vídeo HTML5), fallback seguro
  if (typeof document === 'undefined' || typeof window === 'undefined' || !document.createElement) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const objectUrl = URL.createObjectURL(file);
    video.src = objectUrl;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';

    const cleanUp = () => {
      try {
        URL.revokeObjectURL(objectUrl);
      } catch (_) {}
    };

    video.onerror = () => {
      cleanUp();
      reject(new Error('Não foi possível processar o vídeo no navegador. Formato não suportado.'));
    };

    video.onloadedmetadata = async () => {
      try {
        const duration = video.duration;
        if (!duration || isNaN(duration) || duration <= 0) {
          throw new Error('Não foi possível obter a duração do vídeo.');
        }

        if (duration > 10.05) {
          throw new Error('O vídeo deve ter no máximo 10 segundos para ser convertido em GIF.');
        }

        // Redimensiona mantendo proporção para no máximo 400x400 (leve e rápido)
        const MAX_DIM = 400;
        let width = video.videoWidth || 320;
        let height = video.videoHeight || 240;

        if (width > MAX_DIM || height > MAX_DIM) {
          const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        // Dimensões pares para evitar problemas de amostragem
        width = width % 2 === 0 ? width : width - 1;
        height = height % 2 === 0 ? height : height - 1;

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          throw new Error('Canvas 2D context não suportado no navegador.');
        }

        const gif = GIFEncoder();
        const fps = 10; // 10 quadros por segundo
        const frameInterval = 1 / fps;
        const frameDelay = Math.round(1000 / fps);
        const totalFrames = Math.max(1, Math.floor(duration * fps));

        let currentFrame = 0;

        async function seekAndCapture(time) {
          return new Promise((resSeek, rejSeek) => {
            const onSeeked = () => {
              video.removeEventListener('seeked', onSeeked);
              try {
                ctx.drawImage(video, 0, 0, width, height);
                const imageData = ctx.getImageData(0, 0, width, height);
                const rgba = imageData.data;
                const palette = quantize(rgba, 256);
                const index = applyPalette(rgba, palette);
                gif.writeFrame(index, width, height, { palette, delay: frameDelay });
                resSeek();
              } catch (err) {
                rejSeek(err);
              }
            };

            video.addEventListener('seeked', onSeeked);
            video.currentTime = Math.min(time, duration - 0.01);
          });
        }

        onProgress(5, 'Iniciando captura de frames do vídeo...');

        for (let time = 0; time < duration; time += frameInterval) {
          await seekAndCapture(time);
          currentFrame++;
          const pct = Math.min(95, Math.round(5 + (currentFrame / totalFrames) * 90));
          onProgress(pct, `Convertendo frames para GIF: ${pct}%`);
        }

        gif.finish();
        onProgress(100, 'GIF animado gerado com sucesso!');

        const bytes = gif.bytes();
        const safeBaseName = (file.name || 'animacao').replace(/\.[^/.]+$/, '');
        const gifFile = new File([bytes], `${safeBaseName}.gif`, { type: 'image/gif' });

        cleanUp();
        resolve(gifFile);
      } catch (err) {
        cleanUp();
        reject(err);
      }
    };
  });
}
