const CV_OPENROUTER_API_KEY = Deno.env.get('CV_OPENROUTER_API_KEY') || Deno.env.get('OPENROUTER_API_KEY');

// Use the same robust model list as the generator
const CV_MODELS = [
    'anthropic/claude-3.5-sonnet',
    'openai/gpt-4o',
    'google/gemini-2.0-flash-001',
    'openai/gpt-4o-mini',
    'meta-llama/llama-3.1-70b-instruct',
    'mistralai/mistral-large-2407'
];

// Validation and cleaning functions
function cleanParsedData(data: any): any {
    if (!data) return null;

    // Clean experience entries
    if (data.experience && Array.isArray(data.experience)) {
        data.experience = data.experience.map((exp: any) => {
            // Clean title - remove if it contains dates or looks like description
            if (exp.title) {
                // Remove if title contains dates
                if (exp.title.match(/\d{4}/)) {
                    exp.title = 'Civil Engineer'; // Default
                }
                // Remove if title is too long (likely description leaked in)
                if (exp.title.length > 100) {
                    exp.title = exp.title.substring(0, 100);
                }
                // Remove if title looks like a sentence fragment
                if (exp.title.match(/[.!?]\s*$/)) {
                    exp.title = 'Civil Engineer';
                }
            }

            // Clean company - remove if it's the same as title or contains dates
            if (exp.company) {
                if (exp.company === exp.title) {
                    // Try to extract from description or use generic
                    if (exp.description && exp.description.includes('Project:')) {
                        const projectMatch = exp.description.match(/Project:\s*([^\n]+)/);
                        if (projectMatch) {
                            exp.company = projectMatch[1].trim();
                        }
                    }
                }
                // Remove dates from company
                exp.company = exp.company.replace(/\d{4}\s*[-–—]\s*\d{4}/g, '').trim();
                // Truncate if too long
                if (exp.company.length > 150) {
                    exp.company = exp.company.substring(0, 150);
                }
            }

            // Clean period - standardize format
            if (exp.period || exp.duration) {
                const period = exp.period || exp.duration;
                // Remove extra spaces around dashes
                exp.period = period.replace(/\s*[-–—]\s*/g, ' - ').trim();
                delete exp.duration; // Remove if exists
            }

            // Clean description - ensure it's not in summary
            if (exp.description) {
                // Remove leading bullets
                exp.description = exp.description.replace(/^\s*[•○▪-]\s*/gm, '').trim();
                // Limit length
                if (exp.description.length > 2000) {
                    exp.description = exp.description.substring(0, 2000);
                }
            }

            return exp;
        }).filter((exp: any) =>
            // Keep only valid entries
            exp.title &&
            exp.company &&
            exp.period &&
            exp.title !== exp.company // Remove duplicates
        );
    }

    // Clean education entries
    if (data.education && Array.isArray(data.education)) {
        data.education = data.education.map((edu: any) => {
            // Clean degree
            if (edu.degree) {
                // Remove if degree is too long (likely includes institution)
                if (edu.degree.length > 150) {
                    edu.degree = edu.degree.substring(0, 150);
                }
                // Remove dates from degree
                edu.degree = edu.degree.replace(/\d{4}\s*[-–—]\s*\d{4}/g, '').trim();
            }

            // Clean institution
            if (edu.institution) {
                // Remove if institution contains certification text
                if (edu.institution.match(/CERTIFICATIONS?|AWARDS?/i)) {
                    edu.institution = '';
                }
                // Remove dates
                edu.institution = edu.institution.replace(/\d{4}\s*[-–—]\s*\d{4}/g, '').trim();
                // Truncate if too long
                if (edu.institution.length > 150) {
                    edu.institution = edu.institution.substring(0, 150);
                }
            }

            return edu;
        }).filter((edu: any) =>
            // Keep only valid entries
            edu.degree && edu.degree.length > 5
        );
    }

    // Clean skills
    if (data.skills && Array.isArray(data.skills)) {
        data.skills = data.skills.map((skill: string) => {
            // Remove category prefixes
            skill = skill.replace(/^(?:Road Engineering|Software|Documentation|Environmental|Technical):\s*/i, '');
            // Remove bullet points
            skill = skill.replace(/^[•○▪-]\s*/, '');
            // Remove trailing periods
            skill = skill.replace(/\.\s*$/, '');
            return skill.trim();
        }).filter((skill: string) =>
            // Keep only valid skills
            skill.length > 2 &&
            skill.length < 100 &&
            !skill.match(/^[A-Z\s]+:$/) // Remove category headers
        );
    }

    // Clean certifications
    if (data.certifications && Array.isArray(data.certifications)) {
        data.certifications = data.certifications.map((cert: string) => {
            // Remove bullet points
            cert = cert.replace(/^[•○▪-]\s*/, '');
            return cert.trim();
        }).filter((cert: string) =>
            cert.length > 5 && cert.length < 300
        );
    }

    // Clean summary - ensure it's not experience data
    if (data.summary) {
        // If summary contains multiple job entries, it's wrong
        if (data.summary.match(/\d{4}\s*[-–—]\s*\d{4}/g)?.length > 2) {
            // Look for actual summary section
            const lines = data.summary.split('\n');
            data.summary = lines.slice(0, 5).join(' ').substring(0, 500);
        }
    }

    // Ensure all phone numbers are captured
    if (data.phone && !data.phone.includes(',') && data.phone.includes('+254')) {
        // Check if there are multiple numbers in the original
        // This will be handled by regex fallback if AI fails
    }

    return data;
}

function validateParsedData(data: any): boolean {
    if (!data) return false;

    // Must have basic info
    if (!data.full_name || data.full_name.length < 3) return false;
    if (!data.email || !data.email.includes('@')) return false;

    // Must have at least one of these
    const hasExperience = data.experience && data.experience.length > 0;
    const hasEducation = data.education && data.education.length > 0;
    const hasSkills = data.skills && data.skills.length > 0;

    if (!hasExperience && !hasEducation && !hasSkills) return false;

    // Experience validation
    if (data.experience) {
        for (const exp of data.experience) {
            // Title and company shouldn't be identical
            if (exp.title === exp.company) return false;
            // Title shouldn't contain dates
            if (exp.title && exp.title.match(/\d{4}/)) return false;
            // Must have period
            if (!exp.period && !exp.duration) return false;
        }
    }

    return true;
}

export async function parseCVWithOpenRouter(cvText: string): Promise<any> {
    if (!CV_OPENROUTER_API_KEY) {
        console.error('No CV_OPENROUTER_API_KEY provided');
        return null;
    }

    const systemPrompt = `You are an expert CV parser specialized in extracting structured data from professional CVs and resumes.

## YOUR TASK:
Parse the provided CV text and extract all relevant information into a structured JSON format. Pay special attention to civil engineering, construction, and technical CVs which may contain project-specific details.

## CRITICAL RULES - READ CAREFULLY:

### 1. ACCURACY & COMPLETENESS
- Extract information EXACTLY as written in the source text
- NEVER invent, assume, or hallucinate information
- If a field is not present, use empty string "" or empty array []
- Preserve original wording, especially for technical terms and job titles

### 2. CONTACT INFORMATION
- **full_name**: Extract complete name (first, middle if present, last)
- **email**: Extract primary email address
- **phone**: Extract ALL phone numbers as a single string (comma-separated if multiple)
- **location**: Extract city and country if mentioned (e.g., "Nairobi, Kenya")
- **linkedin_url**: Extract LinkedIn profile URL or username
- **portfolio_url**: Extract personal website/portfolio if mentioned

### 3. PROFESSIONAL SUMMARY
- Look for sections titled: "EXECUTIVE SUMMARY", "PROFESSIONAL SUMMARY", "PROFILE", "ABOUT"
- Extract ONLY the summary text, NOT the work experience that follows
- Summary should be 1-3 paragraphs maximum
- DO NOT include job descriptions, project details, or work history in the summary

### 4. SKILLS EXTRACTION
- Look for sections titled: "SKILLS", "TECHNICAL SKILLS", "COMPETENCIES", "TECHNICAL COMPETENCIES"
- Extract ONLY individual skills, NOT category headers
- Category headers look like: "Road Engineering:", "Software:", "Documentation:"
- Extract only items AFTER the colon
- Example: From "Software: AutoCAD, Revit, Prokon" extract ["AutoCAD", "Revit", "Prokon"]
- DO NOT extract: "Software: AutoCAD" - only extract "AutoCAD"
- Remove bullet points, dashes, periods
- Each skill should be 2-80 characters

### 5. WORK EXPERIENCE PARSING - MOST CRITICAL SECTION

**Read these rules THREE TIMES before parsing:**

**title (Job Title/Role):**
- Must be ONLY a role/position name
- Examples of CORRECT titles: "Civil Engineer", "Site Supervisor", "Structural Design Consultant"
- Examples of INCORRECT titles: 
  ❌ "Private Consultancy Project"
  ❌ "Structural Design of a 4-Bedroom Bungalow at Subukia"
  ❌ "Industrial Attachment – Road Construction Project (Meru County)"
  ❌ Any text containing dates like "Aug 2025 – Dec 2025"
- If the CV doesn't specify a clear title, use the professional designation from the header (e.g., "Civil Engineer")
- Title should be 5-80 characters
- NO dates, NO locations, NO project names in title

**company (Organization/Project):**
- Extract the organization name OR project name
- Examples of CORRECT companies:
  ✅ "Private Consultancy"
  ✅ "Kegure-Kaithe Road Project - Meru County"
  ✅ "Affordable Housing Programme (AHP) - Subukia"
  ✅ "Industrial Attachment - Meru University"
- Examples of INCORRECT companies:
  ❌ Same text as title
  ❌ Text containing "Performed structural analysis..." (that's description)
  ❌ Bullet points or responsibilities
- Company should be 5-150 characters
- NO dates in company name

**period (Date Range):**
- Format: "MMM YYYY - MMM YYYY" or "MMM YYYY - Present"
- Examples: "Aug 2025 - Dec 2025", "May 2024 - Jul 2024", "Jan 2025 - Present"
- Use consistent dash separator (single dash with spaces)
- DO NOT use field name "duration" - use "period"

**description (Responsibilities & Achievements):**
- Extract ALL bullet points for this job
- Preserve bullets using newline character (\\n) between each point
- Remove bullet characters (•, -, *, ○) but keep the content
- Each bullet should be on a new line
- Format example: "Supervised masonry and concrete works\\nEnsured correct mix ratios\\nConducted daily site inspections"
- DO NOT include the project title or company in description
- Description can be 50-2000 characters

**CRITICAL: How to identify separate job entries:**
- Each date range (e.g., "Aug 2025 - Dec 2025") indicates a NEW job entry
- Text immediately BEFORE the date is the company/project
- Text AFTER the date until the next date is the description
- If you see 6 different date ranges, you should create 6 separate experience objects

### 6. EDUCATION PARSING

**degree**: 
- Full degree name only
- Examples: "Bachelor of Technology in Civil Engineering", "Kenya Certificate of Secondary Education (KCSE)"
- DO NOT include dates or institution in degree field
- 10-150 characters

**institution**: 
- Institution name only
- Examples: "Meru University of Science and Technology", "Ndururumo High School"
- DO NOT include degree or dates in institution field
- DO NOT include text like "CERTIFICATIONS & AWARDS"
- 5-150 characters

**year**: 
- Date range or single year
- Examples: "Sept 2020 - Oct 2024", "2016 - 2019", "2024"
- Can extract from nearby text

### 7. CERTIFICATIONS & AWARDS
- Extract each as a separate array item
- Remove bullet points
- Include issuing organization if mentioned
- Example: "Bachelor of Technology in Civil Engineering – Meru University of Science and Technology (2024)"

### 8. COMMON MISTAKES TO AVOID

❌ DO NOT put company name in title field
❌ DO NOT put title in company field  
❌ DO NOT put work experience in summary field
❌ DO NOT put category headers in skills array
❌ DO NOT put dates in degree or institution
❌ DO NOT make title and company identical
❌ DO NOT include bullet characters in description (use \\n instead)
❌ DO NOT use "duration" field (use "period")

## OUTPUT FORMAT:

Return ONLY a valid JSON object. No markdown, no code blocks, no explanatory text.

{
  "full_name": "string",
  "email": "string",
  "phone": "string",
  "location": "string",
  "linkedin_url": "string",
  "portfolio_url": "string",
  "summary": "string (1-3 paragraphs from EXECUTIVE SUMMARY section only)",
  "skills": ["skill1", "skill2", "skill3"],
  "experience": [
    {
      "title": "string (role only, 5-80 chars)",
      "company": "string (organization/project, 5-150 chars)",
      "period": "string (MMM YYYY - MMM YYYY format)",
      "description": "string (bullets separated by \\n)"
    }
  ],
  "education": [
    {
      "degree": "string (degree only, 10-150 chars)",
      "institution": "string (school only, 5-150 chars)",
      "year": "string (date range or year)"
    }
  ],
  "certifications": ["cert1", "cert2"]
}

## SELF-CHECK BEFORE RETURNING:
1. Is title a simple role name (not a project or company)?
2. Is company different from title?
3. Does title NOT contain dates?
4. Does company NOT contain dates?
5. Are skills individual items (not category headers)?
6. Is summary from the EXECUTIVE SUMMARY section (not work experience)?
7. Does each experience entry have all 4 fields (title, company, period, description)?
8. Are bullets in description separated by \\n?
9. Is the JSON valid and parseable?
10. Did I use "period" not "duration"?

If any answer is NO, fix it before returning.`;

    for (const model of CV_MODELS) {
        try {
            console.log(`[CV-PARSE-AI] Trying model: ${model}`);
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${CV_OPENROUTER_API_KEY}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'https://ai-job-scout.com',
                    'X-Title': 'AI Job Scout CV Parser'
                },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        {
                            role: 'user',
                            content: `Parse this CV and return ONLY valid JSON. Remember: title must be a role (not project name), company must be organization (not same as title), use "period" not "duration", separate bullets with \\n.

CV TEXT:
${cvText.substring(0, 15000)}`
                        }
                    ],
                    temperature: 0.0,
                    response_format: { type: 'json_object' }
                })
            });

            if (!response.ok) {
                const err = await response.text();
                console.error(`[CV-PARSE-AI] Error ${response.status} on ${model}: ${err}`);
                continue;
            }

            const data = await response.json();
            const content = data.choices[0].message.content;

            if (!content) continue;

            try {
                let parsed = JSON.parse(content);

                // Clean the data
                parsed = cleanParsedData(parsed);

                // Validate
                if (validateParsedData(parsed)) {
                    console.log(`[CV-PARSE-AI] ✅ Success with ${model}`);
                    console.log(`[CV-PARSE-AI] Parsed: ${parsed.experience?.length || 0} jobs, ${parsed.skills?.length || 0} skills, ${parsed.education?.length || 0} education`);
                    return parsed;
                } else {
                    console.warn(`[CV-PARSE-AI] ❌ Validation failed for ${model}`);
                    console.warn(`[CV-PARSE-AI] Data:`, JSON.stringify(parsed, null, 2).substring(0, 500));
                }
            } catch (e) {
                console.error(`[CV-PARSE-AI] JSON parse error on ${model}:`, e);
            }

        } catch (e) {
            console.error(`[CV-PARSE-AI] Exception on ${model}:`, e);
        }
    }

    console.error('[CV-PARSE-AI] All models failed validation');
    return null;
}