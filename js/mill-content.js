// Token Mill — crate bank. Pure data (browser: window.MILL_CONTENT, Node: require()).
// Teaches RUNNING AI RESPONSIBLY IN PRACTICE: classify, route and respond (the Glass Bridge teaches using AI at work, House Rules Carrom understanding it, Token Tower building it,
// Spot Shot spotting fakes).
//
// SAMPLE POLICY: the policies in every brief are a SAMPLE house policy written for this game. Calfus security or legal must replace and approve them before release.
//
// Concept:  { id, side, title, idea, stamps: { lax, strict }, variants: [...] }       ids are prefixed M (MD, MR, MC, MI, MF) so they never collide with the bridge's T1..B3, carrom's C*,
//           the tower's J* or spot shot's X*. A side has four concepts (four lessons); the finale (MF1) has no crates of its own: its four waves draw from the four sides.
// Variant:  { id, params, brief, bins, items: [6 items], sample: true }               brief = the sample policy (the same for every variant of a side: a shift runs under one policy);
//           bins = four { id, label, legend } ordered by rank 0 (most permissive) .. 3 (most strict). Every variant has 2 twin pairs, 1 clear crate and 1 trap crate.
// Item:     { id, kind, cue?, text, chips, full, bin, tell, laxStamp, strictStamp, confidence?, stakes?, missing?, outputRight? }
//           kind: "clear", "trap" (the surface cues point the wrong way) or "twin" (it shares a surface cue, cue, with one crate of a different correct bin in its variant).
//           text = the tag card (70 chars); chips = up to two short chips; full = what the reading panel shows; tell = the one-line reason; laxStamp / strictStamp = the stamps for a bin
//           that is too lax / too strict (a concept default unless the item sets its own). Side 3 crates also carry confidence, stakes ("low" | "medium" | "high"), missing and outputRight
//           (the model's output was in fact right: the hidden truth shown after an AUTO-SEND).
// The correct bin is derivable from the brief plus the crate's own text and chips, never from outside knowledge (gallery-style checks in mill-tests.js enforce the side 3 rule in code).
// Limits (enforced by mill-tests.js): text <= 70, chip <= 14 (at most 2), full <= 160, tell <= 90, stamp <= 18, bin label <= 14, bin legend <= 40, brief <= 260 chars (about 6 s to read);
// invented names and the reserved .example domain only.
(function (root) {
  const LIMITS = { text: 70, chip: 14, chips: 2, full: 160, tell: 90, stamp: 18, label: 14, legend: 40, brief: 260, minVariants: 4, minItems: 16, itemsPerVariant: 6 };

  const SAMPLE_NOTICE = 'SAMPLE POLICY: written for this game. Calfus security or legal must replace and approve it before release.';

  // zone = the answer-slot colour the other games use for this lesson (amber, green, cyan, rose); the finale is gold
  const B = (id, label, legend) => ({ id, label, legend });
  const SIDES = {
    doors: { name: 'Data doors', zone: 'amber', bins: [B('public', 'PUBLIC AI', 'Already public data only'), B('approved', 'WORKSPACE', 'Approved workspace: business data'), B('internal', 'INTERNAL ONLY', 'Client-confidential, contract-limited'), B('noai', 'NO AI', 'Regulated personal data, credentials')],
      brief: 'Public AI: only data already public. Approved workspace: internal business data. Internal only: client-confidential and contract-restricted. No AI: regulated personal data and credentials.' },
    tiers: { name: 'Risk tiers', zone: 'green', bins: [B('auto', 'RUN AUTO', 'Low stakes, easy to undo'), B('spot', 'SPOT-CHECK', 'Moderate stakes, high volume'), B('review', 'REVIEW EACH', 'Money or customers; desk holds 6'), B('human', 'HUMAN DECIDES', 'A person\'s job, pay, health, rights')],
      brief: 'Run auto: low stakes, easy to undo. Spot-check: moderate stakes, high volume. Review each: touches money or customers, hard to undo (the desk holds 6 a shift). Human decides: a person\'s job, pay, health or rights.' },
    checks: { name: 'Confidence and checks', zone: 'cyan', bins: [B('send', 'AUTO-SEND', 'Low stakes: send it'), B('quick', 'QUICK CHECK', 'Medium stakes, or low confidence'), B('expert', 'EXPERT REVIEW', 'High stakes: money, legal, people'), B('ask', 'ASK DETAILS', 'Information is missing: ask')],
      brief: 'Stakes set the check: low = auto-send, medium = quick check, high (money, legal, people) = expert review. Confidence under 0.60 moves the check one step stricter. Missing information = ask. Confidence is the model\'s own score and can be wrong.' },
    incidents: { name: 'Incident response', zone: 'rose', bins: [B('retry', 'RETRY', 'Brief and rare'), B('takeover', 'HUMAN TAKEOVER', 'Will not fix itself soon'), B('rollback', 'ROLL BACK', 'Broke right after a change'), B('stop', 'STOP & REPORT', 'Exposure, harm, runaway cost')],
      brief: 'Retry: brief and rare. Human takes over: it won\'t fix itself soon. Roll back: it broke right after a change. Stop & report: data exposure, harm or runaway cost.' },
    rush: { name: 'Rush hour', zone: 'gold', bins: null, brief: '' },
  };
  const SIDE_IDS = ['doors', 'tiers', 'checks', 'incidents'];

  // one crate: K(bin, kind, cue, text, chips, full, tell, extras). A twin's cue names what it shares with its partner.
  const K = (bin, kind, cue, text, chips, full, tell, o) => Object.assign({ kind, cue: cue || null, text, chips, full, bin, tell }, o);
  const V = (id, params, side, items) => ({ id, params, brief: SIDES[side].brief, bins: SIDES[side].bins, sample: true, items: items.map((it, i) => Object.assign({ id: id + '.' + (i + 1) }, it)) });
  const Cn = (id, side, title, idea, stamps, variants) => ({ id, side, title, idea, stamps, variants });

  // ================================================================ SHIFT 1 · DATA DOORS
  const DOORS = [
    Cn('MD1', 'doors', 'Public means already public', 'Public AI is only for data that is already public; a draft or a private mail is not, however harmless it sounds.', { lax: 'NOT PUBLIC YET', strict: 'OVER-LOCKED' }, [
      V('MD1a', { client: ['Harlow', 'Brightmoor', 'Kestrel'] }, 'doors', [
        K('public', 'clear', null, 'Published press release, to proofread for typos', ['PUBLISHED', 'ONLINE'], 'The final release is on our website. We want a proofread for typos before the translation goes out.', 'Already public.'),
        K('internal', 'trap', null, 'Blog draft quoting {client}\'s revenue figures', ['DRAFT'], 'A draft post for next week. It quotes {client}\'s own revenue figures, taken from their report to us.', 'A draft is not public, and the figures are the client\'s.', { laxStamp: 'CLIENT FIGURES OUT' }),
        K('public', 'twin', 'client', 'Case study naming {client}, published last year', ['PUBLISHED', 'ONLINE'], 'The case study has been on our site for a year, with {client}\'s approval. We want a shorter version.', 'Twin: same client name, but already public.'),
        K('internal', 'twin', 'client', 'Email thread with {client} about a late payment', ['CLIENT'], 'A private email thread with {client}\'s finance team about an overdue invoice and a payment plan.', 'Twin: same client name, but client-confidential.', { laxStamp: 'CLIENT MAIL OUT' }),
        K('public', 'twin', 'release', 'Our announcement already live on the newsroom page', ['PUBLISHED', 'ONLINE'], 'The announcement went live this morning. We want three social-post versions of it.', 'Already public.'),
        K('approved', 'twin', 'release', 'Draft announcement, embargoed until Friday', ['UNPUBLISHED'], 'The draft names no client and has no personal data, but it is not public until Friday.', 'Not public yet, but plain business data.', { laxStamp: 'LEAKED EARLY' }),
      ]),
      V('MD1b', { client: ['Harlow', 'Brightmoor', 'Kestrel'] }, 'doors', [
        K('public', 'clear', null, 'Live product page text, for a style and tone check', ['PUBLISHED'], 'The text is on the live product page. We want a style check and a shorter headline.', 'Live on the site: already public.'),
        K('internal', 'trap', null, 'Published case study plus {client}\'s unpublished price list', ['PUBLISHED', 'CLIENT'], 'The case study is public, but the attachment is {client}\'s own price list, never published.', 'The attachment is client-confidential, even if the case study is public.', { laxStamp: 'CLIENT PRICES OUT' }),
        K('public', 'twin', 'job ad', 'Job ad posted on our careers page, for tone', ['PUBLISHED'], 'The ad is live on the careers page. We want a friendlier tone for the second version.', 'Already public.'),
        K('approved', 'twin', 'job ad', 'Internal job description draft with the salary band', ['INTERNAL'], 'A draft description with a salary band, not posted anywhere, and no names or personal data.', 'Not posted yet: internal business data.', { laxStamp: 'BAND LEAKED' }),
        K('approved', 'twin', 'roadmap', 'Product roadmap slide for next quarter, not announced', ['UNANNOUNCED'], 'A slide of planned features for next quarter, not announced to anyone outside.', 'Not public, but plain business data.', { laxStamp: 'ROADMAP LEAKED' }),
        K('public', 'twin', 'roadmap', 'Roadmap summary we already shared at the public webinar', ['PUBLISHED'], 'The summary was shown at last month\'s public webinar and is on the recording page.', 'Already public.'),
      ]),
      V('MD1c', { client: ['Harlow', 'Brightmoor', 'Kestrel'] }, 'doors', [
        K('public', 'clear', null, 'Talk slides already posted online', ['PUBLISHED'], 'The slides are on the conference site, free to download. We want a shorter abstract.', 'Already public.'),
        K('internal', 'trap', null, 'Published blog post with {client}\'s private feedback pasted below', ['PUBLISHED', 'CLIENT'], 'The post is public, but the pasted feedback is {client}\'s private note to us.', 'The pasted part is client-confidential.', { laxStamp: 'CLIENT NOTE OUT' }),
        K('public', 'twin', 'faq', 'Public FAQ page, to simplify it', ['PUBLISHED'], 'The FAQ is live on our help centre. We want shorter answers.', 'Already public.'),
        K('internal', 'twin', 'faq', 'FAQ answers taken from a contract-restricted client portal', ['CONTRACT'], 'The answers come from {client}\'s portal, which the contract restricts to the project.', 'Twin: also FAQ, but contract-restricted.', { laxStamp: 'CLIENT PAGE OUT' }),
        K('public', 'twin', 'brochure', 'Product brochure PDF on our public website', ['PUBLISHED'], 'The brochure has been downloadable for months. We want a French version.', 'Already public.'),
        K('approved', 'twin', 'brochure', 'Next year\'s brochure draft, not yet printed', ['UNPUBLISHED'], 'A draft with next year\'s products, no client names and no personal data.', 'Not public yet, but plain business data.', { laxStamp: 'LEAKED EARLY' }),
      ]),
    ]),
    Cn('MD2', 'doors', 'Internal is not client', 'Internal business data may go to the approved workspace; anything a client owns or a contract restricts stays internal only.', { lax: 'CLIENT DATA OUT', strict: 'OVER-LOCKED' }, [
      V('MD2a', { client: ['Harlow', 'Brightmoor', 'Kestrel'] }, 'doors', [
        K('internal', 'clear', null, 'Escalation email from {client}\'s head of IT', ['CLIENT'], 'A complaint email from {client}\'s head of IT about an outage, with their system names.', 'Client-confidential.'),
        K('approved', 'trap', null, 'Our retro notes after a client call (nothing client-specific)', ['INTERNAL', 'NO PERSONAL'], 'Notes on how our own team ran the call: timing, hand-offs, tools. No client names or data.', 'About our process, not the client\'s data.', { laxStamp: 'CHECK FIRST' }),
        K('approved', 'twin', 'plan', 'Our team\'s sprint plan and task list', ['INTERNAL', 'NO PERSONAL'], 'This sprint\'s tasks and owners for our own team, with no client names.', 'Our own business data.'),
        K('internal', 'twin', 'plan', '{client}\'s project plan, shared under the contract', ['CLIENT', 'CONTRACT'], 'The client\'s own project plan, shared with us under the contract for review only.', 'Twin: also a plan, but the client\'s and contract-restricted.', { laxStamp: 'CLIENT PLAN OUT' }),
        K('approved', 'twin', 'pricing', 'Our standard price list for next year', ['INTERNAL'], 'Our own list prices for next year, before any client has seen a discount.', 'Our own business data.'),
        K('internal', 'twin', 'pricing', 'Pricing agreed with {client} in their contract', ['CLIENT', 'CONTRACT'], 'The discounts and terms we agreed with {client}, under a confidentiality clause.', 'Twin: same topic, but contract-restricted.', { laxStamp: 'CONTRACT TERMS OUT' }),
      ]),
      V('MD2b', { client: ['Harlow', 'Brightmoor', 'Kestrel'] }, 'doors', [
        K('internal', 'clear', null, 'Contract amendment draft with {client}', ['CONTRACT'], 'A draft amendment to the {client} contract, with their signatories and new terms.', 'A contract: client-confidential.'),
        K('approved', 'trap', null, 'Notes on a retail-sector trend, no client named', ['INTERNAL', 'NO PERSONAL'], 'Our own reading of public retail trends from several sources. It names no client.', 'No client data in it: business-internal.', { laxStamp: 'CHECK FIRST' }),
        K('approved', 'twin', 'wiki', 'Internal wiki page on how we run stand-ups', ['INTERNAL'], 'A page about our own meeting habits, written by our team.', 'Our own business data.'),
        K('internal', 'twin', 'wiki', 'Wiki page copied from a client\'s private portal', ['CLIENT'], 'A support page copied from {client}\'s private portal, which we may use only for the project.', 'Twin: also a wiki page, but the client\'s.', { laxStamp: 'CLIENT PAGE OUT' }),
        K('approved', 'twin', 'budget', 'Our department budget forecast', ['INTERNAL'], 'Next year\'s forecast for our own department, with no client names.', 'Our own business data.'),
        K('internal', 'twin', 'budget', 'A client\'s budget sheet sent to us for the audit', ['CLIENT'], '{client} sent their own budget sheet so we could run the audit. It is theirs.', 'Twin: also a budget, but the client\'s.', { laxStamp: 'CLIENT BUDGET OUT' }),
      ]),
    ]),
    Cn('MD3', 'doors', 'Regulated and secrets never go in', 'Regulated personal data and credentials go in no AI tool at all, whatever the task.', { lax: 'NEVER IN A PROMPT', strict: 'OVER-LOCKED' }, [
      V('MD3a', {}, 'doors', [
        K('noai', 'clear', null, 'Monthly payroll file with employee IDs and bank details', ['REGULATED'], 'The monthly payroll file: names, employee IDs, bank details and tax numbers.', 'Regulated personal data.'),
        K('approved', 'trap', null, 'Anonymised headcount totals by department', ['AGGREGATED', 'NO PERSONAL'], 'Totals only: how many people each department has. No names, IDs or pay.', 'Totals with no one identifiable: business data.', { laxStamp: 'CHECK FIRST' }),
        K('noai', 'twin', 'keys', 'Production server login keys', ['CREDENTIALS', 'HIGH RISK'], 'The live login keys for the production servers, copied from the vault.', 'Credentials never go in a prompt.'),
        K('internal', 'twin', 'keys', 'Client contract clause on API key rotation', ['CONTRACT'], 'Just the clause text: keys must be rotated every 90 days. No key is shown.', 'A clause about keys is a contract, not a key.', { laxStamp: 'CONTRACT TEXT OUT' }),
        K('noai', 'twin', 'notes', 'Patient notes for a healthcare client', ['REGULATED', 'CLIENT'], 'Clinical notes about named patients, held for a healthcare client.', 'Health data is regulated personal data.'),
        K('approved', 'twin', 'notes', 'Notes on how we schedule weekly team meetings', ['INTERNAL', 'NO PERSONAL'], 'Our own notes on meeting slots and agendas, with no personal data.', 'Business-internal, no client or personal data.', { laxStamp: 'CHECK FIRST' }),
      ]),
      V('MD3b', { client: ['Harlow', 'Brightmoor', 'Kestrel'] }, 'doors', [
        K('noai', 'clear', null, 'Passwords list exported from the shared team password vault', ['CREDENTIALS'], 'A plain export of every shared password the team keeps in its vault.', 'Credentials never go in a prompt.'),
        K('internal', 'trap', null, '{client}\'s security audit report with its findings', ['CLIENT'], 'A report about {client}\'s systems and open findings. It contains no passwords or keys.', 'Client-confidential, but no credentials: internal only.', { laxStamp: 'CLIENT REPORT OUT', strictStamp: 'OVER-LOCKED' }),
        K('noai', 'twin', 'ID', 'Spreadsheet of employee national ID numbers', ['REGULATED'], 'One row per employee: name and national ID number, for the visa team.', 'Regulated personal data.'),
        K('approved', 'twin', 'ID', 'Spreadsheet of office desk numbers and floors', ['INTERNAL'], 'Desk numbers and floors for the move plan, with no people named.', 'Business-internal, nobody identifiable.', { laxStamp: 'CHECK FIRST' }),
        K('noai', 'twin', 'leave', 'Staff sick-leave reasons, each with the diagnosis given', ['REGULATED'], 'A list of who was off sick and the diagnosis each one gave.', 'Health data is regulated personal data.'),
        K('approved', 'twin', 'leave', 'Policy text explaining how sick leave works', ['INTERNAL'], 'The written policy for requesting sick leave. No one\'s case is in it.', 'A policy text: business-internal.', { laxStamp: 'CHECK FIRST' }),
      ]),
      V('MD3c', {}, 'doors', [
        K('noai', 'clear', null, 'HR file with every staff member\'s bank details and tax numbers', ['REGULATED'], 'One row per person: name, bank account and tax number, for the payroll provider.', 'Regulated personal data.'),
        K('internal', 'trap', null, 'Client\'s data-protection policy, shared under contract', ['CLIENT', 'CONTRACT'], 'A policy document about how the client protects data. It holds no personal data and no keys.', 'Client-confidential, but not regulated data: internal only.', { laxStamp: 'CLIENT POLICY OUT' }),
        K('noai', 'twin', 'secret', 'API secret copied from a live deployment config file', ['CREDENTIALS', 'HIGH RISK'], 'The live secret that signs requests to our payment provider.', 'Credentials never go in a prompt.'),
        K('approved', 'twin', 'secret', 'Deployment checklist with the secrets left blank', ['INTERNAL'], 'The steps for a release, with every secret field blank.', 'No secret in it: business-internal.', { laxStamp: 'CHECK FIRST' }),
        K('noai', 'twin', 'records', 'Medical records requested by a client\'s insurer', ['REGULATED', 'CLIENT'], 'Named patients\' records, attached to an insurer\'s request.', 'Health data is regulated personal data.'),
        K('approved', 'twin', 'records', 'Our retention schedule for records, in plain wording', ['INTERNAL'], 'How long we keep each kind of record. No record itself is in it.', 'A schedule, not a record: business-internal.', { laxStamp: 'CHECK FIRST' }),
      ]),
    ]),
    Cn('MD4', 'doors', 'Anonymised is a different door', 'Anonymised, aggregated data can use the approved workspace when the contract allows; the same data with names or emails in it cannot.', { lax: 'STILL IDENTIFIABLE', strict: 'OVER-LOCKED' }, [
      V('MD4a', { client: ['Harlow', 'Brightmoor', 'Kestrel'] }, 'doors', [
        K('public', 'clear', null, 'Anonymised totals already published in our annual report', ['PUBLISHED', 'ONLINE'], 'The usage totals are on page 12 of the published annual report. We want a plain-language version.', 'Already public.'),
        K('approved', 'trap', null, '{client} usage totals, anonymised, contract allows analysis', ['CLIENT', 'AGGREGATED'], 'Totals by week with no user identifiable. The contract clause 4 allows analysis of anonymised data.', 'Anonymised and permitted: the approved workspace.', { laxStamp: 'CHECK FIRST' }),
        K('approved', 'twin', 'usage stats', 'Usage stats, anonymised and aggregated, contract allows analysis', ['AGGREGATED', 'NO PERSONAL'], 'Weekly totals per feature. No user can be identified, and the contract allows analysis.', 'Anonymised and permitted.'),
        K('internal', 'twin', 'usage stats', 'Usage stats listing individual user emails', ['PERSONAL'], 'The same stats, but every row carries the user\'s email address.', 'Twin: same stats, but identifiable people.', { laxStamp: 'USERS EXPOSED' }),
        K('approved', 'twin', 'survey', 'Survey results as team totals, no names', ['AGGREGATED', 'NO PERSONAL'], 'Scores per team with no names or free text.', 'Totals only: business data.'),
        K('internal', 'twin', 'survey', 'Survey from a client\'s staff, with names attached', ['CLIENT', 'NAMED'], 'Free-text answers from {client}\'s staff, each with the person\'s name.', 'Twin: same survey, but named and the client\'s.', { laxStamp: 'NAMES EXPOSED' }),
      ]),
      V('MD4b', { client: ['Harlow', 'Brightmoor', 'Kestrel'] }, 'doors', [
        K('noai', 'clear', null, 'Patient IDs matched to anonymised study results', ['REGULATED'], 'A file that links each patient ID to the study result, so people can be re-identified.', 'Regulated personal data, re-identifiable.'),
        K('internal', 'trap', null, 'Aggregated totals, but one row is a named client contract', ['AGGREGATED', 'CLIENT'], 'Totals by region, except one row shows {client}\'s name and contract value.', 'One row is a named client\'s contract: not fully anonymised.', { laxStamp: 'ONE ROW LEAKS' }),
        K('approved', 'twin', 'tickets', 'Support ticket counts by category, no customer details', ['AGGREGATED'], 'How many tickets per category last month. No names, accounts or text.', 'Counts only: business data.'),
        K('internal', 'twin', 'tickets', 'Support tickets quoting a client\'s account details', ['CLIENT'], 'The ticket text includes {client}\'s account numbers and system names.', 'Twin: also tickets, but client-confidential.', { laxStamp: 'CLIENT DATA OUT' }),
        K('public', 'twin', 'chart', 'Chart of our public download counts, already on the site', ['PUBLISHED'], 'The chart is on our public stats page. We want a clearer caption.', 'Already public.'),
        K('approved', 'twin', 'chart', 'Chart of internal sales by region, no client names', ['INTERNAL'], 'Sales totals by region for the sales team, with no client named.', 'Not public: internal business data.', { laxStamp: 'SALES LEAKED' }),
      ]),
    ]),
  ];

  // ================================================================ SHIFT 2 · RISK TIERS
  const TIERS = [
    Cn('MR1', 'tiers', 'Easy to undo can run alone', 'Low stakes and easy to undo can run on their own; keep people\'s attention for what is hard to undo.', { lax: 'UNWATCHED', strict: 'OVER-GATED' }, [
      V('MR1a', {}, 'tiers', [
        K('auto', 'clear', null, 'Tag 500 incoming support tickets by topic and product', ['EASY TO UNDO', 'REVERSIBLE'], 'Tags are only labels. A wrong tag is fixed with one click and nothing leaves the building.', 'Easy to undo, low stakes.'),
        K('auto', 'trap', null, 'Rename 400 files with a script, originals kept', ['400 FILES', 'REVERSIBLE'], 'A rename touches many files, but the originals stay in the archive and the script can be re-run.', 'Many files, but easy to undo.'),
        K('spot', 'twin', 'reply', 'Auto-reply to FAQs with approved answers', ['HIGH VOLUME'], 'Thousands of identical questions. The answers were approved once, so a sample check is enough.', 'Moderate stakes at high volume: a sample.', { laxStamp: 'NO SAMPLING' }),
        K('review', 'twin', 'reply', 'Reply to a customer\'s complaint about a charge', ['CUSTOMER', 'MONEY'], 'The reply touches a customer and money, and a sent reply cannot be taken back.', 'Twin: also a reply, but money and a customer.', { laxStamp: 'UNREVIEWED' }),
        K('auto', 'twin', 'sort', 'Sort the shared team inbox into topic folders', ['EASY TO UNDO', 'REVERSIBLE'], 'Folders can be moved back at any time. Nobody outside sees them.', 'Easy to undo.'),
        K('review', 'twin', 'sort', 'Sort incoming invoices into the payment queue', ['MONEY'], 'A wrong queue can mean a late or a double payment, which is hard to reverse.', 'Twin: the same "sort", but it touches money.', { laxStamp: 'UNREVIEWED' }),
      ]),
      V('MR1b', {}, 'tiers', [
        K('auto', 'clear', null, 'Suggest tags for our internal wiki pages', ['LOW STAKES'], 'A tag suggestion appears next to each page. A person accepts it or ignores it.', 'Low stakes, easy to undo.'),
        K('auto', 'trap', null, 'Reformat 2,000 old documents, originals kept', ['2,000 DOCS'], 'It looks big, but every original is kept and the reformat can be reversed in one run.', 'Large, but easy to undo.'),
        K('auto', 'twin', 'ranking', 'Rank supplier emails by urgency', ['EASY TO UNDO'], 'The inbox is re-ordered by urgency. A wrong order costs a few seconds.', 'Twin of the next: easy to undo.'),
        K('human', 'twin', 'ranking', 'Rank job candidates by fit', ['PEOPLE'], 'The ranking decides who gets an interview, so it touches a person\'s job.', 'Twin: the same "ranking", but about people.', { laxStamp: 'AI RANKED PEOPLE' }),
        K('spot', 'twin', 'summary', 'Summarise internal meetings', ['INTERNAL', 'HIGH VOLUME'], 'Forty meetings a week get a summary for the team. A sample check is enough.', 'Twin of the next: moderate stakes, high volume.', { laxStamp: 'NO SAMPLING' }),
        K('review', 'twin', 'summary', 'Summarise a contract dispute for a client', ['CUSTOMER'], 'The summary goes to a client and shapes how the dispute is read. It cannot be taken back.', 'Twin: the same "summary", but customer-facing and hard to undo.', { laxStamp: 'UNREVIEWED' }),
      ]),
    ]),
    Cn('MR2', 'tiers', 'Volume gets a sample', 'Moderate stakes at high volume get a spot-check: a sample catches problems without a person reading every item.', { lax: 'NO SAMPLING', strict: 'OVER-GATED' }, [
      V('MR2a', {}, 'tiers', [
        K('auto', 'clear', null, 'Auto-fill room names on calendar invites', ['EASY TO UNDO', 'REVERSIBLE'], 'A room name is added to each invite. Anyone can edit it, and nothing is sent outside.', 'Easy to undo.'),
        K('spot', 'trap', null, 'Draft 200 product descriptions from approved specs', ['HIGH VOLUME', 'MODERATE'], 'Every description comes from an approved spec sheet. A sample of them is read before they go on the shelf.', 'Moderate stakes at volume: a sample.', { strictStamp: 'OVER-GATED' }),
        K('auto', 'twin', 'translate', 'Translate 5 internal wiki pages, originals kept', ['EASY TO UNDO', 'REVERSIBLE'], 'A handful of internal pages translated for a colleague, with the originals kept.', 'Easy to undo.'),
        K('spot', 'twin', 'translate', 'Translate 3,000 internal knowledge-base articles', ['HIGH VOLUME'], 'A large batch for staff. Mistakes are fixable, but too many to read one by one.', 'Twin: same job, but high volume: a sample.', { laxStamp: 'NO SAMPLING' }),
        K('spot', 'twin', 'status', 'Draft 120 internal status updates a week', ['HIGH VOLUME'], 'Each team gets a drafted weekly update. Staff read them and report anything odd.', 'Moderate stakes, high volume.', { laxStamp: 'NO SAMPLING' }),
        K('review', 'twin', 'status', 'Draft the status update sent to a client\'s board', ['CUSTOMER'], 'One update, read by a client\'s board. Once sent it shapes how they see the project.', 'Twin: same "status update", but customer-facing.', { laxStamp: 'UNREVIEWED' }),
      ]),
      V('MR2b', {}, 'tiers', [
        K('spot', 'clear', null, 'Draft first answers to 500 internal HR questions', ['HIGH VOLUME'], 'Staff ask routine questions about leave and claims. Drafts are shown to staff, with a link to the policy.', 'Moderate stakes at volume: a sample.', { laxStamp: 'NO SAMPLING' }),
        K('spot', 'trap', null, 'Auto-label 5,000 receipts; staff pay them', ['HIGH VOLUME'], 'Labels sort the scans. A finance person still approves every payment from the original.', 'The label only sorts: a sample is enough.', { strictStamp: 'OVER-GATED' }),
        K('auto', 'twin', 'flag', 'Flag duplicate files across the whole shared drive', ['EASY TO UNDO'], 'Flags are only a marker. Nothing is deleted and anyone can clear a flag.', 'Easy to undo.'),
        K('spot', 'twin', 'flag', 'Flag possible spam in 4,000 inbound emails a day', ['HIGH VOLUME'], 'A flag moves a mail to a folder. At this volume a sample is checked each day.', 'Twin: same "flag", but high volume.', { laxStamp: 'NO SAMPLING' }),
        K('spot', 'twin', 'answers', 'Suggest answers to common developer questions', ['HIGH VOLUME'], 'Developers see a suggested answer and can ignore it. A sample is reviewed weekly.', 'Moderate stakes at volume.', { laxStamp: 'NO SAMPLING' }),
        K('review', 'twin', 'answers', 'Suggest answers to a customer\'s billing dispute', ['CUSTOMER', 'MONEY'], 'The answer goes to a customer in a dispute over charges. It touches money and cannot be unsent.', 'Twin: the same "answers", but money and a customer.', { laxStamp: 'UNREVIEWED' }),
      ]),
    ]),
    Cn('MR3', 'tiers', 'Money and customers get a reviewer', 'Money or customers plus hard to undo means a person checks each item, but the desk holds only 6, so do not gate everything.', { lax: 'UNREVIEWED', strict: 'OVER-GATED' }, [
      V('MR3a', { amount: ['5,000', '10,000', '20,000'] }, 'tiers', [
        K('review', 'clear', null, 'Draft refund replies over {amount}', ['MONEY'], 'Each reply confirms a refund of more than {amount} to a customer. It cannot be unsent.', 'Money and a customer: review each.'),
        K('auto', 'trap', null, 'Draft an internal glossary of refund terms', ['LOW STAKES', 'REVERSIBLE'], 'A glossary for new staff to read. It mentions refunds but nothing goes to a customer.', 'Staff-only and easy to fix, whatever the topic.', { strictStamp: 'OVER-GATED' }),
        K('review', 'twin', 'refund', 'Draft replies to customers asking about a refund', ['CUSTOMER', 'MONEY'], 'Each reply tells a customer what will happen to their money. It cannot be unsent.', 'Customer and money: review each.', { laxStamp: 'UNREVIEWED' }),
        K('spot', 'twin', 'refund', 'Summarise last month\'s refund trends for the team', ['INTERNAL', 'MODERATE'], 'A monthly trend note for the support team. It is read by staff only.', 'Twin: same topic, but internal: a sample.', { laxStamp: 'NO SAMPLING' }),
        K('review', 'twin', 'quote', 'Send price quotes to customers', ['CUSTOMER', 'MONEY'], 'A quote is a price commitment to a customer. Once sent it is hard to undo.', 'Customer and money: review each.'),
        K('auto', 'twin', 'quote', 'Draft a quote template for our own sales team', ['EASY TO UNDO', 'REVERSIBLE'], 'A blank layout for the sales team to fill. Nothing reaches a customer from it.', 'Twin: same "quote", but an internal template.', { strictStamp: 'OVER-GATED' }),
      ]),
      V('MR3b', {}, 'tiers', [
        K('review', 'clear', null, 'Draft a payment reminder to a late-paying client', ['CUSTOMER'], 'A reminder to a client about an overdue invoice. It touches the relationship and money.', 'Customer and money: review each.'),
        K('spot', 'trap', null, 'Summarise this month\'s invoices for the finance team', ['INTERNAL'], 'An overview for finance staff. Each real invoice is still handled by the finance team.', 'It looks like money, but it is an internal summary.', { strictStamp: 'OVER-GATED' }),
        K('review', 'twin', 'contract', 'Draft a contract renewal letter to a customer', ['CUSTOMER'], 'The letter commits us to terms with a customer and cannot be unsent.', 'Customer-facing and hard to undo.', { laxStamp: 'UNREVIEWED' }),
        K('spot', 'twin', 'contract', 'Summarise contract renewals due this quarter', ['INTERNAL'], 'A list for the account team of what renews when. Staff-only.', 'Twin: same topic, but internal.', { laxStamp: 'NO SAMPLING' }),
        K('review', 'twin', 'offer', 'Generate discount offers for 40 key accounts', ['CUSTOMER'], 'Forty offers go to named customers with real prices. They cannot be recalled.', 'Money and customers.', { laxStamp: 'UNREVIEWED' }),
        K('auto', 'twin', 'offer', 'Generate placeholder text for a discount banner mock-up', ['LOW STAKES'], 'Dummy text for a design mock-up that no customer will see.', 'Twin: same "discount", but easy to undo.', { strictStamp: 'OVER-GATED' }),
      ]),
      V('MR3c', {}, 'tiers', [
        K('review', 'clear', null, 'Approve discount codes for a customer campaign', ['CUSTOMER'], 'Each code gives real customers money off. Once sent it is hard to take back.', 'Customers and money: review each.'),
        K('auto', 'trap', null, 'Suggest names for a customer-loyalty programme', ['LOW STAKES'], 'A list of name ideas for the team to pick from. Nothing goes to a customer.', 'It mentions customers, but it is only ideas.', { strictStamp: 'OVER-GATED' }),
        K('review', 'twin', 'letter', 'Draft the letter telling a customer their claim is rejected', ['CUSTOMER'], 'The letter tells a customer they will not be paid, and cannot be unsent.', 'Customer and money: review each.', { laxStamp: 'UNREVIEWED' }),
        K('spot', 'twin', 'letter', 'Summarise 300 rejected claims for staff', ['INTERNAL', 'HIGH VOLUME'], 'A digest for staff of why claims were rejected. No customer sees it.', 'Twin: same topic, but internal and high volume.', { laxStamp: 'NO SAMPLING' }),
        K('review', 'twin', 'payment', 'Prepare a payment run of 40 supplier invoices', ['MONEY'], 'The run pays forty suppliers, and a wrong payment is hard to get back.', 'Money, hard to undo: review each.', { laxStamp: 'UNREVIEWED' }),
        K('auto', 'twin', 'payment', 'Prepare a draft list of invoices due this week', ['EASY TO UNDO'], 'A list for the team to look at. Nothing is paid from it.', 'Twin: same invoices, but nothing is paid.', { strictStamp: 'OVER-GATED' }),
      ]),
    ]),
    Cn('MR4', 'tiers', 'People decisions stay with people', 'Where a person\'s job, pay, health or rights are at stake, a person decides; AI can inform but not decide.', { lax: 'AI DECIDED', strict: 'OVER-GATED' }, [
      V('MR4a', {}, 'tiers', [
        K('human', 'clear', null, 'Rate each staff member\'s performance for the year', ['PEOPLE'], 'The rating feeds each person\'s pay review and promotion, so it touches a person\'s job and pay.', 'A person\'s job and pay.'),
        K('auto', 'trap', null, 'Draft a thank-you note for a retiring colleague', ['PEOPLE'], 'A warm note for the leaving card. A person edits it and signs it.', 'It mentions a person but decides nothing: easy to undo.', { strictStamp: 'OVER-GATED' }),
        K('auto', 'twin', 'schedule', 'Suggest meeting times for a project team', ['EASY TO UNDO'], 'Three slots are suggested. The organiser picks one or changes it.', 'Easy to undo.'),
        K('human', 'twin', 'schedule', 'Pick who is laid off from a long list of staff', ['PEOPLE'], 'The list decides who keeps a job and who loses one.', 'Twin: same "pick", but a person\'s job.', { laxStamp: 'AI DECIDED' }),
        K('spot', 'twin', 'health', 'Summarise the office wellness-survey totals', ['INTERNAL', 'HIGH VOLUME'], 'Anonymous totals for the wellbeing team. No one is singled out.', 'Totals only: moderate stakes.', { laxStamp: 'NO SAMPLING' }),
        K('human', 'twin', 'health', 'Decide fitness for duty from a medical file', ['HEALTH'], 'The decision decides whether a person can keep working, so it touches health and rights.', 'Twin: same "health", but one person\'s health and rights.', { laxStamp: 'AI DECIDED' }),
      ]),
      V('MR4b', {}, 'tiers', [
        K('human', 'clear', null, 'Decide whose pay rises this year', ['PAY'], 'The decision sets each person\'s salary for the year.', 'A person\'s pay.'),
        K('spot', 'trap', null, 'Summarise anonymous staff-survey comments by theme', ['HIGH VOLUME'], 'Themes from thousands of comments, with no names. Leaders read the themes, not people.', 'It is about people, but it decides nothing about anyone.', { strictStamp: 'OVER-GATED' }),
        K('human', 'twin', 'candidates', 'Screen out applicants with gaps', ['PEOPLE'], 'The screen rejects people before anyone reads their CV, so it touches a person\'s job.', 'A person\'s job.', { laxStamp: 'AI DECIDED' }),
        K('auto', 'twin', 'candidates', 'Format candidates\' CVs into one template', ['EASY TO UNDO'], 'The layout of each CV is tidied. The content is unchanged and the original is kept.', 'Twin: same candidates, but easy to undo.', { strictStamp: 'OVER-GATED' }),
        K('human', 'twin', 'claim', 'Decide a benefits claim from a medical report', ['HEALTH', 'RIGHTS'], 'The decision decides whether a person receives a benefit they claim.', 'A person\'s health and rights.', { laxStamp: 'AI DECIDED' }),
        K('review', 'twin', 'claim', 'Draft the letter confirming an approved benefits claim', ['PEOPLE', 'MONEY'], 'A person already approved the claim. The letter states the amount and cannot be unsent.', 'Twin: same claim, but only confirming a decision already made.', { laxStamp: 'UNREVIEWED' }),
      ]),
      V('MR4c', {}, 'tiers', [
        K('human', 'clear', null, 'Decide which team member is promoted this year', ['PEOPLE', 'JOB'], 'The decision picks who moves up, with a new title and pay.', 'A person\'s job and pay.'),
        K('auto', 'trap', null, 'Suggest ice-breaker questions for a new-joiner lunch', ['PEOPLE'], 'A few light questions for a lunch. The host picks which to ask.', 'It is about people, but it decides nothing.', { strictStamp: 'OVER-GATED' }),
        K('human', 'twin', 'discipline', 'Decide a worker\'s disciplinary outcome this month', ['PEOPLE', 'JOB'], 'The outcome could be a warning or a dismissal.', 'A person\'s job.', { laxStamp: 'AI DECIDED' }),
        K('spot', 'twin', 'discipline', 'Summarise 50 HR policy pages for new managers', ['INTERNAL', 'HIGH VOLUME'], 'A readable digest of policy pages. Managers check it against the policy.', 'Twin: same topic, but a summary of policy only.', { laxStamp: 'NO SAMPLING' }),
        K('human', 'twin', 'visa', 'Decide if a worker keeps a visa-sponsored role', ['RIGHTS', 'JOB'], 'The decision affects the worker\'s right to stay and work.', 'A person\'s job and rights.', { laxStamp: 'AI DECIDED' }),
        K('review', 'twin', 'visa', 'Draft sponsorship paperwork once a person has approved it', ['PEOPLE', 'MONEY'], 'The approval is already made. The paperwork has fees and dates and cannot be unsent.', 'Twin: same visa, but only paperwork for a decision already made.', { laxStamp: 'UNREVIEWED' }),
      ]),
    ]),
  ];

  // ================================================================ SHIFT 3 · CONFIDENCE AND CHECKS
  // K3: a model output waiting to go out. conf = the model's own score, stakes = "low" | "medium" | "high", ok = the output was in fact right (shown after an AUTO-SEND), miss = information missing.
  const K3 = (bin, kind, cue, text, chips, full, tell, conf, stakes, ok, miss, o) => K(bin, kind, cue, text, chips, full, tell, Object.assign({ confidence: conf, stakes, outputRight: ok }, miss ? { missing: true } : {}, o));
  const CHECKS = [
    Cn('MC1', 'checks', 'Stakes set the check', 'Low stakes can be sent, medium stakes get a quick check, high stakes (money, legal, people) go to an expert: the stakes choose the check.', { lax: 'UNCHECKED', strict: 'OVER-CHECKED' }, [
      V('MC1a', {}, 'checks', [
        K3('send', 'clear', null, 'Reply: “We open at 9am on weekdays.”', ['CONF 0.98', 'LOW'], 'A reply to a customer asking when the shop opens. The hours are on the website.', 'Low stakes: send it.', 0.98, 'low', true),
        K3('quick', 'trap', null, 'Reply: “Your parcel ships on Tuesday.”', ['CONF 0.99', 'MEDIUM'], 'A delivery date promised to a customer. A wrong date means a complaint, not a loss.', 'Very confident, but medium stakes: a quick check.', 0.99, 'medium', false),
        K3('send', 'twin', 'subject', 'Subject line idea for a newsletter', ['CONF 0.90', 'LOW'], 'Three subject-line ideas for the staff newsletter. A person picks one.', 'Low stakes: send it.', 0.9, 'low', true),
        K3('expert', 'twin', 'subject', 'Subject line for a legal notice', ['CONF 0.90', 'LEGAL'], 'The subject line of a legal notice to customers. The notice has legal effect.', 'Twin: the same confidence, much higher stakes.', 0.9, 'high', true),
        K3('quick', 'twin', 'invite', 'Meeting invite wording for a client workshop', ['CONF 0.80', 'MEDIUM'], 'The invite goes to three client contacts and sets the tone of the workshop.', 'Medium stakes: a quick check.', 0.8, 'medium', true),
        K3('send', 'twin', 'invite', 'Meeting invite wording for the team lunch', ['CONF 0.80', 'LOW'], 'An invite to our own team for a lunch on Friday.', 'Twin: the same confidence, but low stakes.', 0.8, 'low', true),
      ]),
      V('MC1b', {}, 'checks', [
        K3('expert', 'clear', null, 'Clause summary for a client contract', ['CONF 0.92', 'LEGAL'], 'A summary of a contract clause that the client will rely on.', 'High stakes (legal): expert review.', 0.92, 'high', false),
        K3('send', 'trap', null, 'A formal-sounding note about our parking rules', ['CONF 0.88', 'LOW'], 'A stiff, official-sounding note to staff about where to park.', 'It sounds serious, but the stakes are low.', 0.88, 'low', true),
        K3('expert', 'twin', 'quote', 'Quote: price for a 50-seat licence', ['CONF 0.91', 'MONEY'], 'A price quote for a customer, with a total and a discount.', 'High stakes (money): expert review.', 0.91, 'high', false),
        K3('send', 'twin', 'quote', 'Quote: this week\'s order of office coffee', ['CONF 0.91', 'LOW'], 'This week\'s coffee order for our own office.', 'Twin: the same "quote", but low stakes.', 0.91, 'low', true),
        K3('quick', 'twin', 'notice', 'Notice of a planned system maintenance window', ['CONF 0.75', 'MEDIUM'], 'A notice to staff that the system will be down on Saturday morning.', 'Medium stakes: a quick check.', 0.75, 'medium', true),
        K3('expert', 'twin', 'notice', 'Notice of a change to staff contracts', ['CONF 0.75', 'PEOPLE'], 'A notice telling staff their contract terms will change.', 'Twin: the same confidence, but people and law.', 0.75, 'high', false),
      ]),
    ]),
    Cn('MC2', 'checks', 'Confidence is only a score', 'Confidence is the model\'s own score and can be wrong: a 0.97 on a high-stakes answer still goes to an expert.', { lax: 'TRUSTED THE SCORE', strict: 'OVER-CHECKED' }, [
      V('MC2a', { amount: ['400', '1,200', '5,000'] }, 'checks', [
        K3('expert', 'clear', null, 'Draft: salary offer letter for a new hire', ['CONF 0.96', 'PEOPLE'], 'A letter with a salary and a start date, for a person who will accept it.', 'People and money: expert review, however confident.', 0.96, 'high', false),
        K3('quick', 'trap', null, 'Reminder email to the team about timesheets', ['CONF 0.93', 'MEDIUM'], 'A reminder that timesheets are due on Friday, sent to forty colleagues.', 'Confident, but medium stakes: a quick check.', 0.93, 'medium', true),
        K3('expert', 'twin', 'score 0.97', 'Reply: “Your refund of {amount} is approved.”', ['CONF 0.97', 'MONEY'], 'A reply telling a customer a refund of {amount} is approved. No approval exists yet.', 'Very confident, high stakes: expert review.', 0.97, 'high', false),
        K3('send', 'twin', 'score 0.97', 'Reply: “Our office is closed on Monday.”', ['CONF 0.97', 'LOW'], 'A reply to a customer about a public holiday. The holiday is on the website.', 'Twin: the same 0.97, but low stakes.', 0.97, 'low', true),
        K3('expert', 'twin', 'score 0.99', 'Summary: “There is no legal risk in clause 9.”', ['CONF 0.99', 'LEGAL'], 'A summary for a client saying clause 9 carries no legal risk.', 'A 0.99 on a legal claim: still expert review.', 0.99, 'high', false),
        K3('send', 'twin', 'score 0.99', 'Reply: “Thanks, got it, will do!”', ['CONF 0.99', 'LOW'], 'A one-line acknowledgement to a colleague.', 'Twin: the same 0.99, but low stakes.', 0.99, 'low', true),
      ]),
      V('MC2b', {}, 'checks', [
        K3('expert', 'clear', null, 'Invoice total check: “All 14 lines add up.”', ['CONF 0.98', 'MONEY'], 'A check that an invoice of 14 lines is correct before it is paid.', 'Money: expert review, whatever the score.', 0.98, 'high', false),
        K3('send', 'trap', null, 'Alt text for a decorative intranet icon', ['CONF 0.62', 'LOW'], 'A short image description for an icon on an internal page.', 'The score is lowish, but not under 0.60, and the stakes are low.', 0.62, 'low', true),
        K3('expert', 'twin', 'sure', 'Reply: “We can refund you in full.”', ['CONF 0.94', 'MONEY'], 'A reply promising a customer a full refund before any check of the order.', 'High stakes: expert review.', 0.94, 'high', false),
        K3('send', 'twin', 'sure', 'Reply: “Happy to help, see you Thursday.”', ['CONF 0.94', 'LOW'], 'A friendly reply confirming a Thursday catch-up with a colleague.', 'Twin: the same 0.94, but low stakes.', 0.94, 'low', true),
        K3('quick', 'twin', 'draft', 'Draft agenda for a client call', ['CONF 0.90', 'MEDIUM'], 'An agenda sent to the client before Thursday\'s call.', 'Medium stakes: a quick check.', 0.9, 'medium', true),
        K3('expert', 'twin', 'draft', 'Draft termination letter for a contractor', ['CONF 0.90', 'PEOPLE'], 'A letter ending a contractor\'s work, with a notice period and a final payment.', 'Twin: the same 0.90, but people, money and law.', 0.9, 'high', false),
      ]),
    ]),
    Cn('MC3', 'checks', 'Low confidence tightens one step', 'Under 0.60 confidence, the check moves one step stricter: a low-stakes item gets a quick check, a medium one an expert.', { lax: 'IGNORED THE SCORE', strict: 'OVER-CHECKED' }, [
      V('MC3a', {}, 'checks', [
        K3('quick', 'clear', null, 'Summary of a two-line note from a colleague', ['CONF 0.55', 'LOW'], 'A summary of a two-line note from a colleague. The model is unsure of it.', 'Low stakes, but under 0.60: one step stricter.', 0.55, 'low', false),
        K3('send', 'trap', null, 'Summary of a long report', ['CONF 0.62', 'LOW'], 'A long internal report, summarised for the team. The score is just over the line.', '0.62 is not under 0.60: low stakes, send it.', 0.62, 'low', true),
        K3('send', 'twin', 'note', 'Summary of a three-line note from a colleague', ['CONF 0.80', 'LOW'], 'A summary of a three-line note from a colleague.', 'Low stakes and a fine score: send it.', 0.8, 'low', true),
        K3('quick', 'twin', 'note', 'Summary of a three-line note from a colleague', ['CONF 0.55', 'LOW'], 'The same kind of note, but this time the model is unsure.', 'Twin: same words, but under 0.60.', 0.55, 'low', false),
        K3('expert', 'twin', 'score 0.50', 'Draft reply to a supplier about a late delivery', ['CONF 0.50', 'MEDIUM'], 'A reply to a supplier about a delivery that is a week late. The model is unsure.', 'Medium stakes, under 0.60: expert review.', 0.5, 'medium', false),
        K3('quick', 'twin', 'score 0.50', 'Draft reply to the lunch-poll thread', ['CONF 0.50', 'LOW'], 'A reply to a thread about where to have lunch. The model is unsure.', 'Twin: the same 0.50, but low stakes.', 0.5, 'low', true),
      ]),
      V('MC3b', {}, 'checks', [
        K3('expert', 'clear', null, 'Translation of a customer service notice', ['CONF 0.52', 'MEDIUM'], 'A translated notice for customers about a service change. The model is unsure.', 'Medium stakes and under 0.60: expert review.', 0.52, 'medium', false),
        K3('send', 'trap', null, 'Weekly summary of all office-supply orders', ['CONF 0.60', 'LOW'], 'A list of what was ordered this week for our own office.', 'Exactly 0.60 is not under 0.60: low stakes, send it.', 0.6, 'low', true),
        K3('quick', 'twin', 'notes', 'Meeting notes tidied up for the whole team', ['CONF 0.58', 'LOW'], 'Tidied notes of an internal meeting. The score is just under the line.', 'Low stakes, but under 0.60: one step stricter.', 0.58, 'low', true),
        K3('send', 'twin', 'notes', 'Meeting notes tidied up for the whole team', ['CONF 0.66', 'LOW'], 'Tidied notes of an internal meeting. The score is a little higher.', 'Twin: same words, but not under 0.60.', 0.66, 'low', true),
        K3('quick', 'twin', 'tweet', 'Draft post about the office open day', ['CONF 0.40', 'LOW'], 'A draft post for the company page. The model is very unsure of it.', 'Low stakes, under 0.60: a quick check.', 0.4, 'low', false),
        K3('send', 'twin', 'tweet', 'Draft post about the office open day', ['CONF 0.88', 'LOW'], 'A draft post for the company page, and the model is confident.', 'Twin: same words, but a confident score.', 0.88, 'low', true),
      ]),
      V('MC3c', {}, 'checks', [
        K3('quick', 'clear', null, 'Draft reply to a colleague\'s holiday request', ['CONF 0.57', 'LOW'], 'A reply saying the dates look fine. The model is unsure about the rota.', 'Low stakes, but under 0.60: one step stricter.', 0.57, 'low', false),
        K3('send', 'trap', null, 'Summary of a five-line status note', ['CONF 0.61', 'LOW'], 'A short status note for the team. The score is just over the line.', '0.61 is not under 0.60: low stakes, send it.', 0.61, 'low', true),
        K3('quick', 'twin', 'ack', 'Acknowledgement of a supplier invoice', ['CONF 0.70', 'MEDIUM'], 'A note telling a supplier their invoice arrived and will be processed.', 'Medium stakes: a quick check.', 0.7, 'medium', true),
        K3('send', 'twin', 'ack', 'Acknowledgement of a visitor sign-in', ['CONF 0.70', 'LOW'], 'A thank-you note to a visitor who signed in at reception.', 'Twin: the same 0.70, but low stakes.', 0.7, 'low', true),
        K3('quick', 'twin', 'poll', 'Poll wording for the team away day', ['CONF 0.35', 'LOW'], 'Questions for a vote on the venue of the away day. The model is very unsure.', 'Low stakes, under 0.60: a quick check.', 0.35, 'low', false),
        K3('expert', 'twin', 'poll', 'Poll wording for a staff-pay survey', ['CONF 0.35', 'MEDIUM'], 'Questions for a survey about pay. The model is very unsure.', 'Twin: the same 0.35, but medium stakes: one step stricter.', 0.35, 'medium', false),
      ]),
    ]),
    Cn('MC4', 'checks', 'Missing information means ask', 'When key facts are missing, ask for details first: a confident answer built on nothing is still a guess.', { lax: 'GUESSED', strict: 'OVER-CHECKED' }, [
      V('MC4a', {}, 'checks', [
        K3('ask', 'clear', null, 'Label for the email “help”', ['CONF 0.85', 'NO DETAILS'], 'The email says only “help”. There is no account, product or problem.', 'Missing information: ask for details.', 0.85, 'low', false, true),
        K3('ask', 'trap', null, 'Invoice summary for an invoice that was never attached', ['CONF 0.94', 'NO DETAILS'], 'The model wrote a summary, but no invoice came with the request.', 'A confident score on nothing: ask.', 0.94, 'high', false, true),
        K3('send', 'twin', 'label', 'Ticket label for an email about a password reset', ['CONF 0.85', 'LOW'], 'The email says which account and that the password reset link failed.', 'The facts are there, and the stakes are low.', 0.85, 'low', true),
        K3('ask', 'twin', 'label', 'Label for an email that is just one photo', ['CONF 0.85', 'NO DETAILS'], 'The email has a photo and no text, so the problem cannot be read.', 'Twin: same score, but information is missing.', 0.85, 'low', false, true),
        K3('expert', 'twin', 'move', 'Reply to “Can you move the contract date?”', ['CONF 0.80', 'LEGAL'], 'The thread shows the contract, both dates and who asked.', 'The facts are there: high stakes, expert review.', 0.8, 'high', false),
        K3('quick', 'twin', 'move', 'Reply to “Can you move the Thursday call?”', ['CONF 0.80', 'MEDIUM'], 'The thread shows the call, who is on it and the two proposed times.', 'Twin: the facts are there, and the stakes are medium.', 0.8, 'medium', true),
      ]),
      V('MC4b', {}, 'checks', [
        K3('ask', 'clear', null, 'Reply to “Is it still on?” with no context', ['CONF 0.78', 'NO DETAILS'], 'There is no earlier message, so “it” could be anything.', 'Missing information: ask for details.', 0.78, 'low', false, true),
        K3('quick', 'trap', null, 'Out-of-office wording for next week', ['CONF 0.45', 'LOW'], 'A short out-of-office message. The model is unsure of the wording.', 'Trivial, but under 0.60: one step stricter.', 0.45, 'low', true),
        K3('ask', 'twin', 'quote', 'Quote for “the usual order”, but no order is on file', ['CONF 0.97', 'NO DETAILS'], 'The customer wrote “the usual”, and there is no order history to read.', 'A confident quote on nothing: ask.', 0.97, 'high', false, true),
        K3('send', 'twin', 'quote', 'Quote for 10 standard notebooks, price list attached', ['CONF 0.97', 'LOW'], 'The request names the item and the quantity, and the price list is attached.', 'Twin: the same 0.97, with the facts present.', 0.97, 'low', true),
        K3('expert', 'twin', 'dates', 'Reply on a contract date change, both dates attached', ['CONF 0.85', 'LEGAL'], 'The old and the new dates are in the message, with the contract number.', 'High stakes, facts present: expert review.', 0.85, 'high', false),
        K3('ask', 'twin', 'dates', 'Reply on a contract date change, no dates given', ['CONF 0.85', 'NO DETAILS'], 'The message asks for a change but names neither the old date nor the new one.', 'Twin: same request, but the dates are missing.', 0.85, 'high', false, true),
      ]),
      V('MC4c', {}, 'checks', [
        K3('ask', 'clear', null, 'Label for the email “broken”', ['CONF 0.90', 'NO DETAILS'], 'The email says “broken” and nothing else: no product, no account.', 'Missing information: ask for details.', 0.9, 'low', false, true),
        K3('ask', 'trap', null, 'Contract summary, contract file missing', ['CONF 0.99', 'NO DETAILS'], 'A fluent summary arrived, but no contract was attached to the request.', 'A 0.99 on nothing: ask.', 0.99, 'high', false, true),
        K3('ask', 'twin', 'refund', 'Reply to “Where is my money?”, no order', ['CONF 0.80', 'NO DETAILS'], 'The customer gave no order number, name or date.', 'Missing information: ask.', 0.8, 'high', false, true),
        K3('expert', 'twin', 'refund', 'Reply to “Where is my refund?”, order 4471 attached', ['CONF 0.80', 'MONEY'], 'The order, the amount and the date are in the thread.', 'Twin: same question, but the facts are there: expert review.', 0.8, 'high', false),
        K3('send', 'twin', 'invoice', 'Label for an invoice email with the invoice attached', ['CONF 0.92', 'LOW'], 'The invoice is attached, so the label can be read from it.', 'The facts are there, and the stakes are low.', 0.92, 'low', true),
        K3('ask', 'twin', 'invoice', 'Label for an invoice email, nothing attached', ['CONF 0.92', 'NO DETAILS'], 'The email says an invoice is attached, but nothing is.', 'Twin: same score, but the invoice is missing.', 0.92, 'low', false, true),
      ]),
    ]),
  ];

  // ================================================================ SHIFT 4 · INCIDENT RESPONSE
  const INCIDENTS = [
    Cn('MI1', 'incidents', 'Retry what is brief and rare', 'A brief, rare glitch is worth a retry; keep escalation for what repeats, lasts or follows a change.', { lax: 'UNDER-REACTED', strict: 'OVER-REACTED' }, [
      V('MI1a', {}, 'incidents', [
        K('retry', 'clear', null, '3 requests timed out, then all normal', ['BRIEF'], 'Three calls failed at 10:02. Every call since has worked.', 'Brief and over.'),
        K('retry', 'trap', null, 'A red alert fired once at 3am and cleared by itself within a minute', ['ALERT'], 'A red alert at 3am. It cleared within a minute and has not come back.', 'Scary-looking, but brief and gone.', { strictStamp: 'OVER-REACTED' }),
        K('retry', 'twin', 'timeout', 'Timeouts for 2 minutes, then normal', ['BRIEF'], 'A two-minute burst of timeouts, then normal.', 'Brief and rare.'),
        K('takeover', 'twin', 'timeout', 'Timeouts for 3 hours and still going', ['LONG'], 'The requests have timed out since lunch and the vendor shows no end time.', 'Twin: also timeouts, but it will not fix itself soon.', { laxStamp: 'KEPT RETRYING' }),
        K('retry', 'twin', 'blank', 'One blank reply, the next 50 fine', ['RARE'], 'A single blank reply among fifty good ones.', 'Rare: retry.'),
        K('rollback', 'twin', 'blank', 'Blank replies since this morning\'s deploy', ['RECENT CHANGE'], 'Every third reply is blank, starting right after this morning\'s deploy.', 'Twin: also blanks, but right after a change.', { laxStamp: 'KEPT RETRYING' }),
      ]),
      V('MI1b', {}, 'incidents', [
        K('retry', 'clear', null, 'One failed upload; the retry worked', ['RARE'], 'One upload failed, and the second try went through at once.', 'Rare: retry.'),
        K('retry', 'trap', null, 'Error spike for 30 seconds during the nightly backup', ['BRIEF'], 'Errors rose for half a minute during the usual backup window, then fell away.', 'Brief and expected.', { strictStamp: 'OVER-REACTED' }),
        K('retry', 'twin', 'slow', 'Replies slow for 5 minutes during the lunch rush', ['BRIEF'], 'Replies took twice as long for five minutes, then returned to normal.', 'Brief.'),
        K('takeover', 'twin', 'slow', 'Replies slow for the fourth day running', ['LONG'], 'Slow replies every afternoon since Monday with no change on our side.', 'Twin: also slow, but it keeps going.', { laxStamp: 'KEPT RETRYING' }),
        K('retry', 'twin', 'cut off', 'One reply cut off mid-sentence, the next 80 fine', ['RARE'], 'One truncated reply among eighty good ones.', 'Rare: retry.'),
        K('stop', 'twin', 'cut off', 'One reply quoted another customer\'s order details', ['PRIVACY'], 'A single reply included the order lines of a different customer.', 'Twin: also "one reply", but data exposure.', { laxStamp: 'EXPOSURE MISSED' }),
      ]),
    ]),
    Cn('MI2', 'incidents', 'A person takes over what won\'t fix itself', 'When a problem will not fix itself soon, a person takes over; retrying only burns time.', { lax: 'LEFT TO ITSELF', strict: 'OVER-REACTED' }, [
      V('MI2a', {}, 'incidents', [
        K('takeover', 'clear', null, 'Vendor outage, 2 hours and counting', ['LONG'], 'The model vendor\'s status page shows an outage, two hours so far, no end time.', 'Will not fix itself soon.'),
        K('takeover', 'trap', null, 'Form-reading assistant fails on every new form type', ['NEW TOPIC'], 'The assistant only knows the old forms, and every new form type fails the same way.', 'It fails the same way each time: retrying will not help.', { laxStamp: 'KEPT RETRYING' }),
        K('retry', 'twin', 'outage', 'Vendor blip: one failed call, then normal', ['BRIEF'], 'One call to the vendor failed. The status page is green.', 'Brief: retry.'),
        K('takeover', 'twin', 'outage', 'Vendor status page: degraded since 9am', ['LONG'], 'The status page says degraded since 9am and no fix time is given.', 'Twin: also the vendor, but it lasts.', { laxStamp: 'KEPT RETRYING' }),
        K('takeover', 'twin', 'new', 'New product launched; the assistant is wrong about it', ['NEW TOPIC'], 'Customers ask about the product launched today, and the assistant has no facts about it.', 'Until its data is updated, a person must answer.', { laxStamp: 'LEFT TO ITSELF' }),
        K('retry', 'twin', 'new', 'New wording in one reply; the next replies are fine', ['RARE'], 'One reply used an unusual phrase. The rest are normal.', 'Twin: also "new", but one-off.', { strictStamp: 'OVER-REACTED' }),
      ]),
      V('MI2b', {}, 'incidents', [
        K('takeover', 'clear', null, 'The data feed has been down since last night', ['LONG'], 'The nightly feed did not arrive and the supplier says it will be days.', 'Will not fix itself soon.'),
        K('retry', 'trap', null, 'Search tool times out, though the status page shows an outage', ['LIMIT'], 'The tool timed out once. The status page covers a different region.', 'The outage is elsewhere; this was one timeout.', { strictStamp: 'OVER-REACTED' }),
        K('takeover', 'twin', 'new law', 'A new regulation makes our canned answers wrong', ['NEW RULES'], 'A rule changed yesterday, and three of our standard answers now give the wrong advice.', 'It needs a person to rewrite them.', { laxStamp: 'LEFT TO ITSELF' }),
        K('retry', 'twin', 'new law', 'A one-off typo in one standard answer, the rest are fine', ['RARE'], 'One answer has a typo. The next ones are fine.', 'Twin: also an error, but one-off.', { strictStamp: 'OVER-REACTED' }),
        K('takeover', 'twin', 'queue', 'The support queue has grown for three days', ['LONG'], 'Tickets are waiting since Monday because the assistant cannot read a new attachment type.', 'It will not clear itself.', { laxStamp: 'KEPT RETRYING' }),
        K('retry', 'twin', 'queue', 'The support queue was slow for ten minutes', ['BRIEF'], 'A short build-up of tickets after a power cut, cleared by itself.', 'Twin: also a queue, but brief.', { strictStamp: 'OVER-REACTED' }),
      ]),
    ]),
    Cn('MI3', 'incidents', 'Roll back what broke after a change', 'When it broke right after a change, undo the change first: roll back, then work out why.', { lax: 'KEPT GOING', strict: 'OVER-REACTED' }, [
      V('MI3a', {}, 'incidents', [
        K('rollback', 'clear', null, 'Quality fell right after last night\'s model update', ['RECENT CHANGE'], 'Answer quality was fine yesterday. It dropped within an hour of last night\'s model update.', 'It broke right after a change.'),
        K('rollback', 'trap', null, 'Prompt edit this morning made replies rude', ['RECENT CHANGE'], 'A colleague edited the prompt at 9am. Since then replies sound curt and rude.', 'It started with this morning\'s edit.', { laxStamp: 'KEPT GOING' }),
        K('retry', 'twin', 'quality', 'One reply was poor, the rest are fine', ['RARE'], 'One reply was poor. The next hundred were good and nothing changed.', 'Rare, no change behind it.', { strictStamp: 'OVER-REACTED' }),
        K('rollback', 'twin', 'quality', 'Every reply worse since Tuesday\'s release', ['RECENT CHANGE'], 'Every reply since Tuesday\'s release is poorer. Nothing else changed.', 'Twin: also quality, but right after a release.', { laxStamp: 'KEPT GOING' }),
        K('takeover', 'twin', 'cost', 'Replies are slower, with no change of ours for a week', ['LONG'], 'Nothing changed on our side for a week, and the vendor says it is working on it.', 'No change behind it, and it lasts.', { laxStamp: 'LEFT TO ITSELF' }),
        K('rollback', 'twin', 'cost', 'Replies slower since the model setting change', ['RECENT CHANGE'], 'We changed the model setting yesterday afternoon, and replies slowed down the same hour.', 'Twin: also slower, but right after a change.', { laxStamp: 'KEPT GOING' }),
      ]),
      V('MI3b', {}, 'incidents', [
        K('rollback', 'clear', null, 'Wrong language in replies since the config change', ['RECENT CHANGE'], 'This morning\'s config change reset the language setting, and replies come back in the wrong language.', 'It broke right after a change.'),
        K('retry', 'trap', null, 'One reply in the wrong language, after a config change last week', ['RARE'], 'A config change last week was fine. One reply today came back in another language.', 'One reply, a week after the change: retry.', { strictStamp: 'OVER-REACTED' }),
        K('rollback', 'twin', 'format', 'Replies lost their formatting after Friday\'s template update', ['RECENT CHANGE'], 'Friday\'s template update stripped the formatting from every reply.', 'It followed a template change.', { laxStamp: 'KEPT GOING' }),
        K('retry', 'twin', 'format', 'One reply lost its formatting, the next 60 fine', ['RARE'], 'One reply came back without bullets. The next sixty were fine.', 'Twin: also formatting, but one-off.', { strictStamp: 'OVER-REACTED' }),
        K('stop', 'twin', 'deploy', 'After the deploy, replies show other customers\' names', ['PRIVACY'], 'A deploy this morning, and now some replies show names that belong to other customers.', 'It followed a change, but it exposes data: stop and report.', { laxStamp: 'EXPOSURE MISSED' }),
        K('rollback', 'twin', 'deploy', 'After the deploy, replies are twice as long', ['RECENT CHANGE'], 'A deploy this morning, and replies are now twice as long. Nothing is exposed.', 'Twin: also after a deploy, but no exposure: roll back.', { laxStamp: 'KEPT GOING' }),
      ]),
      V('MI3c', {}, 'incidents', [
        K('rollback', 'clear', null, 'Search results got much worse after the index update', ['RECENT CHANGE'], 'Results were good until last night\'s index update. Now the top hits are off-topic.', 'It broke right after a change.'),
        K('retry', 'trap', null, 'One bad search result after Thursday\'s index update', ['RARE'], 'Thursday\'s update went fine. One search today returned an odd result, and the next hundred were good.', 'One-off, not caused by the change: retry.', { strictStamp: 'OVER-REACTED' }),
        K('rollback', 'twin', 'speed', 'Page load doubled after Monday\'s model swap', ['RECENT CHANGE'], 'Pages loaded in one second until Monday\'s swap. Now it takes two.', 'It followed a change.', { laxStamp: 'KEPT GOING' }),
        K('takeover', 'twin', 'speed', 'Page load doubled, nothing changed on our side for a month', ['LONG'], 'We made no change for a month, and the slowdown has lasted for days.', 'Twin: same slowdown, but no change behind it and it lasts.', { laxStamp: 'LEFT TO ITSELF' }),
        K('rollback', 'twin', 'tone', 'Replies turned sarcastic after we changed the system prompt', ['RECENT CHANGE'], 'The system prompt was edited at noon. Since then replies sound sarcastic.', 'It started with the edit.', { laxStamp: 'KEPT GOING' }),
        K('retry', 'twin', 'tone', 'One sarcastic reply, the next 90 are polite', ['RARE'], 'One reply had a sarcastic tone. The next ninety were polite.', 'Twin: same tone, but one-off.', { strictStamp: 'OVER-REACTED' }),
      ]),
    ]),
    Cn('MI4', 'incidents', 'Stop and report exposure, harm, runaway cost', 'Data exposure, harm or a runaway bill means stop first and report: do not retry, wait or tidy up quietly.', { lax: 'EXPOSURE MISSED', strict: 'OVER-REACTED' }, [
      V('MI4a', {}, 'incidents', [
        K('stop', 'clear', null, 'A reply showed another customer\'s address', ['PRIVACY'], 'A customer wrote in with a screenshot: the reply included a stranger\'s home address.', 'Data exposure: stop and report.'),
        K('stop', 'trap', null, 'Agent looping all night, bill climbing', ['COST'], 'The agent repeated the same step all night and the usage bill is ten times normal.', 'Runaway cost: stop and report.', { laxStamp: 'LET IT RUN' }),
        K('takeover', 'twin', 'agent', 'Agent stuck on one ticket, waiting for a login', ['LONG'], 'The agent is idle on one ticket until a person supplies a login. Cost is flat.', 'It is stuck, not harmful: a person takes over.', { laxStamp: 'LEFT TO ITSELF', strictStamp: 'OVER-REACTED' }),
        K('stop', 'twin', 'agent', 'Agent emailing contacts it was not told to', ['HARM'], 'The agent is sending emails to customers outside the task, and cannot be told to stop.', 'Twin: also an agent, but causing harm.', { laxStamp: 'HARM CONTINUES' }),
        K('retry', 'twin', 'alert', 'Cost alert fired once, back to normal in a minute', ['BRIEF'], 'A cost alert fired at 2pm and cleared at once. The bill is normal.', 'Brief, no overspend.', { strictStamp: 'OVER-REACTED' }),
        K('stop', 'twin', 'alert', 'Cost alert has fired every hour since the weekend', ['COST'], 'The cost alert has fired hourly since Saturday, and the total is climbing.', 'Twin: also a cost alert, but runaway.', { laxStamp: 'LET IT RUN' }),
      ]),
      V('MI4b', {}, 'incidents', [
        K('stop', 'clear', null, 'The assistant told a user to skip a warning', ['HARM'], 'A user asked about a machine, and the assistant said the safety interlock could be skipped.', 'Harm: stop and report.'),
        K('retry', 'trap', null, 'The assistant refused a harmless request once', ['RARE'], 'A harmless request was refused once. A second try went through.', 'Annoying, not harmful: retry.', { strictStamp: 'OVER-REACTED' }),
        K('stop', 'twin', 'leak', 'A shared link made an internal file public', ['EXPOSURE'], 'A link set to “anyone can open” points at an internal file with client names.', 'Data exposure: stop and report.', { laxStamp: 'EXPOSURE MISSED' }),
        K('rollback', 'twin', 'leak', 'A shared link now shows the wrong page after an update', ['RECENT CHANGE'], 'After yesterday\'s update, a shared link opens the wrong public page. Nothing private is shown.', 'Twin: also a link, but only a broken change.', { laxStamp: 'KEPT GOING' }),
        K('stop', 'twin', 'bill', 'The model bill doubled overnight with no new users', ['COST'], 'Usage cost doubled overnight, and no new users or tasks can explain it.', 'Runaway cost: stop and report.', { laxStamp: 'LET IT RUN' }),
        K('takeover', 'twin', 'bill', 'The model bill is a little higher after a busy launch week', ['LONG'], 'Launch week was busy, and the bill is 10% higher, matching the extra work.', 'Twin: also a higher bill, but explained: a person reviews it.', { laxStamp: 'LEFT TO ITSELF', strictStamp: 'OVER-REACTED' }),
      ]),
      V('MI4c', {}, 'incidents', [
        K('stop', 'clear', null, 'Customer bank details appeared in a public reply', ['PRIVACY'], 'A reply on the public help forum included a customer\'s bank account number.', 'Data exposure: stop and report.'),
        K('takeover', 'trap', null, 'Chatbot gives old opening hours since the shop moved', ['NEW FACTS'], 'The shop moved last week, and the bot still quotes the old address and hours.', 'Wrong, but not harmful: a person updates its data.', { laxStamp: 'LEFT TO ITSELF', strictStamp: 'OVER-REACTED' }),
        K('stop', 'twin', 'loop', 'Retry loop sending 500 requests a second, bill climbing', ['COST'], 'A failed call is retried without a limit, and the bill rises every minute.', 'Runaway cost: stop and report.', { laxStamp: 'LET IT RUN' }),
        K('retry', 'twin', 'loop', 'One retry sent three extra requests, bill unchanged', ['BRIEF'], 'A single failed call was retried three times and then succeeded.', 'Twin: also a retry, but brief and cheap.', { strictStamp: 'OVER-REACTED' }),
        K('stop', 'twin', 'advice', 'The assistant is giving dangerous medical advice to customers', ['HARM'], 'Customers are told to double a medicine dose, and replies keep going out.', 'Harm: stop and report.', { laxStamp: 'HARM CONTINUES' }),
        K('rollback', 'twin', 'advice', 'The assistant\'s medical-advice wording got vaguer after an edit', ['RECENT CHANGE'], 'After an edit the replies say “ask a professional” more often. Nothing is unsafe.', 'Twin: same topic, but only a change that made it vaguer.', { laxStamp: 'KEPT GOING' }),
      ]),
    ]),
  ];

  // ================================================================ FINALE · RUSH HOUR
  const RUSH = Cn('MF1', 'rush', 'Rush hour', 'The same skills, faster: read the plates, and let the rule of each wave pick the bin.', { lax: '', strict: '' }, []);
  const FINALE = { crates: 14, waves: [4, 4, 3, 3], minTraps: 3, minPairs: 3, spacing: 2.8, pause: 1.2, banner: 'Shift change: new plates, same crates' };
  // the numbers of a run (the engine and the world read these): shifts, seconds, belt, brake, desk, costs
  const RUN = { shifts: 5, brief: 6, belt: 40, debrief: 8, crates: 12, spacing: 3.0, traverse: 7, maxInZone: 4, brake: 3, brakeSpeed: 0.4, relaxed: 0.75, desk: 6, costs: [1, 2, 4, 8], reviewCap: 5, ladder: 4 };

  const CONCEPTS = [].concat(DOORS, TIERS, CHECKS, INCIDENTS);
  const byId = Object.fromEntries(CONCEPTS.map((c) => [c.id, c]));
  const fill = (s, p) => String(s).replace(/\{(\w+)\}/g, (m, k) => (p && p[k] != null ? p[k] : m));
  // a concept's default stamps fill any item that sets none: every item then carries laxStamp and strictStamp
  for (const c of CONCEPTS) for (const v of c.variants) for (const it of v.items) { it.laxStamp = it.laxStamp || c.stamps.lax; it.strictStamp = it.strictStamp || c.stamps.strict; }
  // an item with its placeholders filled from params (an object of name -> value)
  const expand = (item, params) => {
    const f = (s) => fill(s, params), o = Object.assign({}, item, { chips: item.chips.map(f) });
    for (const k of ['text', 'full', 'tell', 'laxStamp', 'strictStamp']) o[k] = f(o[k]);
    return o;
  };
  // the rank of a bin id in its side's ladder (0 = most permissive)
  const rankOf = (side, binId) => SIDES[side].bins.findIndex((b) => b.id === binId);
  // the side 3 rule in code, so the bank can be checked against its own brief: missing information = ask; otherwise the stakes pick the check, and a confidence under 0.60 moves it one step
  // stricter (never beyond expert review)
  const expectedCheck = (it) => (it.missing ? 'ask' : ['send', 'quick', 'expert'][Math.min(2, { low: 0, medium: 1, high: 2 }[it.stakes] + (it.confidence < 0.6 ? 1 : 0))]);
  const api = { LIMITS, SAMPLE_NOTICE, SIDES, SIDE_IDS, CONCEPTS, RUSH, FINALE, RUN, byId, fill, expand, rankOf, expectedCheck };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.MILL_CONTENT = api;
})(this);
