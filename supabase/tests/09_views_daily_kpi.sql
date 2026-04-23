begin;
select plan(5);

select has_view('v_daily_kpi');
select has_view('v_ai_metrics');
select has_view('v_wip_flow');
select has_view('v_cost_ratio');
select has_view('v_lot_summary');

select * from finish();
rollback;
