
DROP INDEX idx_sales_history_sale_date;
DROP INDEX idx_sales_history_client_id;
DROP TABLE sales_history;
ALTER TABLE follow_up_prospects DROP COLUMN client_id;
