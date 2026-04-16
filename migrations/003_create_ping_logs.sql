CREATE TABLE IF NOT EXISTS ping_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  host_id INT UNSIGNED NOT NULL,
  status ENUM('up', 'down') NOT NULL,
  latency_ms FLOAT NULL,
  packet_loss TINYINT NOT NULL DEFAULT 0,
  error_msg VARCHAR(255) NULL,
  pinged_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_ping_logs_host_id (host_id),
  KEY idx_ping_logs_pinged_at (pinged_at),
  KEY idx_ping_logs_status (status),
  CONSTRAINT fk_ping_logs_host
    FOREIGN KEY (host_id)
    REFERENCES hosts (id)
    ON DELETE CASCADE
);