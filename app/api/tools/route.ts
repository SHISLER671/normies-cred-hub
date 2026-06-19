import { NextResponse } from 'next/server';
import { tools } from '@/lib/tools';

/**
 * Proxy/scrape for tools from https://www.normies.art/tools
 * Returns list of {id, name, description, category, url}
 * 
 * Note: Page appears JS-rendered (static fetch gives minimal content).
 * For full dynamic: 
 * - Use cheerio to parse if HTML structure available in build.
 * - Or discover if normies.art exposes JSON API for tools.
 * - Fallback to curated static list.
 */
export async function GET() {
  try {
    const res = await fetch('https://www.normies.art/tools', {
      next: { revalidate: 3600 }, // cache 1h
    });
    const html = await res.text();

    // Basic parse attempt (improve based on actual page structure)
    // Example: look for patterns in rendered or script data.
    // If fails, use static.
    const parsed: any[] = [];
    // TODO: implement real parser e.g. const $ = cheerio.load(html); $('.tool-card').each(...)
    // For now, if page has no static list, fall back.

    if (parsed.length > 0) {
      return NextResponse.json(parsed);
    }
  } catch (e) {
    console.warn('Failed to scrape tools page, using static curated list', e);
  }

  // Fallback to static (curated for Normies ecosystem, including from community messages)
  return NextResponse.json(tools);
}
