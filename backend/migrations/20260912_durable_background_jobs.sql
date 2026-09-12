-- Durable, PostgreSQL-backed work queue for media-derived background tasks.
-- Binary media stays in object storage; this table only stores small job metadata.

CREATE TABLE IF NOT EXISTS background_jobs (
  job_id BIGSERIAL PRIMARY KEY,
  job_type VARCHAR(80) NOT NULL,
  dedupe_key VARCHAR(300) NOT NULL,
  lesson_id INT REFERENCES lessons(lesson_id) ON DELETE CASCADE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'processing', 'retry', 'completed', 'failed', 'cancelled')),
  priority SMALLINT NOT NULL DEFAULT 0,
  attempts INT NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts INT NOT NULL DEFAULT 5 CHECK (max_attempts BETWEEN 1 AND 20),
  available_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  lease_owner VARCHAR(160),
  lease_token UUID,
  lease_expires_at TIMESTAMPTZ,
  last_error_code VARCHAR(100),
  last_error_message VARCHAR(1000),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_background_jobs_type_key UNIQUE (job_type, dedupe_key),
  CONSTRAINT chk_background_jobs_payload_size
    CHECK (octet_length(payload::text) <= 65536)
);

CREATE INDEX IF NOT EXISTS idx_background_jobs_claim
  ON background_jobs(status, available_at, priority DESC, job_id)
  WHERE status IN ('queued', 'retry', 'processing');
CREATE INDEX IF NOT EXISTS idx_background_jobs_lesson
  ON background_jobs(lesson_id, job_type);
CREATE INDEX IF NOT EXISTS idx_background_jobs_retention
  ON background_jobs(status, completed_at, updated_at)
  WHERE status IN ('completed', 'failed', 'cancelled');

-- Writing lesson_subtitles and publishing the durable job happen in the same
-- PostgreSQL transaction. A process crash after COMMIT therefore cannot lose work.
CREATE OR REPLACE FUNCTION sync_subtitle_background_jobs()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_source TEXT;
  v_payload JSONB;
BEGIN
  v_source := NULLIF(NEW.source_content_url, '');

  IF NEW.subtitle_status = 'pending' AND v_source IS NOT NULL THEN
    v_payload := jsonb_build_object('lessonId', NEW.lesson_id, 'sourceContentUrl', v_source);

    INSERT INTO background_jobs (
      job_type, dedupe_key, lesson_id, payload, status, priority,
      attempts, max_attempts, available_at, updated_at
    )
    VALUES (
      'subtitle_generation', 'lesson:' || NEW.lesson_id, NEW.lesson_id,
      v_payload, 'queued', 100, 0, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
    ON CONFLICT (job_type, dedupe_key) DO UPDATE SET
      lesson_id = EXCLUDED.lesson_id,
      payload = EXCLUDED.payload,
      status = CASE
        WHEN background_jobs.payload = EXCLUDED.payload
         AND background_jobs.status IN ('queued', 'retry')
          THEN background_jobs.status
        WHEN background_jobs.payload = EXCLUDED.payload
         AND background_jobs.status = 'processing'
         AND background_jobs.lease_expires_at > CURRENT_TIMESTAMP
          THEN background_jobs.status
        ELSE 'queued'
      END,
      attempts = CASE
        WHEN background_jobs.payload = EXCLUDED.payload
         AND (
           background_jobs.status IN ('queued', 'retry')
           OR (
             background_jobs.status = 'processing'
             AND background_jobs.lease_expires_at > CURRENT_TIMESTAMP
           )
         ) THEN background_jobs.attempts
        ELSE 0
      END,
      available_at = CASE
        WHEN background_jobs.payload = EXCLUDED.payload
         AND background_jobs.status IN ('queued', 'retry')
          THEN background_jobs.available_at
        WHEN background_jobs.payload = EXCLUDED.payload
         AND background_jobs.status = 'processing'
         AND background_jobs.lease_expires_at > CURRENT_TIMESTAMP
          THEN background_jobs.available_at
        ELSE CURRENT_TIMESTAMP
      END,
      lease_owner = CASE
        WHEN background_jobs.payload = EXCLUDED.payload
         AND background_jobs.status = 'processing'
         AND background_jobs.lease_expires_at > CURRENT_TIMESTAMP
          THEN background_jobs.lease_owner
        ELSE NULL
      END,
      lease_token = CASE
        WHEN background_jobs.payload = EXCLUDED.payload
         AND background_jobs.status = 'processing'
         AND background_jobs.lease_expires_at > CURRENT_TIMESTAMP
          THEN background_jobs.lease_token
        ELSE NULL
      END,
      lease_expires_at = CASE
        WHEN background_jobs.payload = EXCLUDED.payload
         AND background_jobs.status = 'processing'
         AND background_jobs.lease_expires_at > CURRENT_TIMESTAMP
          THEN background_jobs.lease_expires_at
        ELSE NULL
      END,
      last_error_code = CASE
        WHEN background_jobs.payload = EXCLUDED.payload
         AND background_jobs.status IN ('queued', 'retry', 'processing')
          THEN background_jobs.last_error_code
        ELSE NULL
      END,
      last_error_message = CASE
        WHEN background_jobs.payload = EXCLUDED.payload
         AND background_jobs.status IN ('queued', 'retry', 'processing')
          THEN background_jobs.last_error_message
        ELSE NULL
      END,
      completed_at = NULL,
      updated_at = CURRENT_TIMESTAMP;
  END IF;

  -- Downstream AI work is published only after a usable transcript is committed.
  -- It reads cues from lesson_subtitles later, so large transcript data is never
  -- copied into the queue table.
  IF NEW.subtitle_status = 'ready'
     AND v_source IS NOT NULL
     AND jsonb_typeof(COALESCE(NEW.cues, '[]'::jsonb)) = 'array'
     AND jsonb_array_length(COALESCE(NEW.cues, '[]'::jsonb)) > 0 THEN
    v_payload := jsonb_build_object(
      'lessonId', NEW.lesson_id,
      'sourceContentUrl', v_source,
      'transcriptUpdatedAt', NEW.updated_at
    );

    INSERT INTO background_jobs (
      job_type, dedupe_key, lesson_id, payload, status, priority,
      attempts, max_attempts, available_at, updated_at
    )
    VALUES
      ('rag_ingestion', 'lesson:' || NEW.lesson_id, NEW.lesson_id, v_payload, 'queued', 50, 0, 6, CURRENT_TIMESTAMP + INTERVAL '2 minutes', CURRENT_TIMESTAMP),
      ('suggested_questions', 'lesson:' || NEW.lesson_id, NEW.lesson_id, v_payload, 'queued', 40, 0, 5, CURRENT_TIMESTAMP + INTERVAL '2 minutes', CURRENT_TIMESTAMP)
    ON CONFLICT (job_type, dedupe_key) DO UPDATE SET
      lesson_id = EXCLUDED.lesson_id,
      payload = EXCLUDED.payload,
      status = CASE
        WHEN background_jobs.payload = EXCLUDED.payload
         AND background_jobs.status IN ('queued', 'retry', 'processing', 'completed')
          THEN background_jobs.status
        ELSE 'queued'
      END,
      attempts = CASE
        WHEN background_jobs.payload = EXCLUDED.payload
         AND background_jobs.status IN ('queued', 'retry', 'processing', 'completed')
          THEN background_jobs.attempts
        ELSE 0
      END,
      available_at = CASE
        WHEN background_jobs.payload = EXCLUDED.payload
         AND background_jobs.status IN ('queued', 'retry', 'processing', 'completed')
          THEN background_jobs.available_at
        ELSE CURRENT_TIMESTAMP
      END,
      lease_owner = CASE
        WHEN background_jobs.payload = EXCLUDED.payload
         AND background_jobs.status = 'processing'
          THEN background_jobs.lease_owner
        ELSE NULL
      END,
      lease_token = CASE
        WHEN background_jobs.payload = EXCLUDED.payload
         AND background_jobs.status = 'processing'
          THEN background_jobs.lease_token
        ELSE NULL
      END,
      lease_expires_at = CASE
        WHEN background_jobs.payload = EXCLUDED.payload
         AND background_jobs.status = 'processing'
          THEN background_jobs.lease_expires_at
        ELSE NULL
      END,
      last_error_code = CASE WHEN background_jobs.payload = EXCLUDED.payload THEN background_jobs.last_error_code ELSE NULL END,
      last_error_message = CASE WHEN background_jobs.payload = EXCLUDED.payload THEN background_jobs.last_error_message ELSE NULL END,
      completed_at = CASE WHEN background_jobs.payload = EXCLUDED.payload THEN background_jobs.completed_at ELSE NULL END,
      updated_at = CURRENT_TIMESTAMP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lesson_subtitles_publish_jobs ON lesson_subtitles;
CREATE TRIGGER trg_lesson_subtitles_publish_jobs
AFTER INSERT OR UPDATE OF subtitle_status, source_content_url, cues, updated_at
ON lesson_subtitles
FOR EACH ROW EXECUTE FUNCTION sync_subtitle_background_jobs();

-- One-time adoption of work created before the durable queue existed.
INSERT INTO background_jobs (
  job_type, dedupe_key, lesson_id, payload, status, priority,
  attempts, max_attempts, available_at
)
SELECT
  'subtitle_generation', 'lesson:' || ls.lesson_id, ls.lesson_id,
  jsonb_build_object(
    'lessonId', ls.lesson_id,
    'sourceContentUrl', COALESCE(NULLIF(l.storage_key, ''), l.content_url)
  ),
  'queued', 100, 0, 5, CURRENT_TIMESTAMP
FROM lesson_subtitles ls
JOIN lessons l ON l.lesson_id = ls.lesson_id
WHERE ls.subtitle_status IN ('pending', 'processing')
  AND l.content_type IN ('video', 'youtube')
  AND COALESCE(l.media_status, '') <> 'MISSING_SOURCE'
  AND COALESCE(NULLIF(l.storage_key, ''), l.content_url) IS NOT NULL
  AND COALESCE(NULLIF(l.storage_key, ''), l.content_url) <> ''
ON CONFLICT (job_type, dedupe_key) DO NOTHING;

UPDATE lesson_subtitles ls
SET subtitle_status = 'pending', updated_at = CURRENT_TIMESTAMP
FROM lessons l
WHERE l.lesson_id = ls.lesson_id
  AND ls.subtitle_status = 'processing'
  AND l.content_type IN ('video', 'youtube')
  AND COALESCE(l.media_status, '') <> 'MISSING_SOURCE';
