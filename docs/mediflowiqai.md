# OPENCODE IMPLEMENTATION PROMPT: ASK MEDIFLOW IQ — INTELLIGENT IN-APP HELP ASSISTANT

## 1. PROJECT CONTEXT

You are working inside my existing MediFlow IQ application, a pharmacy and drug-shop management system.

The application uses Next.js App Router, TypeScript, Tailwind CSS, Supabase, authentication, role-based access control, Dexie-based offline storage, and existing application services.

Your task is to implement a professional, intelligent, AI-like help portal called **Ask MediFlow IQ**.

The portal must answer questions specifically about how to use MediFlow IQ, including POS, Products, Inventory, Purchases, Suppliers, Sales, Returns, Expenses, Customers, Reports, Users, Audit Logs, Settings, account access, and other modules that actually exist in this project.

**CRITICAL REQUIREMENT: Do not connect to OpenAI, Gemini, Claude, or any other AI model or external AI API. Do not build or train a machine-learning model.** Use conventional programming techniques to deliver the best possible intelligent help experience.

The implementation must integrate into the existing application without breaking, replacing, or unnecessarily modifying any existing functionality.

## 2. FIRST: INSPECT THE EXISTING PROJECT

Before changing any code:

1. Inspect the project directory structure, package.json, Next.js configuration, routing, layouts, authentication, middleware, permissions, Supabase configuration, Dexie database, offline mechanisms, navigation, UI components, and design system.
2. Identify the actual routes, modules, permissions, and features that currently exist.
3. Identify any existing help, notification, search, chat, or reusable interface components.
4. Determine the correct location for the Ask MediFlow IQ page, components, help data, and search engine.
5. Review the current implementation and preserve established architectural patterns.
6. Create a concise implementation plan based on the actual codebase.

Do not assume that a feature or route exists simply because it is listed in this prompt. Use actual application code as the source of truth.

Do not replace the existing application architecture or introduce a second authentication system.

## 3. BUILD THE ASK MEDIFLOW IQ INTERFACE

Create a polished, responsive, professional help portal that feels like an intelligent software assistant.

The interface should include:

- A clear Ask MediFlow IQ title and assistant identity.
- A modern chat-style question input.
- A send button and Enter-to-submit behavior, with Shift+Enter for a new line where applicable.
- A conversation area with distinct user and assistant messages.
- A typing or searching indicator while processing a question.
- Suggested questions and clickable example prompts.
- Relevant follow-up questions.
- Related help articles.
- Clear step-by-step answers with readable headings, lists, warnings, and navigation links.
- Helpful and unhelpful feedback controls.
- A way to clear or start a new conversation.
- A friendly response when the system cannot find a reliable answer.
- Accessible keyboard navigation, focus indicators, and appropriate labels.
- Loading, empty, error, and offline states.

Design the interface using the existing MediFlow IQ design system. Maintain consistent branding, typography, spacing, colors, buttons, icons, borders, and responsive behavior.

The assistant must work well on mobile phones, tablets, laptops, and desktop screens.

Do not redesign the main dashboard or change the global layout unnecessarily.

## 4. IMPLEMENT A MULTI-TECHNIQUE QUESTION-ANSWERING ENGINE

Combine the following techniques into one modular, maintainable system.

### A. Structured knowledge base

Create a well-organized, typed knowledge base containing:

- Unique article ID.
- Module name.
- Article title.
- Common questions.
- Alternative question phrasings.
- Keywords and synonyms.
- Prerequisites.
- Numbered instructions.
- Troubleshooting information.
- Related questions and articles.
- Relevant application route, when verified.
- Relevant permission requirements, where necessary.
- Last-reviewed metadata where appropriate.

Store initial help content in a maintainable local TypeScript or JSON structure, unless an existing project architecture provides a better option.

Do not hardcode the entire knowledge base inside a single React component.

Populate the knowledge base with accurate instructions based on the actual implementation of MediFlow IQ. Inspect real pages, forms, services, validation rules, and workflows before documenting them.

Do not claim that an operation exists unless it is implemented or explicitly label it as unavailable or planned.

### B. Text normalization

Implement a reusable question-normalization utility that handles:

- Uppercase and lowercase differences.
- Leading and trailing whitespace.
- Repeated spaces.
- Common punctuation differences.
- Common typing mistakes where practical.
- Common abbreviations.
- Singular and plural variations where practical.
- Common pharmacy and drug-shop terminology.

Preserve important technical terms, product names, codes, and numbers.

### C. Synonym and keyword matching

Support different ways of asking the same question.

For example:

- "How do I sell medicine?"
- "How do I make a sale?"
- "How do I use the POS?"
- "How can a cashier complete a transaction?"

These should match the appropriate POS help content if the actual application supports that workflow.

Create reusable synonym groups for terms such as POS, checkout, sale, stock, inventory, batch, expiry, supplier, purchase, return, user, report, and cash session.

Use configurable synonym mappings rather than scattering keyword conditions throughout the application.

### D. Relevance scoring and ranking

Implement a transparent, deterministic matching engine.

Use a combination of:

- Exact question matches.
- Normalized phrase matches.
- Title matches.
- Keyword matches.
- Synonym matches.
- Important-term overlap.
- Article relevance.
- Current module context.

Assign appropriate weights to these signals and rank the most relevant articles.

Use confidence thresholds to distinguish reliable matches from weak matches.

Avoid returning the first article that happens to share one common word.

When multiple articles are relevant, return a short, useful answer with links to the most relevant additional articles.

### E. Searchable documentation

Allow the assistant to search across all indexed help articles.

Use in-memory or local indexed search for the initial implementation. If PostgreSQL full-text search or another existing search service would materially improve the result, use it only if compatible with the current architecture.

Do not introduce unnecessary infrastructure.

Where useful, extract and index approved documentation describing the actual application's behavior.

Keep search results grounded in the indexed content.

### F. Guided troubleshooting and decision trees

Implement structured troubleshooting flows for common application problems.

Examples include:

- A medicine cannot be found in POS.
- A product cannot be added.
- A sale cannot be completed.
- The system reports insufficient stock.
- A batch is expired or unavailable.
- A user cannot access a module.
- A purchase cannot be recorded.
- Offline changes are not synchronizing.
- A report appears empty.
- A receipt cannot be accessed.

Use selectable follow-up questions and options to narrow down the problem.

Only show troubleshooting paths that are relevant to the actual application's behavior. Do not invent error codes or promise automatic repairs.

The system must never silently perform a financial, inventory, permission, or account-changing operation merely because a user asks a help question.

### G. Related questions

After answering a question, suggest useful next questions based on the matched article and its related content.

For example, after explaining how to complete a sale, possible follow-ups include viewing a receipt, handling a permitted sale return, or understanding payment methods, provided those workflows exist.

## 5. CONTEXT-AWARE ASSISTANCE

Make the assistant aware of the user's current application context.

When the user opens Ask MediFlow IQ from the POS page, prioritize POS-related help. When opened from Inventory, prioritize inventory-related content.

Implement contextual help without tightly coupling the search engine to individual pages.

Where appropriate, support an "Ask about this page" action or a contextual help button on existing modules.

Use verified internal routes for navigation links.

Respect the existing navigation structure, account state, organization, branch, and permissions.

Never expose another organization's or branch's private information through the assistant.

Do not add unnecessary UI elements to every page. Integrate contextual assistance where it is genuinely useful and consistent with the existing design.

## 6. ANSWER GENERATION WITHOUT AN AI MODEL

Construct answers from approved help content using deterministic templates.

The response renderer should support:

- A concise introductory explanation.
- Numbered steps.
- Prerequisites.
- Important warnings.
- Troubleshooting steps.
- Relevant internal links.
- Related questions.

When multiple articles match, combine their information only when the content is relevant and consistent.

Do not fabricate steps or combine unrelated articles merely to produce a longer answer.

Clearly distinguish verified current functionality from unavailable functionality or planned features.

Use language that is helpful and natural, but do not claim that a human or AI model is thinking, learning, or understanding beyond the actual programmed capabilities.

## 7. STRICT TOPIC RESTRICTION

Ask MediFlow IQ is a software-support assistant, not a general-purpose chatbot.

It should answer questions about MediFlow IQ and how to operate its implemented features.

Examples of supported questions:

- How do I add a product?
- How do I record a purchase?
- How do I complete a POS sale?
- How do I view stock levels?
- How do I check expiry dates?
- How do I generate a report?
- Why might I be unable to access a page?
- How do I work with the application offline?

Examples of unsupported questions:

- General trivia.
- Political discussions.
- Unrelated coding questions.
- General entertainment questions.
- Questions unrelated to MediFlow IQ.

When a question is unrelated or no reliable match exists, respond politely:

"I'm designed to help you use MediFlow IQ. I couldn't find a reliable answer to that question in the available help content. Try asking about POS, Products, Inventory, Purchases, Reports, or another MediFlow IQ feature."

Where appropriate, suggest a relevant help category.

Do not use an exact keyword match alone to bypass topic restrictions. For example, an unrelated question that happens to mention the word "stock" should not automatically receive an inventory answer.

Use a confidence threshold, relevance checks, and an explicit fallback.

## 8. LIVE APPLICATION DATA QUESTIONS

Distinguish documentation questions from questions requiring current application data.

Examples:

- "How do I check low stock?" is a documentation question.
- "Which products are currently low in stock?" requires live application data.

For the initial implementation, documentation questions must work without database access.

For live-data questions, implement support only when an appropriate, existing, authorized query can be safely reused. Otherwise, explain that the assistant can explain how to find the information in the application.

If live-data assistance is implemented:

- Use existing Supabase clients and services.
- Apply the current authenticated user's organization, branch, and role restrictions.
- Use server-side authorization for protected data.
- Never trust a client-provided organization ID or branch ID without authorization.
- Never expose service-role credentials or privileged database access to the browser.
- Use read-only queries for informational answers.
- Never invent stock quantities, expiry dates, balances, sales totals, or other figures.
- Respect offline state and clearly identify whether an answer uses current local data or server data.
- Do not bypass Row Level Security.

Do not expand this task into an unrestricted natural-language-to-SQL system.

## 9. OFFLINE-FIRST FUNCTIONALITY

MediFlow IQ prioritizes offline usability. Ask MediFlow IQ must follow the existing offline architecture.

Requirements:

- Keep essential help articles available offline.
- Make local question matching and answer generation work without an internet connection.
- Cache static help content using an appropriate existing mechanism.
- Integrate with existing Dexie or service-worker functionality only where appropriate.
- Avoid duplicate service workers or competing offline caches.
- Do not overwrite or weaken existing caching rules.
- Do not create unnecessary synchronization queues for static help articles.
- Display a clear offline indicator where useful.
- Continue working when network requests fail.
- Never claim that a live-data answer is current when the data could not be verified.

The core documentation assistant must not depend on Supabase being reachable.

## 10. SECURITY AND PERMISSIONS

Preserve existing authentication, middleware, route protection, role-based access control, and Supabase Row Level Security.

The help assistant must not become a route for bypassing application permissions.

Requirements:

- Respect existing authenticated and unauthenticated route policies.
- Use only internal links that have been verified against the actual application.
- Do not expose secrets, environment variables, private records, or audit data.
- Do not display privileged help actions to users who lack the corresponding permission.
- Do not modify user roles or permissions.
- Do not execute database writes from help article rendering.
- Sanitize and safely render message content.
- Do not render raw HTML from user input.
- Prevent unsafe external links.
- Keep feedback storage optional and compatible with the existing architecture.

Do not introduce a new permission system when the application already has one.

## 11. CONVERSATION AND PERFORMANCE

Implement lightweight conversation state that allows the assistant to reference the immediate help context when generating relevant follow-up suggestions.

Avoid pretending to support unrestricted conversational memory.

Use a sensible limit on stored conversation messages and prevent unbounded browser storage growth.

Persist conversation history only if appropriate for the existing product design. If implemented, provide a clear way to clear it and ensure that private data is not accidentally shared across accounts or sessions.

Optimize question matching for speed. Cache normalized article indexes where useful.

Avoid unnecessary database requests, excessive rerenders, and expensive processing on every keystroke.

Do not install a large dependency solely for functionality that can be implemented reliably with the existing stack.

## 12. USER FEEDBACK AND ADMINISTRABILITY

Allow users to mark an answer as helpful or not helpful.

If feedback is stored, use an appropriate existing persistence mechanism and follow the project's security conventions.

Do not make feedback submission mandatory for using the assistant.

Structure help articles so that developers can add, update, and review content easily.

Do not build a large administrative content-management system unless the project already has a suitable feature to extend.

## 13. TESTING REQUIREMENTS

Add appropriate unit tests and integration tests using the project's existing test framework, if available.

At minimum, test:

1. Exact question matching.
2. Alternative phrasings and synonyms.
3. Case-insensitive matching.
4. Common misspellings.
5. Correct ranking when several articles share keywords.
6. Low-confidence questions.
7. Completely unrelated questions.
8. Empty input and whitespace-only input.
9. Unsupported or nonexistent features.
10. Correct internal navigation links.
11. Context-aware prioritization.
12. Offline question matching.
13. Safe rendering of user input.
14. Permission-sensitive help links.
15. Graceful handling of missing or malformed help content.
16. Live-data access restrictions if live-data assistance is implemented.

Include test examples such as:

- "How do I use POS?"
- "How can I sell a product?"
- "How do I add a new medicine?"
- "How can I check expired stock?"
- "How do I record a supplier purchase?"
- "Why can't I access Reports?"
- "What is the capital of France?"
- "Tell me a joke."

The first six should receive relevant software-support answers when the documented workflows exist. The last two should be rejected as outside the assistant's scope.

Do not make tests pass by returning the same generic response to every question.

## 14. IMPLEMENTATION SAFETY — DO NOT BREAK EXISTING FEATURES

This is a non-negotiable requirement.

- Do not rewrite the entire application.
- Do not replace existing dashboard pages or navigation.
- Do not rename existing routes, database tables, columns, services, or environment variables unnecessarily.
- Do not change the database schema unless absolutely necessary and explicitly justified.
- Do not remove existing functionality.
- Do not replace existing POS transaction logic, inventory calculations, financial logic, or offline synchronization.
- Do not weaken authentication, authorization, or RLS policies.
- Do not introduce a second Supabase client architecture.
- Do not replace existing UI libraries or design systems.
- Do not make unrelated formatting or refactoring changes.
- Do not overwrite existing files blindly.
- Prefer new isolated modules and minimal integration changes.
- Preserve existing coding conventions and file organization.
- If a requested integration conflicts with an existing implementation, adapt to the existing implementation instead of breaking it.
- Do not expose secrets or print environment variable values in reports.

Before modifying a file, understand its existing responsibilities and dependencies.

If a database migration is genuinely required, explain why and keep it minimal. Prefer a first version that works without any database migration.

## 15. BUILD, LINT, AND REGRESSION CHECKS

After implementation:

1. Run the available TypeScript checks.
2. Run the existing lint command.
3. Run relevant unit and integration tests.
4. Run the production build.
5. Fix issues introduced by this implementation.
6. Check that the new route works with existing authentication and navigation.
7. Verify mobile responsiveness.
8. Verify that the help engine still works with the network disconnected.
9. Review the Git diff for unrelated or destructive changes.

Do not hide errors by disabling TypeScript checks, ESLint rules, build checks, or tests.

Do not modify unrelated legacy code merely to make the new feature appear clean. Clearly report any pre-existing failures separately.

Do not claim that a test or build passed unless it actually completed successfully.

## 16. DELIVERABLES

Implement the complete working feature, not merely a mockup or a plan.

The final implementation should include:

- A functional Ask MediFlow IQ interface.
- A reusable question-matching engine.
- A structured and extensible knowledge base.
- Keyword and synonym matching.
- Relevance scoring and confidence thresholds.
- Searchable help documentation.
- Guided troubleshooting.
- Related questions.
- Context-aware help.
- A safe unsupported-question fallback.
- Offline documentation search and answers.
- Permission-aware navigation.
- Feedback controls where feasible.
- Automated tests appropriate to the project.
- Minimal, safe integration into the existing application.

After completing the work, provide a concise implementation report containing:

1. Files created.
2. Existing files modified.
3. How question matching works.
4. Which modules have documented help content.
5. How offline functionality works.
6. How security and permissions are preserved.
7. Tests and build commands executed, with actual results.
8. Any limitations or unfinished work.

**FINAL INSTRUCTION:** Start by inspecting the existing codebase, then implement the feature in small, safe steps. Do not stop after producing a plan or interface mockup. Finish the implementation, test it, and report exactly what works. Preserve all existing MediFlow IQ functionality. No external AI APIs, no paid AI services, and no unnecessary infrastructure.