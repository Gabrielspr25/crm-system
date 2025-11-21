-- Columnas de clients
SELECT 'clients' as table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'clients'
ORDER BY ordinal_position;

-- Columnas de bans
SELECT 'bans' as table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'bans'
ORDER BY ordinal_position;

-- Columnas de subscribers
SELECT 'subscribers' as table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'subscribers'
ORDER BY ordinal_position;

