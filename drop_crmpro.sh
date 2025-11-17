sudo -u postgres psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='CRM-pro';"
sudo -u postgres dropdb CRM-pro