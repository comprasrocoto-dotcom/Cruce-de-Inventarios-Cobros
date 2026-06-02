import type { VercelRequest, VercelResponse } from '@vercel/node';

const SHEET_ID = '1Sce90Tdc-f4RdiF1aWdotYKO4jkFn1Dy';
const GID = '802660947';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const response = await fetch(CSV_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Vercel serverless)',
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `Google Sheets respondio con status ${response.status}` });
    }

    const csv = await response.text();

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
    return res.status(200).send(csv);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return res.status(500).json({ error: message });
  }
}
