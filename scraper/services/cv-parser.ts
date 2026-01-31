import { callGemini } from './gemini.js';

export async function parseCVWithGemini(cvText: string): Promise<any> {
    const prompt = `You are an expert CV/Resume parser. Extract ALL information EXACTLY as written in the CV.

CV TEXT:
${cvText}

CRITICAL RULES:
1. Extract EVERY skill mentioned - do NOT add skills that aren't in the CV
2. Extract EVERY work experience entry with complete descriptions
3. Extract EVERY education entry
4. Preserve exact dates and formats (e.g., "Aug 2025 – Dec 2025")
5. Do NOT summarize or paraphrase - use exact text from CV
6. Do NOT invent or add information

OUTPUT FORMAT (JSON only, no markdown):
{
  "full_name": "Exact name from CV",
  "email": "email@example.com",
  "phone": "Primary phone number",
  "location": "City, Country",
  "linkedin_url": "URL or null",
  "portfolio_url": "URL or null",
  "summary": "Professional summary from CV",
  "skills": ["skill1", "skill2", ...],
  "experience": [
    {
      "title": "Job Title",
      "company": "Company Name",
      "period": "Exact period from CV",
      "description": "Complete description exactly as written"
    }
  ],
  "education": [
    {
      "degree": "Degree name",
      "institution": "Institution name",
      "year": "Year"
    }
  ],
  "certifications": ["cert1", "cert2", ...]
}

Return ONLY the JSON object.`;

    const log = (msg: string) => console.log(`[CV-Parser] ${msg}`);

    try {
        const response = await callGemini(prompt, log);

        if (!response) {
            log('Gemini returned null');
            return null;
        }

        // Extract JSON from response
        let json = response.trim();

        // Remove markdown code blocks if present
        if (json.includes('```')) {
            const match = json.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (match) json = match[1];
        }

        // Find JSON object
        const start = json.indexOf('{');
        const end = json.lastIndexOf('}');
        if (start >= 0 && end > start) {
            json = json.substring(start, end + 1);
        }

        const parsed = JSON.parse(json);
        log(`Successfully parsed CV for: ${parsed.full_name}`);

        return parsed;
    } catch (error) {
        log(`Error: ${error}`);
        return null;
    }
}
