# Halberd & Co — Operational Bottlenecks

Each bottleneck below is a place where rote work queues behind the people whose judgment is
the actual product. Every one maps to exactly one workflow. The pattern repeats: the agent
does the parsing/matching/drafting, the human keeps the decision.

---

## 1. Quote latency → loses loads

**The pain.** A shipper emails an RFQ — "need a dry van, Fresno → Dallas, pickup Thursday."
In FTL brokerage, the broker who quotes **first and credibly** usually wins the load. But
quoting means a human reads the email, figures out the lane and equipment, digs through past
loads for a comparable rate, writes a reply, and opens a deal. During a busy morning that's
20–40 minutes per RFQ, and loads go to whoever answered faster.

**The cost.** Win-rate on inbound RFQs is gated by response time, not by price. Slow quotes
are silent lost revenue.

**Workflow:** [Quote Desk](workflows/quote-desk.md) — parse the RFQ, anchor a rate from lane
history, draft the quote in seconds; the broker approves or nudges the number and it sends.
**ROI:** faster first-response → higher inbound win-rate; sales desk time reclaimed for
relationship work.

---

## 2. Pipeline leakage → dormant shippers go quiet

**The pain.** Shippers tender in bursts, then go quiet. A customer who moved eight loads a
month last quarter and zero this month rarely gets noticed until the monthly review — nobody
on a six-person desk has time to systematically watch for fade. The same is true of carriers
who used to be reliable and drifted.

**The cost.** Revenue that was already won leaks out the back because no one followed up in
time.

**Workflow:** [Shipper Reactivation](workflows/shipper-reactivation.md) — a scheduled sweep
flags accounts with no tender in N weeks and drafts a tailored re-engagement referencing
their past lanes and a fresh rate. The broker approves or skips.
**ROI:** recovered tender volume from existing relationships — the cheapest revenue there is.

---

## 3. Reporting blind spots → leadership flies blind

**The pain.** The numbers that run the business — loads moved, gross margin per lane, on-time
percentage, carrier scorecards, AR aging — live scattered across Airtable and QuickBooks.
Compiling the Friday picture is a manual, error-prone chore, so it's done late, partially, or
not at all between month-ends.

**The cost.** Decisions about pricing, capacity, and collections are made on stale or
incomplete data.

**Workflow:** [Weekly Margin & Ops Digest](workflows/weekly-margin-digest.md) — assembles the
weekly digest from Airtable + QuickBooks into a draft; leadership reviews and approves before
it posts to Slack.
**ROI:** consistent weekly visibility; management time redirected from spreadsheet wrangling
to acting on the numbers.

---

## 4. Manual document matching → cash leaks and slow settlement

**The pain.** Every load generates a paper trail — rate confirmation, BOL, proof of delivery,
and the carrier's invoice. Back office matches the carrier invoice against the rate con and
POD by hand, looking for mismatches (carrier billed more than the agreed rate, missing POD,
wrong load number). It's slow, and overbilling slips through when the desk is buried.

**The cost.** Margin erosion from unreconciled overbilling, plus slow carrier settlement and
delayed customer invoicing — a direct hit to cash conversion.

**Workflow:** [Carrier Invoice Reconciliation](workflows/carrier-invoice-reconciliation.md) —
extracts fields from each document, matches them to the load, runs an FMCSA check, and either
auto-passes clean matches (above the confidence floor) or flags exceptions for a human to
clear.
**ROI:** caught overbilling, faster settlement, and back-office time spent on real exceptions
instead of clean paperwork.

---

## Why HITL and not full automation

None of these get handed fully to a machine. A wrong quote loses money; a tone-deaf
reactivation email burns a relationship; a misread invoice mispays a carrier. The value is in
removing the **rote 80%** while preserving human judgment on the **decision** — which is
exactly what the review console is built for. The `confidenceFloor` on each workflow tunes how
much auto-passes versus how much lands in the human queue.
