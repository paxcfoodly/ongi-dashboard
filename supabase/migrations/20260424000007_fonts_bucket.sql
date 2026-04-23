-- Private bucket for system assets (fonts etc.)
insert into storage.buckets (id, name, public)
values ('system-assets', 'system-assets', false)
on conflict (id) do nothing;

-- Reports bucket (used by generate-pdf in Task 3)
insert into storage.buckets (id, name, public)
values ('reports', 'reports', false)
on conflict (id) do nothing;
