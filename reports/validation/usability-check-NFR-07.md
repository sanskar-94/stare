# Usability check with the four personas (NFR-07)

**Requirement (NFR-07):** a new user can complete a research run without training, using on-screen guidance only.
**Owner:** Rahul Yadav (RACI). **When:** before the final review on 23 November 2026. **Time:** about 25 minutes per
participant.

## Who to test with

Recruit at least four people who have **not** used STARE before, one per persona. Fellow students are fine; a
law student or anyone who has worked in an office is better for the attorney and paralegal roles.

| Persona (proposal Table 8) | Log in as | Tasks |
|---|---|---|
| Kevin Lee, paralegal | `paralegal@stare.local` | T1, T2, T3, T7 |
| Daniel Ortiz, solo attorney | `attorney@stare.local` | T3, T4, T5, T6 |
| Aisha Brooks, legal-aid attorney | `attorney@stare.local` | T3, T4, T5, T8 |
| Linda Park, managing partner | `admin@stare.local` | T9 |

The password for all three accounts is `stare-demo`. Sample complaint: `data/samples/complaint_ndtex_title7_retaliation.pdf`.

## Before each session

1. Start the app (`cd ~/Stare/backend && .venv/bin/stare serve`, then `cd ~/Stare/frontend && npm run dev`) and open
   http://localhost:5173.
2. Read the participant this script: "This is a research assistant for lawyers. Please do each task using only what
   you see on the screen. Think aloud. We are testing the software, not you." Give no other help.
3. Time each task. If the participant is stuck for 2 minutes, note it as a failure and show them the way.

## Tasks

| # | Task given to the participant | Success means |
|---|---|---|
| T1 | Create a new matter for a federal court in Texas. | Matter created with N.D. Tex. selected |
| T2 | Upload the sample complaint and check what was hidden. | Upload done; participant points to a redacted name |
| T3 | Start a research run. | Run reaches the plan approval step |
| T4 | Read the research plan, remove one question you think is not needed, and approve it. | Plan approved with one item unticked |
| T5 | Find one source that hurts the client and say why it matters. | Opens the Adverse tab and a source card |
| T6 | Approve the memo and download it as a Word file. | DOCX downloaded |
| T7 | (Paralegal) Try to export the memo. | Participant sees that only an attorney can export |
| T8 | Paste the Mata v. Avianca example on "Check a draft" and say which cases are fake. | Names the blocked and unresolved citations |
| T9 | (Admin) Find who approved the last memo and when. | Finds the entry in the audit log |

## Results sheet

| Participant | Persona | Task | Success (Y/N) | Time (s) | Errors / help needed | Comment |
|---|---|---|---|---|---|---|
| | | | | | | |

## After each session: System Usability Scale (SUS)

Ask the participant to rate each statement from 1 (strongly disagree) to 5 (strongly agree).

1. I think that I would like to use this system frequently.
2. I found the system unnecessarily complex.
3. I thought the system was easy to use.
4. I think that I would need the support of a technical person to be able to use this system.
5. I found the various functions in this system were well integrated.
6. I thought there was too much inconsistency in this system.
7. I would imagine that most people would learn to use this system very quickly.
8. I found the system very cumbersome to use.
9. I felt very confident using the system.
10. I needed to learn a lot of things before I could get going with this system.

**Score:** for odd items subtract 1 from the rating; for even items subtract the rating from 5. Add the ten results
and multiply by 2.5 (range 0–100). A score of 68 or more is above average.

## Pass criterion for NFR-07

NFR-07 is met if every participant completes T3–T6 (or their persona's tasks) without help and the mean SUS score is
68 or more. Record the outcome in the final report (Table 7, NFR-07) and list any usability problems found.
