import * as cheerio from 'cheerio';

/**
 * Extracts job listings from HTML content using Cheerio
 */
export function extractJobsWithCheerio(content: string, pageUrl: string): any[] {
    console.log(`[Cheerio] Parsing ${content.length} characters from ${pageUrl}`);

    // Detect if content is HTML or plain text
    const isHTML = /<html|<body|<div|<article|<h[1-6]/i.test(content);

    if (isHTML) {
        console.log('[Cheerio] Detected HTML content');
        return extractFromHTML(content, pageUrl);
    } else {
        console.log('[Cheerio] Detected plain text/markdown content');
        return extractFromText(content, pageUrl);
    }
}

/**
 * Extract jobs from plain text/markdown content
 */
function extractFromText(text: string, pageUrl: string): any[] {
    const jobs: any[] = [];
    const seenTitles = new Set<string>();

    // Look for job-like patterns in text
    const headerPattern = /^##\s*([^\n]+)/gm;
    let match;
    while ((match = headerPattern.exec(text)) !== null) {
        const title = match[1].trim();

        if (seenTitles.has(title.toLowerCase()) || title.length < 5 || title.length > 150) {
            continue;
        }
        seenTitles.add(title.toLowerCase());

        jobs.push({
            job_name: title,
            company: null,
            description: text.substring(match.index, Math.min(text.length, match.index + 500)),
            site_url: pageUrl
        });
    }

    console.log(`[Cheerio] Extracted ${jobs.length} jobs from text`);
    return jobs;
}

/**
 * Extract jobs from HTML content
 */
function extractFromHTML(html: string, pageUrl: string): any[] {
    const $ = cheerio.load(html);
    const jobs: any[] = [];
    const seenTitles = new Set<string>();

    // Remove script and style elements
    $('script, style, noscript').remove();

    // Common job card selectors
    const jobCardSelectors = [
        '[class*="job-card"]', '[class*="job-listing"]', '[class*="job-item"]',
        '[class*="vacancy"]', '[class*="opening"]', '[class*="position"]',
        '.job', '.posting', '.career-item'
    ];

    function isValidTitle(title: string): boolean {
        if (!title || title.length < 5 || title.length > 200) return false;
        return true;
    }

    // Try each job card selector
    for (const selector of jobCardSelectors) {
        try {
            const cards = $(selector);
            if (cards.length > 0) {
                console.log(`[Cheerio] Found ${cards.length} elements with selector: ${selector}`);

                cards.each((i, card) => {
                    const $card = $(card);
                    const cardText = $card.text().trim().replace(/\s+/g, ' ');

                    if (cardText.length < 30) return;

                    // Find job title
                    let title = '';
                    const titleEl = $card.find('h1, h2, h3, h4, [class*="title"]').first();
                    if (titleEl.length) {
                        title = titleEl.text().trim();
                    }

                    if (!title || !isValidTitle(title)) return;
                    if (seenTitles.has(title.toLowerCase())) return;
                    seenTitles.add(title.toLowerCase());

                    const companyEl = $card.find('[class*="company"]').first();
                    const company = companyEl.length ? companyEl.text().trim() : null;

                    jobs.push({
                        job_name: title,
                        company: company,
                        description: cardText.substring(0, 500),
                        site_url: pageUrl
                    });
                });

                if (jobs.length > 0) break;
            }
        } catch (e) {
            // Ignore selector errors
        }
    }

    console.log(`[Cheerio] Extracted ${jobs.length} jobs from HTML`);
    return jobs;
}

/**
 * Extracts all links from HTML
 */
export function extractLinks(html: string, baseUrl: string): string[] {
    const $ = cheerio.load(html);
    const links: string[] = [];

    $('a[href]').each((i, el) => {
        let href = $(el).attr('href');
        if (!href) return;

        if (href.startsWith('/')) {
            try {
                const url = new URL(baseUrl);
                href = `${url.origin}${href}`;
            } catch { }
        }

        if (href.startsWith('http')) {
            links.push(href);
        }
    });

    return [...new Set(links)];
}

/**
 * Extracts text content from HTML, preserving links in Markdown format
 */
export function htmlToText(html: string): string {
    const $ = cheerio.load(html);
    $('script, style, noscript').remove();

    // Convert links to markdown format [text](url)
    $('a[href]').each((i, el) => {
        const $el = $(el);
        const text = $el.text().trim();
        const href = $el.attr('href');
        if (text && href && !href.startsWith('#') && !href.startsWith('javascript:')) {
            $el.replaceWith(` [${text}](${href}) `);
        }
    });

    return $('body').text().replace(/\s+/g, ' ').trim();
}

/**
 * Injects child content below the corresponding link in the parent text
 */
export function injectChildContent(parentText: string, childUrl: string, childContent: string): string {
    // Escape special regex characters in the URL
    const escapedUrl = childUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Look for [text](url) pattern
    const linkPattern = new RegExp(`\\[([^\\]]+)\\]\\(${escapedUrl}\\)`, 'i');

    const match = parentText.match(linkPattern);
    if (match) {
        const fullLink = match[0];
        const replacement = `\n${fullLink}\n\n--- START CHILD CONTENT (${childUrl}) ---\n${childContent}\n--- END CHILD CONTENT ---\n`;
        return parentText.replace(fullLink, replacement);
    }

    // If link not found in markdown format, just append
    return `${parentText}\n\n--- CHILD CONTENT (${childUrl}) ---\n${childContent}\n`;
}
