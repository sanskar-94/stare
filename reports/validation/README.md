# Validation kit: the items left before the final review (23 November 2026)

These are the open items from the Milestone-2 report (Section 10.7 and Table 50). Each one needs people, so the
files here make them quick to run and record.

| Item (Table 50) | Owner | File | Time needed |
|---|---|---|---|
| 4. Team review of the gold questions and the support-review verdicts | Adarsh (all review) | `gold-set-review.csv`, `support-verdicts-review.csv` | about 2 hours, split four ways |
| 5. Usability check with the four personas (NFR-07) | Rahul | `usability-check-NFR-07.md` | about 25 minutes per participant |
| 6. Feedback on a sample memo from a lawyer or law-faculty member | All | `lawyer-review-form.md` + `sample-memo-ndtex-title7.docx` | about 20 minutes for the reviewer |
| 8. Demonstration video | All | `../STARE MVP demo (captioned).webm` | done: a captioned 79-second walkthrough recorded from the app on the 5,120-opinion corpus; record a narrated version if the course needs one |

## How to do each one

**Gold set and support verdicts.** Open the two CSV files in Excel or Google Sheets. Split the rows between the four
of you. For each gold question, check that the question is sensible and that the expected authority is the leading
case for it (fill `question_ok`, `expected_citations_ok`). For each support verdict, read the quoted passage and say
whether you agree with the S / P / N verdict that the development assistant gave (definitions are in
`docs/evaluation/support_review.md`). Disagreements change the reviewed citation accuracy (0.986): recount it from
the `team_verdict` column.

**Usability check.** Follow `usability-check-NFR-07.md` with four people who have not used STARE. It contains the
script, nine tasks, a results sheet and the SUS questionnaire.

**Lawyer feedback.** Send `lawyer-review-form.md` (or a PDF of it) and `sample-memo-ndtex-title7.docx` to a lawyer
or a law-faculty member, for example through the university's law school. The memo is about a fictional complaint,
so no client data is shared.

## Where the results go

Summarise the outcomes in the final report: Section 6.5 (support review), Table 7 NFR-07 (usability), and
Sections 7.3 and 7.4 (lawyer feedback). If an item cannot be done before 23 November, say so in Section 7.3.
