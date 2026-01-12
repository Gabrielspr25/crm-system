#!/bin/bash

# Test follow-up endpoint
echo "=== Testing /api/follow-up-prospects ==="

# Get token from database user directly
TOKEN=$(psql -U crm_user -d crm_pro -t -c "SELECT 'test-token'")

# Try without auth (should fail but show error)
echo "Without auth:"
curl -s http://localhost:3001/api/follow-up-prospects | jq .

echo ""
echo "=== Testing direct DB query ==="
psql -U crm_user -d crm_pro -c "
  SELECT 
    p.id,
    p.company_name,
    p.is_active,
    c.name as client_name
  FROM follow_up_prospects p
  JOIN clients c ON p.client_id = c.id
  WHERE COALESCE(p.is_active, true) = true
    AND COALESCE(p.is_completed, false) = false
  ORDER BY p.created_at DESC
  LIMIT 5
"
