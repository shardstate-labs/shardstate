-- Remove direct API execution from internal helpers. These are called by
-- triggers, service_role jobs, or server-authoritative RPCs.

revoke execute on function public.award_card_xp(text[], integer) from authenticated;
revoke execute on function public.handle_new_user() from authenticated;
revoke execute on function public.log_admin_action(uuid, text, jsonb) from authenticated;
revoke execute on function public.prevent_collection_wipe() from authenticated;
revoke execute on function public.rls_auto_enable() from authenticated;
revoke execute on function public.sync_card_instances_from_owned() from authenticated;
revoke execute on function public.grant_referral_flux_once(uuid, uuid) from authenticated;

grant execute on function public.grant_referral_flux_once(uuid, uuid) to service_role;

alter function public.card_xp_needed(integer) set search_path = public;
alter function public.tg_set_updated_at() set search_path = public;
alter function public.tg_decks_max_5() set search_path = public;
