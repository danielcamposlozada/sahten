-- Rutas de búsqueda fijas para las funciones nuevas de delivery.
-- No cambia datos, tarifas, permisos de negocio ni pedidos.
alter function public.guard_delivery_v2_order() set search_path = pg_catalog, public;
alter function public.delivery_order_financials(jsonb) set search_path = pg_catalog, public;
