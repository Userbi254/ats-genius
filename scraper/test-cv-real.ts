
import 'dotenv/config';
import { generateCVWithOpenRouter } from './services/openrouter.js';

process.env.CV_OPENROUTER_API_KEY = process.env.CV_OPENROUTER_API_KEY || "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";

const mockUserProfile = {
    full_name: "John Kamau",
    email: "john.kamau@example.com",
    phone: "+254 712 345 678",
    location: "Nairobi, Kenya",
    linkedin_url: "https://linkedin.com/in/johnkamau",
    portfolio_url: "https://johnkamau.dev",
    skills: ["Python", "SQL", "Data Analysis", "Machine Learning", "Project Management", "Tableau"],
    summary: "Experienced data professional.",
    experience: [
        {
            title: "Data Analyst",
            company: "Tech Corp",
            period: "2020 - Present",
            description: "Analyzed data."
        }
    ],
    education: [
        {
            degree: "BSc Computer Science",
            institution: "University of Nairobi",
            year: "2019"
        }
    ],
    certifications: ["Google Data Analytics"]
};

const realJob = {
    job_name: "L&D TECH SPECIALIST (AI Enablement)",
    company: "DDD (Nairobi Hub)",
    description: `The L&D Tech Specialist is responsible for deploying, maintaining, and optimizing DDD’s new AI learning curriculum across leadership, HR, and operations. You will ensure seamless integration between LMS, GPT-based tools, HRIS, and operational workflows, while coaching leaders to adopt AI in everyday processes. If you love building, fixing, teaching, and scaling systems AND you enjoy being the go-to technical brain behind L&D, keep reading. 1. AI Curriculum Delivery & Learning Technology Integration: Deploy and manage AI curriculum for Team Leaders, HR, and support functions. Oversee technical setup, versioning, and rollout of all AI learning modules. Integrate learning content across various workflows. Diagnose, troubleshoot, and optimize learning technology issues. 2. AI Adoption Coaching for Leaders & Operations: Train and coach Ops leaders on AI usage across various departments for daily operations. Provide hands-on support to drive AI-enabled decision-making and performance. Convert operational use-cases into learning workflows that reinforce new behaviors. 3. Systems Workflow & Data Integrity: Configure and maintain various system connections. Own learning analytics dashboards, adoption metrics, and data quality. Collaborate with HRIS and IT to ensure compliance, security, and data integrity. 4. Stakeholder & Program Management: Align tech-driven learning initiatives with business priorities. Advise L&D Lead on emerging automation tools. Localize global solutions to fit Africa's operational context.`,
    skills_needed: ["LMS/HRIS management", "AI curriculum deployment", "Learning technology integration", "AI adoption coaching", "System workflow configuration", "Learning analytics", "Stakeholder management"],
    requirements: ["Diploma/Bachelor’s in IT/CS/Business", "Hands-on experience with LMS/HRIS/Automation", "Ability to coach non-technical users"]
};

async function runTest() {
    console.log("Testing CV Generation with Real Job Data...");
    console.log(`Job: ${realJob.job_name}`);

    const result = await generateCVWithOpenRouter({ userProfile: mockUserProfile, job: realJob });

    if (result) {
        console.log("\n✅ CV Generated Successfully!");
        console.log("\n--- Summary ---");
        console.log(result.summary);

        console.log("\n--- Experience (Should be 3 entries, 2023-2026) ---");
        result.experience.forEach((exp: any, i: number) => {
            console.log(`\n[Role ${i + 1}]`);
            console.log(`Title: ${exp.title}`);
            console.log(`Company: ${exp.company}`);
            console.log(`Period: ${exp.period}`);
            console.log(`Bullets: ${exp.achievements?.length || 0}`);
            console.log(`Sample: ${exp.achievements?.[0]}`);
        });

        // Verification
        const isTimelineValid = result.experience.every((e: any) => {
            const year = parseInt(e.period.match(/\d{4}/)?.[0] || "0");
            return year >= 2023 && year <= 2026;
        });

        if (result.experience.length >= 3 && isTimelineValid) {
            console.log("\n✅ VERIFICATION PASSED: Strict rules met.");
        } else {
            console.log("\n❌ VERIFICATION FAILED: Rules violated.");
            console.log(`Count: ${result.experience.length}, Timeline Valid: ${isTimelineValid}`);
        }

    } else {
        console.log("\n❌ CV Generation Failed (returned null)");
    }
}

runTest();
