const PUB_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSyQdmhPFyhY3j7kH-acDD4phq3sNCcCQBPEIewWqyMYu1fjPkFzgb8f5Yt0OnO7w/pub?gid=802660947&single=true&output=csv';

export default async function handler(req: any, res: any) {
  try {
    const response = await fetch(PUB_URL);
    if (!response.ok) {
      return res.status(response.status).json({ error: `Google Sheets respondio con status ${response.status}` });
    }
    const rawText = await response.text();
    const bytes = Uint8Array.from(rawText.split('').map((c: string) => c.charCodeAt(0)));
    const csv = new TextDecoder('utf-8').decode(bytes);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
    return res.status(200).send(csv);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    return res.status(500).json({ error: message });
  }
}
