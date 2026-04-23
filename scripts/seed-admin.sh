#!/usr/bin/env bash
# Idempotent admin seeder for local dev / E2E
set -euo pipefail

SERVICE="$(supabase status -o env | grep '^SERVICE_ROLE_KEY=' | cut -d'"' -f2)"

curl -s -X POST "http://127.0.0.1:54321/auth/v1/admin/users" \
  -H "apikey: $SERVICE" -H "Authorization: Bearer $SERVICE" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@ongi.kr","password":"ongi1234","email_confirm":true,"user_metadata":{"full_name":"관리자"}}' \
  > /dev/null 2>&1 || true

psql "postgres://postgres:postgres@127.0.0.1:54322/postgres" \
  -c "update profiles set role='admin' where id=(select id from auth.users where email='admin@ongi.kr');" \
  > /dev/null

echo "admin@ongi.kr seeded with role=admin"
