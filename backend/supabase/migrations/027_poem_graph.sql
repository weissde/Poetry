-- 027_poem_graph.sql
-- Phase 3: Graph semantic layer for persistent knowledge graph nodes and edges

CREATE TABLE IF NOT EXISTS poem_graph_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poem_id UUID REFERENCES poems(id) ON DELETE CASCADE,
  node_type TEXT NOT NULL CHECK (node_type IN ('poet', 'imagery', 'theme', 'dynasty', 'emotion', 'technique')),
  label TEXT NOT NULL,
  weight REAL DEFAULT 1.0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS poem_graph_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_node_id UUID REFERENCES poem_graph_nodes(id) ON DELETE CASCADE,
  target_node_id UUID REFERENCES poem_graph_nodes(id) ON DELETE CASCADE,
  edge_type TEXT NOT NULL DEFAULT 'shared_tag',
  weight REAL DEFAULT 1.0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_poem_graph_nodes_poem_id ON poem_graph_nodes(poem_id);
CREATE INDEX IF NOT EXISTS idx_poem_graph_nodes_type_label ON poem_graph_nodes(node_type, label);
CREATE INDEX IF NOT EXISTS idx_poem_graph_nodes_type ON poem_graph_nodes(node_type);
CREATE INDEX IF NOT EXISTS idx_poem_graph_edges_source ON poem_graph_edges(source_node_id);
CREATE INDEX IF NOT EXISTS idx_poem_graph_edges_target ON poem_graph_edges(target_node_id);

-- Unique constraint to prevent duplicate nodes for the same poem+type+label
CREATE UNIQUE INDEX IF NOT EXISTS idx_poem_graph_nodes_unique
  ON poem_graph_nodes(poem_id, node_type, label);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_poem_graph_nodes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_poem_graph_nodes_updated_at ON poem_graph_nodes;
CREATE TRIGGER trg_poem_graph_nodes_updated_at
  BEFORE UPDATE ON poem_graph_nodes
  FOR EACH ROW EXECUTE FUNCTION update_poem_graph_nodes_updated_at();
