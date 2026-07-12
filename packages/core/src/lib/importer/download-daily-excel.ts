export interface DownloadedExcel {
  buffer: Buffer;
  downloadedAt: string;
}

export async function downloadDailyExcel(
  sourceUrl: string,
): Promise<DownloadedExcel> {
  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(
      `A GVH Excel letöltése sikertelen (${response.status} ${response.statusText}): ${sourceUrl}`,
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    downloadedAt: new Date().toISOString(),
  };
}
