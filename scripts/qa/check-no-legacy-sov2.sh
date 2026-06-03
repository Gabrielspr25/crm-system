#!/usr/bin/env bash
# Guardrail anti-legacy SOV2 - VentasProui CRM
#
# Falla con exit 1 si encuentra codigo legacy real fuera de los archivos SOV2
# actuales permitidos. No bloquea funcionalidad SOV2 activa como crear
# oportunidades o las tablas propias de SOV2.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
FAILED=0

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

GREP_EXCLUDE_DIRS=(
  --exclude-dir=node_modules
  --exclude-dir=dist
  --exclude-dir=".git"
  --exclude-dir=".trash"
  --exclude-dir=docs
  --exclude-dir=backups
  --exclude-dir=archive
  --exclude-dir="07-Proyectos"
)

GREP_EXCLUDE_FILES=(
  --exclude="*.md"
  --exclude="*.bak"
  --exclude="*.bak.*"
  --exclude="*.backup"
  --exclude="*.sql"
  --exclude="check-no-legacy-sov2.sh"
  --exclude="sov2Controller.js"
  --exclude="sov2Routes.js"
  --exclude="SeguimientoOperativo.tsx"
)

SOV2_ALLOWED_FILES=(
  "$ROOT/src/backend/controllers/sov2Controller.js"
  "$ROOT/src/backend/routes/sov2Routes.js"
  "$ROOT/src/react-app/pages/SeguimientoOperativo.tsx"
)

SEARCH_TARGETS=(
  "$ROOT/src/react-app"
  "$ROOT/src/backend/routes"
  "$ROOT/src/backend/controllers"
)

echo ""
echo "SOV2 anti-legacy guardrail"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "  Root: $ROOT"
echo "  ----------------------------------------"

check_pattern() {
  local desc="$1"
  local pattern="$2"
  local exclusion="${3:-}"

  local raw_results
  raw_results=$(
    grep -rn \
      "${GREP_EXCLUDE_DIRS[@]}" \
      "${GREP_EXCLUDE_FILES[@]}" \
      --exclude="app.js" \
      --exclude="systemTestController.js" \
      --include="*.ts" \
      --include="*.tsx" \
      --include="*.js" \
      --include="*.jsx" \
      -E "$pattern" \
      "${SEARCH_TARGETS[@]}" 2>/dev/null || true
  )

  local results="$raw_results"
  if [ -n "$results" ]; then
    results=$(echo "$results" | grep -vE 'src/backend/controllers/sov2Controller\.js|src/backend/routes/sov2Routes\.js|src/react-app/pages/SeguimientoOperativo\.tsx|src/backend/controllers/systemTestController\.js' || true)
  fi
  if [ -n "$exclusion" ] && [ -n "$raw_results" ]; then
    results=$(echo "$results" | grep -vE "$exclusion" || true)
  fi

  if [ -n "$results" ]; then
    echo ""
    echo -e "${RED}  X PATRON PROHIBIDO: $desc${NC}"
    echo "$results" | head -15 | while IFS= read -r line; do
      echo "    $line"
    done
    local count
    count=$(echo "$results" | wc -l | tr -d ' ')
    echo -e "${YELLOW}    -> $count ocurrencia(s)${NC}"
    FAILED=1
  fi
}

check_files_pattern() {
  local desc="$1"
  local pattern="$2"
  shift 2

  local existing_files=()
  for file in "$@"; do
    if [ -f "$file" ]; then
      existing_files+=("$file")
    fi
  done

  if [ "${#existing_files[@]}" -eq 0 ]; then
    return
  fi

  local raw_results
  raw_results=$(grep -n -E "$pattern" "${existing_files[@]}" 2>/dev/null || true)

  if [ -n "$raw_results" ]; then
    echo ""
    echo -e "${RED}  X PATRON PROHIBIDO: $desc${NC}"
    echo "$raw_results" | head -15 | while IFS= read -r line; do
      echo "    $line"
    done
    local count
    count=$(echo "$raw_results" | wc -l | tr -d ' ')
    echo -e "${YELLOW}    -> $count ocurrencia(s)${NC}"
    FAILED=1
  fi
}

# My Day legacy activo. Se permiten stubs retirados y el endpoint de metas
# /api/goals/my-day porque no es la pagina legacy.
check_pattern \
  "MyDay/myDay legacy activo" \
  '(import|from|<|/>|export|href|to|path|Link|NavItem|"name").*(MyDay|myDay|/mi-dia)' \
  '(MyDayResponse|RETIRADO|Pendiente eliminar|api/goals/my-day|Navigate.*replace)'

check_pattern \
  "Etiqueta UI Mi Dia legacy activa" \
  'Mi\s+D[ií]a|Mi\s+d[ií]a|Mi\s+dia|Mi\s+Dia' \
  '(RETIRADO|Pendiente eliminar|api/goals/my-day|^\S+:[0-9]+:\s*//|^\S+:[0-9]+:\s*\*)'

# FollowUp legacy fuera de SOV2. Se evita bloquear solo menciones historicas
# en archivos retirados o controladores no activos.
check_pattern \
  "followUp legacy activo fuera de SOV2" \
  '(FollowUpPage|path="/seguimiento".*FollowUp|element=\{<FollowUpPage)' \
  '(src/react-app/pages/MyDay.tsx|src/backend/controllers/myDayController.js|systemTestController)'

# Pasos legacy eliminados.
check_pattern \
  "category_steps/category steps legacy activo" \
  '(category_steps|categoryStepsRoutes|categoryStepsSingleRoutes|category-steps)' \
  ''

check_pattern \
  "client_steps/client steps legacy activo" \
  '(client_steps|clientStepsRoutes|clientId/steps)' \
  ''

# Oportunidades legacy fuera de SOV2. Los archivos SOV2 actuales estan
# excluidos arriba, por lo que sales_opportunities/opportunity_steps son
# permitidos solo en SOV2.
check_pattern \
  "rutas antiguas de oportunidades fuera de SOV2" \
  '(ClientOpportunitiesV2Tab|Oportunidades\s+V2|sales_opportunities|opportunity[_-]steps)' \
  ''

# crm_deal_tasks solo debe disparar si se reintroduce dentro de SOV2.
check_files_pattern \
  "crm_deal_tasks dentro de SOV2" \
  'crm_deal_tasks' \
  "${SOV2_ALLOWED_FILES[@]}"

echo ""
echo "  ----------------------------------------"
if [ "$FAILED" -eq 0 ]; then
  echo -e "${GREEN}  OK: sin legacy SOV2 prohibido.${NC}"
  echo ""
  exit 0
fi

echo -e "${RED}  FALLA: revisar patrones legacy antes de continuar.${NC}"
echo ""
exit 1
