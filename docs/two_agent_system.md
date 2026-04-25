# How Jett Casino Was Built: A Two-Agent AI Development Framework

## The Problem with Single-Agent AI Dev

Using a single large language model for all development tasks is inefficient and costly. It's akin to assigning your most experienced senior engineer to write boilerplate, generate documentation, and refactor trivial code. While capable, a single agent's generalist approach leads to slower iteration, higher token consumption, and a wasteful application of its most valuable capabilities (reasoning, architectural design) on tasks better suited for more specialized or cheaper tools. This "one model for everything" strategy quickly becomes a bottleneck in both development speed and budget.

## The Two-Agent Model

To counter this, we adopted a two-agent framework, assigning distinct roles and tools to optimize for speed, cost, and quality:

-   **Architect** (Claude Sonnet): Responsible for high-level context, architectural decisions, complex debugging, code review, and critical judgment calls. It defines the "what."
-   **Builder** (Gemini Flash): Tasked with bulk code generation, documentation, visual analysis (via multimodal input), and batch operations. It handles the "how," based on the Architect's instructions.

The core insight is clear: Claude establishes the contract—defining types, interfaces, and precise function signatures. Gemini then implements against that contract. Claude is never tasked with writing 500 lines of repetitive code, and Gemini is never asked to make architectural decisions.

## The Workflow

The iterative loop for feature development in this project followed a predictable pattern:

```
1. Architect reads relevant codebase context (e.g., existing files, design patterns).
2. Architect writes a tight specification, primarily in JSON, detailing interfaces and function signatures.
3. Builder (Gemini Flash) generates the implementation from this specification, typically producing ~500 lines of code in ~10 seconds.
4. Architect reviews the output, specifically looking for known failure patterns (see below).
5. TypeScript compiler validates static correctness and type safety.
6. The validated code is shipped.
```

## Real Example: DoomCrash Logic File

This workflow was concretely applied when building `DoomCrashLogic.ts` for the Jett Casino project:

-   **Architect Design:** Claude designed 9 core functions, specifying their exact signatures, return types, and expected behaviors.
-   **Specification:** This design was codified into a `_gemini_spec.json` file.
-   **Gemini Generation:** Gemini processed the spec and generated 417 lines of TypeScript code.
-   **Validation & Fixes:** The TypeScript compiler flagged two minor issues: an unused parameter and a subtle API mismatch in a utility function. These were quickly resolved.
-   **Testing:** Gemini autonomously generated 55 Jest tests directly from the initial function specifications, ensuring coverage.
-   **RTP Tuning:** The game's Return-to-Player (RTP) percentage was tuned via an automated binary search process, with 30 different payout combinations tested in under 60 seconds using the generated Jest suite.
-   **Cost:** The entire `DoomCrashLogic.ts` process consumed approximately 15k Claude tokens, costing around $0.05.

## Known Gemini Failure Patterns (and fixes)

Through repeated iterations, several common Gemini failure patterns were identified and systematically addressed:

1.  **Wrong Phaser API names:** Gemini occasionally hallucinates Phaser API methods (e.g., `fillPolygon`, `strokeLine` which don't exist in the expected Phaser 3 context).
    *   **Fix:** Always cross-reference with the official Phaser 3 (or 4, as applicable) documentation during Architect review.
2.  **Hex color numbers in text styles:** Outputs numerical hex values where string representations are required for CSS-like properties. (e.g., `color: 0xc9a84c` instead of `color: "#c9a84c"`).
    *   **Fix:** A simple search/replace or a specific prompt instruction during generation to ensure string-based hex colors.
3.  **Over-importing from shared modules:** Generates excessive, redundant imports from global utility or shared component files.
    *   **Fix:** Run an automated `import-trim` script post-generation, or configure ESLint rules to flag unused imports.
4.  **`new RNG()` inside loops:** Instantiates a new `RandomNumberGenerator` with the system timestamp inside a loop, leading to identical seeds and thus identical "random" output within a single millisecond.
    *   **Fix:** Explicitly instruct the Builder to always inject RNG instances as a function parameter, or ensure a single, externally seeded RNG is used.
5.  **`Graphics.width`/`height` don't exist:** Attempts to access `width` or `height` properties directly on Phaser `Graphics` objects, which are not present.
    *   **Fix:** Refer to canvas constants or parent container dimensions. Architect review catches this.
6.  **Empty output on large generations (>500 lines):** For very large generation requests, Gemini sometimes returns an empty or truncated response.
    *   **Fix:** Split the generation request into smaller, logical chunks (e.g., generate types first, then functions, then tests).

## Parallel Execution

One significant advantage of using a fast, cost-effective model like Gemini Flash for bulk generation is the ability to execute requests in parallel. This dramatically reduces wall-clock time for tasks involving multiple, independent file generations.

```bash
# Example: Restyle 5 game UI files simultaneously
for GAME in Dice Mines BallDrop Jett ShatterStep; do
  curl -X POST -H "Content-Type: application/json" \
       -d "{\"model\": \"gemini-2.5-flash\", \"contents\": [{\"parts\": [{\"text\": \"Generate ${GAME} UI themed for Jett Casino...\"}]}]}" \
       https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=$GEMINI_API_KEY \
       > /tmp/${GAME}UI_themed.ts &
done
wait  # All 5 files are generated in the time it takes for a single request to complete.
```

## Cost Breakdown: 11 Games, 1 Month

The following table summarizes the estimated token usage and associated costs for developing 11 distinct casino games within a month using this two-agent framework:

| Task | Agent | Est. tokens | Est. cost |
|---|---|---|---|
| Architecture decisions | Claude | ~200k | ~$1.50 |
| 11 Logic files (~400 lines each) | Gemini | ~800k | ~$0.40 |
| 11 UI files (~500 lines each) | Gemini | ~1M | ~$0.50 |
| 11 Test suites | Gemini | ~500k | ~$0.25 |
| /docs, README, changelogs | Gemini | ~300k | ~$0.15 |
| Debugging + reviews | Claude | ~500k | ~$3.00 |
| **Total** | | | **~$6** |

*Note: The actual session cost for the project was higher due to exploratory prompts, failed generations, and iterative refinement. However, this breakdown represents the core cost of the successful build process.*

## When NOT to use this pattern

While powerful, this two-agent pattern is not a panacea. Avoid its application in the following scenarios:

-   **When requirements are unclear:** The Architect (Claude) should always define requirements and architectural patterns first. Gemini thrives on precise specifications; ambiguity leads to poor output.
-   **Greenfield architecture:** When establishing entirely new architectural patterns or highly novel solutions, rely solely on Claude. Gemini's strength is implementing established patterns, not inventing them.
-   **Security-critical code:** Any code dealing with financial transactions, user authentication, or other sensitive operations requires rigorous human review, potentially by both agents, and then a dedicated human security audit. Do not blindly trust generated security code.
-   **When Gemini output quality is consistently poor for a specific task type:** If a particular generation task consistently produces low-quality or incorrect results from Gemini, it's more efficient to revert to Claude (or a human developer) for that specific task rather than repeatedly prompting and fixing.

## Setting It Up

Practical considerations for implementing this framework:

-   **Model Choice:** Gemini 2.5 Flash (not Pro) is the sweet spot. Its speed, quality, and aggressive pricing make it ideal for high-volume, repetitive code generation.
-   **`thinkingBudget: 0`:** For code generation, explicitly set `thinkingBudget: 0` in Gemini API calls. This disables chain-of-thought reasoning, making generations approximately 3x faster, as complex reasoning is handled by the Architect.
-   **Spec Format:** Prefer structured formats like JSON for specifications. Include explicit types, function signatures, and constants. Avoid verbose prose; Gemini excels at parsing structured data.
-   **Validation:** Leverage TypeScript's strict mode. It acts as a complimentary QA engineer, catching a significant class of errors introduced during generation.
-   **Context Management:** Maintain a dedicated `AGENTS.md` (or similar) file within your repository. This document serves as a shared context for both agents, outlining their roles, preferred formats, and common patterns, ensuring consistent behavior.

## The Bottom Line

This two-agent system is not about replacing developers; it's about systematically removing the tedious, repetitive, and low-cognitive-load parts of software development. By offloading boilerplate, documentation, and pattern-based code generation to specialized, cost-effective models, developers are freed to focus on the 20% of work that truly requires human judgment, creativity, and complex problem-solving. For a solo founder, this setup effectively scales their output to that of a small team.
