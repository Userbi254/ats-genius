import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { generateCVWithOpenRouter } from "./services/openrouter.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Rule-based CV Generation
 * Replaces AI dependency with deterministic logic
 */
function generateCVRuleBased(userProfile: any, job: any, template: any): any {
  // 1. Generate Summary
  const jobTitle = job?.job_name || 'Professional';
  const company = job?.company || 'the company';
  const skills = userProfile?.skills || [];
  const topSkills = skills.slice(0, 3).join(', ');

  const summary = `Motivated professional with expertise in ${topSkills}. Eager to contribute to ${company} as a ${jobTitle}. Leveraging a strong background in ${skills.slice(3, 6).join(', ')} to drive success and deliver high-quality results.`;

  // 2. Prioritize Skills
  // Move job-related skills to the top
  const jobSkills = (job?.skills_needed || []).map((s: string) => s.toLowerCase());
  const userSkills = [...skills];

  const prioritizedSkills = userSkills.sort((a: string, b: string) => {
    const aRel = jobSkills.some((js: string) => a.toLowerCase().includes(js));
    const bRel = jobSkills.some((js: string) => b.toLowerCase().includes(js));
    return (aRel === bRel) ? 0 : aRel ? -1 : 1;
  });

  // 3. Generate Experience from Job (2023-2026) - STRICT FALLBACK
  // Generate 3 synthetic entries if AI fails
  const experience = [
    {
      title: jobTitle,
      company: company,
      period: "Jan 2025 - Present",
      achievements: [
        `Spearheaded key initiatives as a ${jobTitle}, driving a 20% increase in efficiency.`,
        `Leveraged ${topSkills} to deliver high-impact solutions aligned with business goals.`,
        `Collaborated with cross-functional teams to ensure successful project delivery.`
      ]
    },
    {
      title: `Senior ${jobTitle}`,
      company: "Tech Solutions Inc. (Contract)",
      period: "Jan 2024 - Dec 2024",
      achievements: [
        `Led the development of scalable solutions using ${skills.slice(0, 2).join(' and ')}.`,
        `Optimized workflows and improved system performance by implementing best practices.`,
        `Mentored junior team members and conducted code reviews.`
      ]
    },
    {
      title: `Freelance ${jobTitle}`,
      company: "Self-Employed",
      period: "Mar 2023 - Dec 2023",
      achievements: [
        `Successfully delivered multiple projects for diverse clients.`,
        `Demonstrated strong problem-solving skills in a fast-paced environment.`,
        `Managed full project lifecycle from requirements gathering to deployment.`
      ]
    }
  ];

  // 4. Optimization Report
  const optimizationReport = [
    {
      field: "Summary",
      change: "Rewritten to target job",
      reason: `Tailored for ${jobTitle} role at ${company}`
    },
    {
      field: "Skills",
      change: "Reordered",
      reason: "Prioritized skills matching job requirements"
    },
    {
      field: "Experience",
      change: "Generated from Job",
      reason: "Created relevant experience within 2023-2025 timeline"
    }
  ];

  return {
    summary: summary,
    skills: prioritizedSkills,
    experience: experience,           // Generated
    education: userProfile.education || [],   // Preserve original
    certifications: userProfile.certifications || [],
    contact: {
      name: userProfile.full_name,
      email: userProfile.email,
      phone: userProfile.phone,
      location: userProfile.location,
      linkedin: userProfile.linkedin_url,
      portfolio: userProfile.portfolio_url
    },
    optimization_report: optimizationReport
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userProfile, job, template } = await req.json();

    console.log('Received Request (Rule-Based):');
    console.log('- User Profile Name:', userProfile?.full_name);
    console.log('- Job:', job?.job_name);

    if (!userProfile) {
      return new Response(
        JSON.stringify({ success: false, error: 'User profile is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Attempting AI CV generation via OpenRouter...');
    let cvContent = await generateCVWithOpenRouter({ userProfile, job });

    if (cvContent) {
      console.log('✅ AI CV generation successful');
      // Ensure optimization report exists
      cvContent.optimization_report = [
        { field: "Summary", change: "AI Generated", reason: "Tailored to job description" },
        { field: "Experience", change: "AI Generated", reason: "Strict 2023-2026 timeline, 3 entries" },
        { field: "Skills", change: "AI Prioritized", reason: "Matched to job requirements" }
      ];
    } else {
      console.log('⚠️ AI generation failed, falling back to strict rule-based logic...');
      cvContent = generateCVRuleBased(userProfile, job, template);
      console.log('✅ Rule-based CV generated successfully');
    }

    return new Response(
      JSON.stringify({
        success: true,
        version: "2.0_RULE_BASED",
        data: cvContent,
        raw_content: JSON.stringify(cvContent)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error generating CV:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate CV',
        stack: error instanceof Error ? error.stack : null
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
