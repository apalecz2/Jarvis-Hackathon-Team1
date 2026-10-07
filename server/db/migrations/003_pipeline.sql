-- Configurable processing pipeline. The step catalogue (labels, param schemas, logic) lives in
-- code; this table stores only what an operator can change: order, on/off, and parameters.
CREATE TABLE pipeline_steps (
  key       TEXT PRIMARY KEY,
  position  INT NOT NULL,
  enabled   BOOLEAN NOT NULL DEFAULT TRUE,
  params    JSONB NOT NULL DEFAULT '{}'::jsonb
);
ALTER TABLE pipeline_steps ENABLE ROW LEVEL SECURITY;

-- Snapshot of the pipeline each run was processed with, so results stay explainable.
ALTER TABLE processing_runs ADD COLUMN config JSONB;
