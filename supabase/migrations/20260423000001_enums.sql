create type device_type    as enum ('vision_inspector', 'equipment');
create type lot_status     as enum ('planned', 'running', 'completed', 'paused');
create type claim_status   as enum ('open', 'investigating', 'resolved');
create type severity_level as enum ('info', 'warning', 'danger');
create type alarm_source   as enum ('auto', 'manual', 'system');
create type user_role      as enum ('admin', 'viewer');
