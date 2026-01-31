
console.log("Testing Strict Link Filtering...");

// Mock the filtering logic from playwright.ts
function filterLinks(links) {
    return links.filter(link => {
        const lowerLink = link.toLowerCase();

        // 1. Must contain job-related keywords
        const hasJobKeyword = /job|career|position|opening|vacancy|hiring|apply|role|work/i.test(lowerLink);

        // 2. Must NOT contain non-job keywords
        const hasExcludedKeyword = /login|signin|signup|register|auth|password|pricing|about|blog|news|article|privacy|terms|cookie|contact|faq|help|support|forgot|reset|account|profile|dashboard|admin|settings|preferences|logout|signout/i.test(lowerLink);

        return hasJobKeyword && !hasExcludedKeyword;
    });
}

const testLinks = [
    "https://example.com/jobs/software-engineer",
    "https://example.com/careers/frontend-dev",
    "https://example.com/openings/product-manager",
    "https://example.com/apply/123",
    "https://example.com/login",
    "https://example.com/signup",
    "https://example.com/about-us",
    "https://example.com/blog/how-to-interview",
    "https://example.com/pricing",
    "https://example.com/terms-of-service",
    "https://example.com/work-at-google",
    "https://example.com/my-account"
];

const expectedLinks = [
    "https://example.com/jobs/software-engineer",
    "https://example.com/careers/frontend-dev",
    "https://example.com/openings/product-manager",
    "https://example.com/apply/123",
    "https://example.com/work-at-google"
];

const filtered = filterLinks(testLinks);

console.log("\n--- Input Links ---");
console.log(testLinks);

console.log("\n--- Filtered Links ---");
console.log(filtered);

console.log("\n--- Expected Links ---");
console.log(expectedLinks);

const passed = filtered.length === expectedLinks.length &&
    filtered.every((val, index) => val === expectedLinks[index]);

if (passed) {
    console.log("\n✅ TEST PASSED: Strict link filtering works as expected.");
} else {
    console.log("\n❌ TEST FAILED: Filtered links do not match expected output.");
}
