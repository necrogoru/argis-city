export async function toPngBytes(source: Blob): Promise<Uint8Array> {
  const bitmap = await createImageBitmap(source);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("The image could not be converted for the clipboard");
    context.drawImage(bitmap, 0, 0);
    const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!png) throw new Error("The image could not be converted for the clipboard");
    return new Uint8Array(await png.arrayBuffer());
  } finally {
    bitmap.close();
  }
}
