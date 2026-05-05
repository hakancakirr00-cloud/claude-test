(function (global) {
  'use strict';

  let workerPromise = null;

  async function getWorker() {
    if (!global.Tesseract) throw new Error('Tesseract.js yüklenmedi');
    if (workerPromise) return workerPromise;
    workerPromise = (async () => {
      // v5: createWorker(langs, oem, options)
      const w = await global.Tesseract.createWorker(['tur', 'eng'], 1, {
        logger: () => {}
      });
      return w;
    })();
    return workerPromise;
  }

  async function recognize(file, onProgress) {
    if (!global.Tesseract) throw new Error('Tesseract.js yüklenmedi');
    const result = await global.Tesseract.recognize(file, 'tur+eng', {
      logger: (m) => {
        if (onProgress && m.status === 'recognizing text') onProgress(m.progress || 0);
      }
    });
    return result.data && result.data.text ? result.data.text : '';
  }

  global.OCR = { recognize, getWorker };
})(window);
