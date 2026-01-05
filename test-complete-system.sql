-- Script para probar datos en BD
\echo '==== USERS ===='
SELECT id, username, salesperson_id FROM users_auth LIMIT 2;

\echo '==== SALESPEOPLE ===='
SELECT id, name, email FROM salespeople LIMIT 2;

\echo '==== PRODUCTS ===='
SELECT COUNT(*) as total_products FROM products;

\echo '==== CATEGORIES ===='
SELECT COUNT(*) as total_categories FROM categories;

\echo '==== VENDORS ===='
SELECT COUNT(*) as total_vendors FROM vendors;

\echo '==== PRIORITIES ===='
SELECT COUNT(*) as total_priorities FROM priorities;

\echo '==== CLIENTS ===='
SELECT COUNT(*) as total_clients FROM clients;

\echo '==== BANS ===='
SELECT COUNT(*) as total_bans FROM bans;

\echo '==== SUBSCRIBERS ===='
SELECT COUNT(*) as total_subscribers FROM subscribers;

\echo '==== FOLLOW_UP_PROSPECTS ===='
SELECT COUNT(*) as total_prospects FROM follow_up_prospects WHERE is_active = true;

\echo '==== INCOMES ===='
SELECT COUNT(*) as total_incomes FROM incomes;

\echo '==== SALES_REPORTS ===='
SELECT COUNT(*) as total_reports FROM sales_reports;

\echo '==== PIPELINE_NOTES ===='
SELECT COUNT(*) as total_notes FROM pipeline_notes;
