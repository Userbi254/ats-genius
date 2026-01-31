
// Mock data for testing
const mockUserProfile = {
    full_name: "John Doe",
    email: "john@example.com",
    phone: "123-456-7890",
    location: "New York, NY",
    linkedin_url: "https://linkedin.com/in/johndoe",
    portfolio_url: "https://johndoe.com",
    skills: ["JavaScript", "TypeScript", "React", "Node.js", "Python", "SQL"],
    summary: "Experienced developer",
    experience: [
        {
            title: "Frontend Developer",
            company: "Tech Corp",
            period: "2020 - Present",
            achievements: ["Built things"]
        }
    ],
    education: [
        {
            degree: "BS Computer Science",
            institution: "University of Tech",
            year: "2020"
        }
    ],
    certifications: ["AWS Certified"]
};

const mockJob = {
    job_name: "Senior Full Stack Engineer",
    company: "Innovate Inc",
    skills_needed: ["TypeScript", "Node.js", "AWS"],
    requirements: ["5+ years experience"]
};

const mockTemplate = {
    name: "Modern"
};

// Simulate the logic from generate-cv/index.ts
function generateCVRuleBased(userProfile, job, template) {
    // 1. Generate Summary
    const jobTitle = job?.job_name || 'Professional';
    const company = job?.company || 'the company';
    const skills = userProfile?.skills || [];
    const topSkills = skills.slice(0, 3).join(', ');

    const summary = `Motivated professional with expertise in ${topSkills}. Eager to contribute to ${company} as a ${jobTitle}. Leveraging a strong background in ${skills.slice(3, 6).join(', ')} to drive success and deliver high-quality results.`;

    // 2. Prioritize Skills
    // Move job-related skills to the top
    const jobSkills = (job?.skills_needed || []).map(s => s.toLowerCase());
    const userSkills = [...skills];

    const prioritizedSkills = userSkills.sort((a, b) => {
        const aRel = jobSkills.some(js => a.toLowerCase().includes(js));
        const bRel = jobSkills.some(js => b.toLowerCase().includes(js));
        return (aRel === bRel) ? 0 : aRel ? -1 : 1;
    });

    // 3. Generate Experience from Job (2023-2026)
    // Instead of using user's experience, generate synthetic experience based on the target job
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
            reason: "Created relevant experience within 2023-2026 timeline"
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

console.log("Testing Rule-Based CV Generation...");
const result = generateCVRuleBased(mockUserProfile, mockJob, mockTemplate);

console.log("\n--- Generated Summary ---");
console.log(result.summary);

console.log("\n--- Prioritized Skills ---");
console.log(result.skills);

console.log("\n--- Generated Experience ---");
console.log(JSON.stringify(result.experience, null, 2));

console.log("\n--- Optimization Report ---");
console.log(JSON.stringify(result.optimization_report, null, 2));

const exp1 = result.experience[0];
const exp2 = result.experience[1];
const exp3 = result.experience[2];

if (result.summary.includes("Senior Full Stack Engineer") &&
    result.skills[0] === "TypeScript" &&
    result.experience.length === 3 &&
    exp1.period === "Jan 2025 - Present" &&
    exp2.period === "Jan 2024 - Dec 2024" &&
    exp3.period === "Mar 2023 - Dec 2023") {
    console.log("\n✅ TEST PASSED: CV generated correctly with rule-based logic and 2023-2026 timeline.");
} else {
    console.log("\n❌ TEST FAILED: Output does not match expected rules.");
}
