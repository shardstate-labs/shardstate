do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'market_listings'
      and policyname = 'buyer reads own purchases'
  ) then
    create policy "buyer reads own purchases"
      on public.market_listings
      for select
      using (buyer_uid = auth.uid());
  end if;
end $$;
