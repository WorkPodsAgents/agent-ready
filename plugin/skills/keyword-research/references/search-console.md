# Reading Search Console

These definitions are the WorkPods defaults (thresholds.json), so a result here matches a
WorkPods audit. Search Console rows can come from any connected MCP tool that returns search
analytics; ask for query and page dimensions together.

| Signal            | Definition                                                                                                                                                                                                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Striking distance | A non-branded query whose average position is 4 to 20, with at least 50 impressions in the window. Lead with those whose page is a money page.                                                                                                                            |
| CTR gap           | Position 10 or better, at least 100 impressions, and a CTR under half the usual CTR for that position. Check the title and meta description first; a SERP feature taking the clicks is not fixed by a new title.                                                          |
| Decay             | A page losing clicks for at least 2 months in a row, at least 20 clicks lost, or 1 or more positions lost while clicks hold. Compare with the same months last year before calling it decay rather than season.                                                           |
| Cannibalisation   | A query with at least 100 impressions where two or more pages each hold at least 10% of its impressions, or where the leading page changes from month to month. A second page with at least 25% of impressions ranking 5 or more places below the leader is worth a look. |

## Rules

- Split branded and non-branded queries. Branded growth can hide a non-branded decline.
- Search Console hides rare queries. Say so when a query-level total is smaller than the site
  total.
- A missing month is a gap, never zero clicks.
- Never mix Search Console clicks with DataForSEO traffic estimates in one figure.
