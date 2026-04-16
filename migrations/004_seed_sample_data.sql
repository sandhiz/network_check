INSERT INTO hosts (
  label,
  ip_address,
  description,
  group_name,
  ping_interval,
  is_active,
  owner_name,
  owner_team
) VALUES
  ('Gateway Utama', '192.168.1.1', 'Router inti kantor', 'Network Core', 30, 1, 'Tim Network', 'Infrastructure'),
  ('Server Aplikasi', '192.168.1.10', 'Server aplikasi internal', 'Production', 60, 1, 'Rina', 'Backend'),
  ('PC Finance', '192.168.1.24', 'Workstation divisi finance', 'Office', 90, 1, 'Budi', 'Finance')
ON DUPLICATE KEY UPDATE
  label = VALUES(label),
  description = VALUES(description),
  group_name = VALUES(group_name),
  ping_interval = VALUES(ping_interval),
  is_active = VALUES(is_active),
  owner_name = VALUES(owner_name),
  owner_team = VALUES(owner_team);