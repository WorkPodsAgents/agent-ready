# Writing the audit report

`report.md` is for the person who owns the site. Lead with what to do, then the evidence.

## Order

1. **Summary.** Three to five sentences: what blocks search engines, AI answers and agents
   most, and the first fix. Name the numbers ("12 of 40 crawled pages answer 404").
2. **Top problems.** At most ten, in this order:
   - anything that keeps money pages out of search or AI answers (noindex, robots blocks,
     non-200 status, a canonical pointing elsewhere, content only JavaScript renders);
   - problems that waste crawl or link value (redirect chains, broken internal links, orphan
     pages, duplicates);
   - what makes pages harder to cite or use (missing answers, schema gaps, unlabelled
     controls, missing titles or descriptions);
   - hygiene.

   For each: the check id, its severity, how many pages, the root cause, the fix in one or
   two sentences, and two or three example URLs.

3. **By layer.** Short sections for SEO, GEO and AXO with the remaining failing checks.
4. **Not measured.** Checks that were not applicable and why (no extension, crawl stopped,
   optional file absent). Absence of a measurement is never a pass.

## Rules

- Quote counts from the tool results, never estimates.
- An optional file that is missing (llms.txt, agent manifests) is not a problem.
- A training-crawler block is the owner's policy.
- Plain sentences, no hype. Write "the title is 74 characters", not "the title could be
  optimised".
