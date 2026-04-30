-- Harden RPC execution grants: clients must be authenticated unless a
-- function is intentionally public. Internal trigger/helper functions stay
-- callable by their owners, not by anon/public API callers.

revoke execute on all functions in schema public from public;
revoke execute on all functions in schema public from anon;

grant execute on function public.finalize_battle(text, text, text, jsonb) to authenticated;
grant execute on function public.find_or_join_match(text, text[]) to authenticated;
grant execute on function public.leave_queue() to authenticated;
grant execute on function public.finalize_pvp_match(uuid, uuid, jsonb) to authenticated;

grant execute on function public.get_my_account_status() to authenticated;
grant execute on function public.load_my_notifications() to authenticated;
grant execute on function public.load_my_card_instances() to authenticated;

grant execute on function public.list_card_for_sale(text, integer) to authenticated;
grant execute on function public.list_card_instance_for_sale(uuid, integer) to authenticated;
grant execute on function public.delist_card(uuid) to authenticated;
grant execute on function public.buy_listing(uuid) to authenticated;

grant execute on function public.search_profiles(text) to authenticated;
grant execute on function public.profile_card(uuid) to authenticated;
grant execute on function public.load_social_state() to authenticated;
grant execute on function public.send_friend_request(uuid) to authenticated;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;
grant execute on function public.load_dm_thread(uuid) to authenticated;
grant execute on function public.send_dm(uuid, text, text) to authenticated;

grant execute on function public.load_guild_state(text) to authenticated;
grant execute on function public.create_guild(text, text, text, text, text) to authenticated;
grant execute on function public.apply_guild(uuid, text) to authenticated;
grant execute on function public.respond_guild_application(uuid, boolean, text) to authenticated;

grant execute on function public.claim_battle_pass(integer, text) to authenticated;
grant execute on function public.buy_battle_pass_with_flux() to authenticated;

grant execute on function public.admin_search_users(text) to authenticated;
grant execute on function public.admin_get_user_detail(uuid) to authenticated;
grant execute on function public.admin_reset_user(uuid) to authenticated;
grant execute on function public.admin_set_account_status(uuid, text, text) to authenticated;
grant execute on function public.admin_delete_user_game_data(uuid) to authenticated;
grant execute on function public.admin_grant_currency(uuid, text, integer, text) to authenticated;
grant execute on function public.is_shardstate_admin() to authenticated;

grant execute on function public.grant_referral_flux_once(uuid, uuid) to service_role;
