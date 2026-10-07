-- Reference data, loaded from the accounts CSV
CREATE TABLE accounts (
  account_id     TEXT PRIMARY KEY,                 -- ACC1001
  customer_name  TEXT NOT NULL,
  account_type   TEXT NOT NULL,                    -- CHEQUING, SAVINGS, ...
  status         TEXT NOT NULL,                    -- ACTIVE, FROZEN, CLOSED, ...
  balance        NUMERIC(14,2) NOT NULL,
  daily_limit    NUMERIC(14,2) NOT NULL,
  currency       CHAR(3) NOT NULL,
  opened_date    DATE NOT NULL
);

-- One row per uploaded file / batch
CREATE TABLE processing_runs (
  id             BIGSERIAL PRIMARY KEY,
  source_file    TEXT NOT NULL,
  started_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at   TIMESTAMPTZ,
  status         TEXT NOT NULL DEFAULT 'RUNNING'   -- RUNNING, COMPLETED, FAILED
);

-- Every CSV row as received. Typed columns are nullable so bad rows still load.
CREATE TABLE transactions (
  id             BIGSERIAL PRIMARY KEY,
  run_id         BIGINT NOT NULL REFERENCES processing_runs(id),
  line_number    INT NOT NULL,
  raw_line       TEXT NOT NULL,
  transaction_id TEXT,                              -- NOT unique: duplicates must be storable
  occurred_at    TIMESTAMP,                         -- no tz in source; assumed bank local time
  type           TEXT,                              -- TRANSFER, PURCHASE, DEPOSIT, WITHDRAWAL
  from_account   TEXT,                              -- no FK: invalid accounts must be storable
  to_account     TEXT,
  amount         NUMERIC(14,2),
  channel        TEXT,                              -- ONLINE, POS, ATM, ...
  description    TEXT
);
CREATE INDEX ON transactions (transaction_id);
CREATE INDEX ON transactions (from_account, occurred_at);

-- Exactly one result per transaction row
CREATE TABLE outcomes (
  id                 BIGSERIAL PRIMARY KEY,
  transaction_row_id BIGINT NOT NULL UNIQUE REFERENCES transactions(id),
  status             TEXT NOT NULL CHECK (status IN ('APPROVED','REJECTED')),
  reject_reason      TEXT CHECK (reject_reason IN (
                        'MALFORMED_RECORD','UNSUPPORTED_TYPE','INVALID_ACCOUNT',
                        'INACTIVE_ACCOUNT','INVALID_AMOUNT','DUPLICATE_TRANSACTION',
                        'INSUFFICIENT_FUNDS','CURRENCY_MISMATCH','SAME_ACCOUNT_TRANSFER')),
  processed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((status = 'REJECTED') = (reject_reason IS NOT NULL))
);

-- Zero or more flags per outcome; approved transactions can be flagged
CREATE TABLE review_flags (
  id             BIGSERIAL PRIMARY KEY,
  outcome_id     BIGINT NOT NULL REFERENCES outcomes(id),
  flag_type      TEXT NOT NULL CHECK (flag_type IN ('LARGE_AMOUNT','DAILY_LIMIT_EXCEEDED','HIGH_VELOCITY')),
  detail         TEXT,                              -- e.g. "6 txns in 10 min"
  review_status  TEXT NOT NULL DEFAULT 'PENDING'    -- PENDING, CLEARED, ESCALATED
);

-- Balance movements; a TRANSFER writes two rows, a PURCHASE one
CREATE TABLE account_ledger (
  id             BIGSERIAL PRIMARY KEY,
  account_id     TEXT NOT NULL REFERENCES accounts(account_id),
  outcome_id     BIGINT NOT NULL REFERENCES outcomes(id),
  occurred_at    TIMESTAMP NOT NULL,                -- copied from the transaction
  delta          NUMERIC(14,2) NOT NULL,            -- negative = debit
  balance_after  NUMERIC(14,2) NOT NULL
);
CREATE INDEX ON account_ledger (account_id, occurred_at);

-- Review thresholds, documented and adjustable
CREATE TABLE rule_config (
  key    TEXT PRIMARY KEY,                          -- large_amount_threshold, velocity_count, velocity_window_minutes
  value  NUMERIC NOT NULL,
  note   TEXT
);

CREATE VIEW run_summary AS
SELECT t.run_id,
       COUNT(*)                                        AS processed,
       COUNT(*) FILTER (WHERE o.status = 'APPROVED')   AS approved,
       COUNT(*) FILTER (WHERE o.status = 'REJECTED')   AS rejected,
       COUNT(DISTINCT f.outcome_id)                    AS flagged
FROM transactions t
JOIN outcomes o ON o.transaction_row_id = t.id
LEFT JOIN review_flags f ON f.outcome_id = o.id
GROUP BY t.run_id;

-- Only the Express server talks to Postgres; lock tables away from the Supabase API roles.
ALTER TABLE accounts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE outcomes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_flags    ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_ledger  ENABLE ROW LEVEL SECURITY;
ALTER TABLE rule_config     ENABLE ROW LEVEL SECURITY;
