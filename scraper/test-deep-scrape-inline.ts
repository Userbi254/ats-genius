import { htmlToText, injectChildContent } from './services/cheerio.js';

console.log("Testing Deep Scrape Inline Expansion...");

// Mock Data
const parentHtml = `
<html>
<body>
    <h1>Main Page</h1>
    <p>This is the main page content.</p>
    <p>Check out <a href="https://example.com/child1">Child Page 1</a> for more info.</p>
    <p>Also see <a href="https://example.com/child2">Child Page 2</a>.</p>
</body>
</html>
`;

const child1Content = "This is the content of Child Page 1. It has some details.";
const child2Content = "This is the content of Child Page 2. It has other details.";

// 1. Convert Parent HTML to Text (Markdown links)
console.log("\n1. Converting Parent HTML to Text...");
const parentText = htmlToText(parentHtml);
console.log("Parent Text:\n", parentText);

// 2. Inject Child 1
console.log("\n2. Injecting Child 1...");
let consolidatedText = injectChildContent(parentText, "https://example.com/child1", child1Content);

// 3. Inject Child 2
console.log("\n3. Injecting Child 2...");
consolidatedText = injectChildContent(consolidatedText, "https://example.com/child2", child2Content);

console.log("\n--- Final Consolidated Text ---");
console.log(consolidatedText);

// Verification
if (consolidatedText.includes("--- START CHILD CONTENT (https://example.com/child1) ---") &&
    consolidatedText.includes("--- START CHILD CONTENT (https://example.com/child2) ---") &&
    consolidatedText.includes(child1Content) &&
    consolidatedText.includes(child2Content)) {
    console.log("\n✅ TEST PASSED: Child content successfully injected inline.");
} else {
    console.log("\n❌ TEST FAILED: Child content not found or format incorrect.");
}
