
const CV_OPENROUTER_API_KEY = Deno.env.get('CV_OPENROUTER_API_KEY') || Deno.env.get('OPENROUTER_API_KEY');

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

export async function generateCVWithOpenRouter(data: CVRequest): Promise<any> {
    if (!CV_OPENROUTER_API_KEY) {
        console.error('No CV_OPENROUTER_API_KEY provided');
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
            console.log(`[CV-AI] Trying model: ${model}`);
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${CV_OPENROUTER_API_KEY}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://ai-job-scout.com', // Replace with actual site URL
                    'X-Title': 'AI Job Scout CV Generator'
                },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: 'Generate the tailored CV JSON.' }
                    ],
                    temperature: 0.7, // Slightly creative for writing, but structured
                    response_format: { type: 'json_object' }
                })
            });

            if (!response.ok) {
                const err = await response.text();
                console.error(`[CV-AI] Error ${response.status} on ${model}: ${err}`);
                continue;
            }

            const data = await response.json();
            const content = data.choices[0].message.content;

            if (!content) continue;

            try {
                const parsed = JSON.parse(content);
                // Basic validation
                if (parsed.experience && Array.isArray(parsed.experience) && parsed.experience.length >= 3) {
                    console.log(`[CV-AI] Success with ${model}`);
                    return parsed;
                } else {
                    console.warn(`[CV-AI] Model ${model} returned invalid structure (not enough experience entries)`);
                }
            } catch (e) {
                console.error(`[CV-AI] JSON parse error on ${model}:`, e);
            }

        } catch (e) {
            console.error(`[CV-AI] Exception on ${model}:`, e);
        }
    }

    console.error('[CV-AI] All models failed');
    return null;
}
