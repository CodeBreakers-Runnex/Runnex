// Sem Firebase Storage (exige plano Blaze desde fim de 2024): a foto de
// perfil escolhida pelo usuario e redimensionada/comprimida no proprio
// navegador e salva como base64 direto no Postgres (users.photo_url,
// coluna TEXT sem limite de tamanho) — zero infra extra, zero custo.
export function resizeImageToDataUrl(
  file: File,
  maxSize = 400,
  quality = 0.8
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;
      if (width > height) {
        if (width > maxSize) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        }
      } else if (height > maxSize) {
        width = Math.round((width * maxSize) / height);
        height = maxSize;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Nao foi possivel processar a imagem."));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Nao foi possivel ler o arquivo de imagem."));
    };

    img.src = objectUrl;
  });
}
