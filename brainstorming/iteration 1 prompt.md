Several changes reflecting the product's deployment model: each client gets a dedicated, customized instance of this console. The instance represents one company — there is no multi-tenant switching.

**Dashboard changes:**

1. **Remove the workspace switcher entirely** from the left nav. Delete it — don't relocate anything from it.

2. **Replace the "UPS / CONSOLE" header (top-left) with the client company's identity.** It should read "[Company Name] / Console" — for the seeded example, "Halberd Co / Console". The bracket mark stays. This header now represents the CLIENT whose instance this is, not the studio that built it. Keep this as a clearly configurable value since each deployment sets its own.

3. **Update the breadcrumb** in the main panel: since the company name now appears in the top-left header, drop the leading company segment from the breadcrumb. Change "halberd-co / workflows / invoice-reconciler" to "workflows / invoice-reconciler".

**Login page changes:**

4. **Replace the "UPS / CONSOLE" header with the client company's identity** — "Halberd Co / Console" for the seeded example — and **remove the secondary line beneath it entirely.** Just the bracket mark and the "[Company Name] / Console" header, nothing under it.

**Branding note:** this is a white-label client instance — the client's name leads throughout. Do NOT put The Leverage Workshop or any builder branding anywhere in the app, including the login page. Keep the company name as a clearly configurable value so the template can be forked per client.