import { ExtractedJob, isNotAJob } from './gemini.js';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const SITE_URL = process.env.SITE_URL || 'http://localhost:3000';
const SITE_NAME = process.env.SITE_NAME || 'AI Job Scout';

// Default to Gemini Flash 2.0 on OpenRouter as requested ("support gemini")
// Fallback to other cheap/fast models if needed
const OPENROUTER_MODELS = [
    // Google Gemini Models
    'google/gemini-2.0-flash-001',
    'google/gemini-flash-1.5',
    'google/gemini-pro-1.5',

    // OpenAI Models
    'openai/gpt-4o-mini',
    'openai/gpt-4o',
    'openai/gpt-3.5-turbo',

    // Anthropic Models
    'anthropic/claude-3.5-sonnet',
    'anthropic/claude-3-haiku',

    // Meta Llama Models
    'meta-llama/llama-3.1-70b-instruct',
    'meta-llama/llama-3.1-405b-instruct',
    'meta-llama/llama-3.1-8b-instruct',

    // Mistral Models
    'mistralai/mistral-large-2407',
    'mistralai/mixtral-8x22b-instruct',

    // DeepSeek Models (Cost effective)
    'deepseek/deepseek-chat',
    'deepseek/deepseek-coder',

    // Qwen Models
    'qwen/qwen-2.5-72b-instruct',
    'qwen/qwen-2.5-coder-32b-instruct'
];

type LogFn = (msg: string) => void;

/**
 * Call OpenRouter API
 */
async function callOpenRouter(prompt: string, log: LogFn): Promise<string | null> {
    if (!OPENROUTER_API_KEY) {
        log('[OpenRouter] No API key configured');
        return null;
    }

    log(`[OpenRouter] API key present: ${OPENROUTER_API_KEY.substring(0, 10)}...`);

    for (const model of OPENROUTER_MODELS) {
        try {
            log(`[OpenRouter] Trying ${model}...`);

            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                    'HTTP-Referer': SITE_URL,
                    'X-Title': SITE_NAME,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    temperature: 0.1,
                    max_tokens: 8192
                })
            });

            if (response.ok) {
                const data = await response.json();
                const text = data?.choices?.[0]?.message?.content;
                if (text) {
                    log(`[OpenRouter] ✅ Success with ${model} - got ${text.length} chars`);
                    return text;
                } else {
                    log(`[OpenRouter] Empty response from ${model}`);
                }
            } else {
                const errorBody = await response.text();
                log(`[OpenRouter] ❌ Error ${response.status} on ${model}: ${errorBody.substring(0, 200)}`);

                // If 401/403, key is probably bad, don't retry other models
                if (response.status === 401 || response.status === 403) {
                    return null;
                }

                continue;
            }
        } catch (e: unknown) {
            const errMsg = e instanceof Error ? e.message : String(e);
            log(`[OpenRouter] Exception on ${model}: ${errMsg}`);
            continue;
        }
    }

    log('[OpenRouter] All models failed');
    return null;
}

/**
 * Extract jobs from page content using OpenRouter
 */
export async function extractWithOpenRouter(content: string, pageUrl: string, log: LogFn = console.log): Promise<ExtractedJob[]> {
    const prompt = `You are an expert job listing parser. Your task is to extract ONLY real, specific job positions from this webpage content.

## CRITICAL RULES:

### WHAT IS A VALID JOB:
- Has a SPECIFIC job title like "Senior Data Annotator", "AI Training Specialist", "Machine Learning Engineer"
- Is an actual position someone can APPLY FOR with a company
- Contains professional role terminology (Developer, Analyst, Manager, Specialist, etc.)

### WHAT IS NOT A JOB (REJECT THESE):
- Generic phrases: "Earn Money", "Be a Part of AI", "Work from Home"  
- Navigation links: "Press and Media", "About Us", "Contact", "Careers"
- Company sections: "Our Values", "Benefits", "Culture", "Mission"
- Categories: "Remote Jobs in Kenya", "Find Your Dream Job"
- Marketing text: "Join Our Team", "Discover Opportunities"
- Generic labels: "Full-time", "Remote", "Contract" (these are job TYPES, not jobs)

## EXTRACTION FORMAT:
For each VALID job position, extract ALL available information:

{
  "title": "EXACT job title as written (e.g., 'Senior Data Annotation Specialist')",
  "company": "Company name hiring for this role (REQUIRED - look for company mentions nearby)",
  "description": "What this job entails - responsibilities and duties",
  "salary": "Pay/compensation (e.g., '$20-25/hour', 'KES 50,000/month', or null)",
  "location": "Where the job is based (city/country) or 'Remote' or 'Hybrid'",
  "employment_type": ["Full-time", "Part-time", "Contract", "Remote", "Freelance"],
  "skills": ["Required technical skills", "e.g., Python", "Data Labeling", "AI/ML knowledge"],
  "requirements": ["Years of experience", "Education requirements", "Certifications"],
  "application_url": "Direct URL to apply if found in the content",
  "deadline": "Application closing date if mentioned",
  "start_date": "When the position starts if mentioned",
  "payment_method": "How workers are paid (hourly, monthly, per task, etc.)"
}

## EXAMPLES OF GOOD EXTRACTIONS:

Input: "Data Annotation Specialist at Sama - Remote, Kenya. We're looking for detail-oriented annotators to label AI training data. Requirements: Fluent English, attention to detail. Pay: $10-15/hour. Apply by Jan 30."

Output:
{
  "title": "Data Annotation Specialist",
  "company": "Sama",
  "description": "Label AI training data with attention to detail",
  "salary": "$10-15/hour",
  "location": "Remote, Kenya",
  "employment_type": ["Remote", "Full-time"],
  "skills": ["Data annotation", "AI training data labeling"],
  "requirements": ["Fluent English", "Attention to detail"],
  "deadline": "January 30",
  "payment_method": "Hourly"
}

## NOW PARSE THIS CONTENT:
URL: ${pageUrl}

---
${content.substring(0, 20000)}
---

Return a JSON array of extracted jobs. If NO valid job positions are found, return exactly: []

IMPORTANT: 
- Only include REAL job titles with professional role terminology
- Include company name for every job (critical for user to know who is hiring)
- Extract ALL fields that are available in the content
- If information is not available, use null (not empty string)

JSON response only:`;

    const response = await callOpenRouter(prompt, log);
    if (!response) return [];

    try {
        let json = response.trim();

        // Extract JSON from markdown code blocks if present
        if (json.includes('```')) {
            const m = json.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (m) json = m[1];
        }
        json = json.trim();

        // Find the JSON array
        const start = json.indexOf('[');
        const end = json.lastIndexOf(']');
        if (start >= 0 && end > start) {
            json = json.substring(start, end + 1);
        }

        const jobs = JSON.parse(json);
        if (!Array.isArray(jobs)) {
            log('[OpenRouter] Response was not an array');
            return [];
        }

        log(`[OpenRouter] Parsed ${jobs.length} raw jobs, filtering...`);

        const filtered = jobs
            .filter((j: Record<string, unknown>) => {
                const title = String(j.title || j.job_name || '').trim();
                if (!title || title.length < 8) {
                    log(`[OpenRouter] Rejected (too short): "${title}"`);
                    return false;
                }
                if (isNotAJob(title)) {
                    log(`[OpenRouter] Rejected (not a job): "${title}"`);
                    return false;
                }
                return true;
            })
            .map((j: Record<string, unknown>): ExtractedJob => ({
                job_name: String(j.title || j.job_name || ''),
                company: j.company ? String(j.company) : null,
                description: String(j.description || ''),
                amount: j.salary || j.pay || j.compensation ? String(j.salary || j.pay || j.compensation) : null,
                location: j.location ? String(j.location) : null,
                employment_details: Array.isArray(j.employment_type)
                    ? j.employment_type.map(String)
                    : (j.employment_type ? [String(j.employment_type)] : []),
                requirements: Array.isArray(j.requirements) ? j.requirements.map(String) : [],
                skills_needed: Array.isArray(j.skills) ? j.skills.map(String) : [],
                site_url: pageUrl,
                application_url: j.application_url || j.apply_url ? String(j.application_url || j.apply_url) : null,
                deadline: j.deadline || j.closing_date ? String(j.deadline || j.closing_date) : null,
                starting_date: j.start_date || j.starting_date ? String(j.start_date || j.starting_date) : null,
                payment_method: j.payment_method || j.payment_type ? String(j.payment_method || j.payment_type) : null
            }));

        log(`[OpenRouter] Final: ${filtered.length} valid jobs after filtering`);
        return filtered;
    } catch (e) {
        log(`[OpenRouter] JSON parse failed: ${e}`);
        return [];
    }
}

// CV Generation Logic

const CV_OPENROUTER_API_KEY = process.env.CV_OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY;

// Prioritize Anthropic as requested, with extensive fallbacks
const CV_MODELS = [
    'anthropic/claude-3.5-sonnet',
    'anthropic/claude-3-haiku',
    'openai/gpt-4o',
    'openai/gpt-4o-mini',
    'google/gemini-2.0-flash-001',
    'meta-llama/llama-3.1-70b-instruct',
    'mistralai/mistral-large-2407'
];

interface CVRequest {
    userProfile: any;
    job: any;
}

export async function generateCVWithOpenRouter(data: CVRequest, log: LogFn = console.log): Promise<any> {
    // Read key dynamically to support late loading (e.g. in tests)
    const apiKey = process.env.CV_OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
        log('[CV-AI] No CV_OPENROUTER_API_KEY provided');
        return null;
    }

    const { userProfile, job } = data;
    const jobTitle = job.job_name || 'Professional';
    const company = job.company || 'the company';

    const systemPrompt = `You are an expert CV writer. Your task is to TAILOR a user's CV to a specific job description while STRICTLY preserving their personal information and education.

## CRITICAL RULES (IMMUTABLE):
1.  **Personal Info**: DO NOT change Name, Email, Phone, Location, LinkedIn, or Portfolio.
2.  **Education**: DO NOT change Education or Certifications. Keep them exactly as provided.
3.  **Experience Timeline**: You MUST generate experience entries that fall STRICTLY within the **2023 to 2026** timeline.
4.  **Experience Entries**: You MUST generate at least **3 distinct experience entries**.
5.  **Relevance**: The experience descriptions and skills MUST be highly tailored to the target job.

## INPUT DATA:
User: ${JSON.stringify(userProfile)}
Target Job: ${JSON.stringify(job)}

## GENERATION INSTRUCTIONS:
1.  **Professional Summary**: Write a compelling summary (max 3 sentences) positioning the user as the perfect candidate for the ${jobTitle} role at ${company}.
2.  **Skills**: Select and prioritize skills from the user's list that match the job. You may add highly relevant keywords if implied by the user's background, but prioritize their existing skills.
3.  **Work Experience (THE MOST IMPORTANT PART)**:
    *   Generate **3 roles** between **2023 and 2026**.
    *   Use the target job title (or similar/senior variations) for the most recent role.
    *   For previous roles, use relevant titles (e.g., "Freelance ${jobTitle}", "Contract ${jobTitle}").
    *   Write 3-4 bullet points for each role.
    *   **CRITICAL**: The bullet points must demonstrate that the user has ALREADY done what the job requires. Use keywords from the job description.

## OUTPUT FORMAT (JSON ONLY):
Return ONLY a JSON object with this structure:
{
  "summary": "String",
  "skills": ["String", "String", ...],
  "experience": [
    {
      "title": "String",
      "company": "String",
      "period": "String (e.g., Jan 2024 - Present)",
      "achievements": ["String", "String", ...]
    }
  ],
  "education": ${JSON.stringify(userProfile.education || [])},
  "certifications": ${JSON.stringify(userProfile.certifications || [])},
  "contact": ${JSON.stringify({
        name: userProfile.full_name,
        email: userProfile.email,
        phone: userProfile.phone,
        location: userProfile.location,
        linkedin: userProfile.linkedin_url,
        portfolio: userProfile.portfolio_url
    })}
}
`;

    for (const model of CV_MODELS) {
        try {
            log(`[CV-AI] Trying model: ${model}`);
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': SITE_URL,
                    'X-Title': SITE_NAME
                },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: 'Generate the tailored CV JSON.' }
                    ],
                    temperature: 0.7,
                    response_format: { type: 'json_object' }
                })
            });

            if (!response.ok) {
                const err = await response.text();
                log(`[CV-AI] Error ${response.status} on ${model}: ${err}`);
                continue;
            }

            const data = await response.json();
            const content = data?.choices?.[0]?.message?.content;

            if (!content) continue;

            try {
                const parsed = JSON.parse(content);
                // Basic validation
                if (parsed.experience && Array.isArray(parsed.experience) && parsed.experience.length >= 3) {
                    log(`[CV-AI] Success with ${model}`);
                    return parsed;
                } else {
                    log(`[CV-AI] Model ${model} returned invalid structure (not enough experience entries)`);
                }
            } catch (e) {
                log(`[CV-AI] JSON parse error on ${model}: ${e}`);
            }

        } catch (e) {
            log(`[CV-AI] Exception on ${model}: ${e}`);
        }
    }

    log('[CV-AI] All models failed');
    return null;
}
