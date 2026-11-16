-- Customers can tick a box at checkout to show their first name on the honeycomb. An order placed with the box ticked
-- is shown straight away, and the time of the agreement is kept with the order.

alter table customer_orders
  add column honeycomb_consent_at timestamptz;

-- Saves an order and its lines. This is the 20261107120000_customer_orders.sql function with two additions: the
-- honeycomb flag from the checkout box, and the time the customer agreed.
create or replace function customer_order_insert(p jsonb)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_id uuid;
  v_show boolean := coalesce((p->>'show_on_honeycomb')::boolean, false);
begin
  insert into customer_orders (
    reference, customer_name, phone, email, city, address, referral, notes,
    subtotal_minor, membership_discount_minor, total_minor, created_at,
    show_on_honeycomb, honeycomb_consent_at
  ) values (
    p->>'reference', p->>'customer_name', p->>'phone', nullif(p->>'email', ''), p->>'city', p->>'address',
    nullif(p->>'referral', ''), nullif(p->>'notes', ''),
    (p->>'subtotal_minor')::integer, (p->>'membership_discount_minor')::integer, (p->>'total_minor')::integer,
    coalesce((p->>'created_at')::timestamptz, now()),
    v_show, case when v_show then now() end
  )
  on conflict (reference) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from customer_orders where reference = p->>'reference';
    return jsonb_build_object('result', 'existing', 'id', v_id);
  end if;

  insert into customer_order_items (order_id, line_key, name, size_label, quantity, unit_price_minor, line_total_minor)
  select v_id, item->>'line_key', item->>'name', item->>'size_label', (item->>'quantity')::integer,
         (item->>'unit_price_minor')::integer, (item->>'line_total_minor')::integer
    from jsonb_array_elements(p->'items') as item;

  return jsonb_build_object('result', 'inserted', 'id', v_id);
end;
$$;

do $$
declare
  role_name text;
begin
  revoke all on function customer_order_insert(jsonb) from public;
  foreach role_name in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = role_name) then
      execute format('revoke all on function customer_order_insert(jsonb) from %I', role_name);
    end if;
  end loop;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function customer_order_insert(jsonb) to service_role;
  end if;
end;
$$;
