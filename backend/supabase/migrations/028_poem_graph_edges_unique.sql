-- 028_poem_graph_edges_unique.sql
-- Prevent duplicate semantic graph edges regardless of source/target order.

WITH ranked_edges AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY
        LEAST(source_node_id::text, target_node_id::text),
        GREATEST(source_node_id::text, target_node_id::text),
        edge_type
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM poem_graph_edges
  WHERE source_node_id IS NOT NULL
    AND target_node_id IS NOT NULL
)
DELETE FROM poem_graph_edges
WHERE id IN (
  SELECT id FROM ranked_edges WHERE rn > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_poem_graph_edges_unique_pair
  ON poem_graph_edges (
    LEAST(source_node_id::text, target_node_id::text),
    GREATEST(source_node_id::text, target_node_id::text),
    edge_type
  );
