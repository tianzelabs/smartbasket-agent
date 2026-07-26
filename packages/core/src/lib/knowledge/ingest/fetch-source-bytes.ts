export interface FetchedSource {
  buffer: Buffer;
  fetchedAt: string;
}

// download-daily-excel.ts mintájára, de generikus - bármilyen HTML/PDF
// forrásra (nem csak a GVH Excelre).
export async function fetchSourceBytes(url: string): Promise<FetchedSource> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `A forrás letöltése sikertelen (${response.status} ${response.statusText}): ${url}`,
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    fetchedAt: new Date().toISOString(),
  };
}
