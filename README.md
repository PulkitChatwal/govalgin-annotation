# GovAlign Annotation Platform

A web-based annotation tool for the **GovAlign** research project. Human annotators verify and label AI governance compliance prompts across 7 countries to build a high-quality dataset for studying AI alignment with global regulations.

## Countries covered

| Flag | Country | Primary language(s) |
|------|---------|---------------------|
| 🇮🇳 | India | Hindi, Bengali, Telugu, Tamil, Marathi, English |
| 🇨🇳 | China | Mandarin Chinese |
| 🇧🇩 | Bangladesh | Bengali |
| 🇧🇬 | Bulgaria | Bulgarian |
| 🇳🇬 | Nigeria | English, Yoruba, Hausa, Igbo |
| 🇪🇬 | Egypt | Arabic |
| 🇸🇦 | Saudi Arabia | Arabic |

## What annotators do

Each annotator signs in with Google, selects the countries they want to work on, then reviews prompts one at a time. For every prompt they answer four questions:

**Q1 — Law article accuracy**
Does the cited law article actually exist and is it accurately described?
- Yes / Partially / No, with optional notes

**Q2 — Field alignment**
Five yes/no checkboxes: does each field (law article, compliance dimension, prompt text, expected behavior, violation type) make sense on its own and fit with the others? Notes optional.

**Q3+Q4 — Difficulty × Implicitness**
A 2x2 grid capturing how hard the annotation is and whether the risk is obvious or hidden:
- **Easy** = the risk is obvious even without reading the law
- **Hard** = the risk only becomes clear after reading the expected behavior
- **Explicit** = the prompt openly asks about a restricted activity
- **Implicit** = the prompt doesn't signal it's asking for something risky

## Annotation flow

1. **Login** — click "Sign in with Google" on the landing page.
2. **Select countries** — pick one or more from the 7-country list. You can change this later.
3. **Annotate** — the main screen shows one prompt at a time. Read the prompt (in its native language, rendered right-to-left for Arabic and Bengali), then answer Q1–Q4. Click **Save & Next** to submit and move on.
4. **Skip** — if you're unsure, skip without saving. The prompt stays in your queue.
5. **Previous** — go back to your last saved annotation to review or edit it.
6. **Progress** — per-country counters show how many prompts you've completed.

## Admin features

The admin panel (accessible only to the project lead) has four tabs:

1. **Upload Dataset** — upload a CSV of prompts for any country. The system validates columns and merges with existing data. You can also view per-country counts and delete individual prompts or wipe an entire country's dataset.
2. **Upload Law Documents** — attach PDF law documents (or external links) to a country so annotators can reference them while working.
3. **Annotator Management** — view all annotators, their assigned countries, and annotation counts. Edit their country assignments, soft-remove (revoke access), or hard-delete (remove user and all their data).
4. **Export Annotations** — download all annotations as CSV, either for all countries combined or one country at a time. The dashboard shows summary statistics including per-country completion rates and simple inter-annotator agreement scores.

## Dataset format

Prompts are stored in a Supabase PostgreSQL database. Each prompt has:

| Field | Description |
|-------|-------------|
| `prompt_id` | Unique ID (e.g. `DPDPA-CONSENT-023`) |
| `country` | One of the 7 countries |
| `jurisdiction` | Legal framework name |
| `law_article` | Specific article or section cited |
| `compliance_dimension` | What aspect of compliance it tests |
| `prompt_text` | The actual prompt (in the country's native language) |
| `expected_behavior` | What a compliant AI should do (shown after reading the prompt) |
| `violation_type` | What kind of violation this tests |
| `language` | Language of the prompt text |

## Tech stack

- **Frontend:** React 18 + Vite + React Router v6, plain CSS
- **Backend:** Supabase (PostgreSQL, Auth, Storage)
- **Hosting:** GitHub Pages
- **Scripts:** Python (`supabase-py`, `papaparse`)
