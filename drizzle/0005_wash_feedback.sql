CREATE TABLE IF NOT EXISTS wash_feedback (
  id text PRIMARY KEY,
  session_id text NOT NULL UNIQUE REFERENCES laundry_sessions(id),
  washer_id text NOT NULL REFERENCES washers(id),
  user_id text NOT NULL REFERENCES users(id),
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  issues jsonb NOT NULL DEFAULT '[]',
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wash_feedback_washer_created_idx ON wash_feedback (washer_id, created_at);
