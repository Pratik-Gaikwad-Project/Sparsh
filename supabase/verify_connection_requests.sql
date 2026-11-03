-- Read-only verification queries for Supabase SQL Editor.
-- Run after applying 202610280001_connection_requests.sql.
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'connection_requests'
order by ordinal_position;

select indexname, indexdef
from pg_indexes
where schemaname = 'public' and tablename = 'connection_requests'
order by indexname;

select p.polname, p.polcmd, pg_get_expr(p.polqual, p.polrelid) as using_expression,
       pg_get_expr(p.polwithcheck, p.polrelid) as check_expression
from pg_policy p
join pg_class c on c.oid = p.polrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'connection_requests';

select routine_name, privilege_type, grantee
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name in ('send_connection_request','list_connection_requests',
    'accept_connection_request','reject_connection_request','cancel_connection_request','pair_with_code')
order by routine_name, grantee, privilege_type;
