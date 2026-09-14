-- M1 (adjustable member order): one-time backfill only, no schema change.
--
-- Every existing family's roster is renumbered so children sort before every
-- other role, stable within each group by the current sort_order and then by
-- created_at (docs/plans/2026-09-14-member-order.md "Decisions"). New members
-- still append after this runs — `createMember` keeps setting `max(sort_order) + 1`.
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY family_id
      ORDER BY
        (role = 'child') DESC,
        sort_order ASC,
        created_at ASC
    ) - 1 AS new_sort_order
  FROM "member"
)
UPDATE "member"
SET sort_order = ranked.new_sort_order
FROM ranked
WHERE "member".id = ranked.id
  AND "member".sort_order IS DISTINCT FROM ranked.new_sort_order;
