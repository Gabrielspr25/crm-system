SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'follow_up_prospects' 
AND column_name IN ('id', 'client_id');
