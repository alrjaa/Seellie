#!/usr/bin/env bash
#
# SEELLIE COMPREHENSIVE FIX v1.0 (safe)
#
# إصلاح وتحقق آمن — بدون تعديلات مدمرة على الكود أو التبعيات.
#
# التشغيل:
#   npm run comprehensive-fix
#   npm run comprehensive-fix -- --skip-tests
#   npm run comprehensive-fix -- --with-build
#
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BRIGHT='\033[1m'
DIM='\033[2m'
NC='\033[0m'

SUCCESS="✅"
ERROR="❌"
WARNING="⚠️ "
INFO="ℹ️ "
ROCKET="🚀"
SHIELD="🛡️"

START_TIME=$(date +%s)
FIXES_APPLIED=0
SKIP_TESTS=false
WITH_BUILD=false

for arg in "$@"; do
  case "$arg" in
    --skip-tests) SKIP_TESTS=true ;;
    --with-build) WITH_BUILD=true ;;
  esac
done

log_section() {
  echo -e "\n${BRIGHT}${BLUE}▶ $1${NC}"
  echo -e "${DIM}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

log_success() {
  echo -e "  ${SUCCESS} ${GREEN}$1${NC}"
  FIXES_APPLIED=$((FIXES_APPLIED + 1))
}

log_error() {
  echo -e "  ${ERROR} ${RED}$1${NC}"
}

log_warning() {
  echo -e "  ${WARNING} ${YELLOW}$1${NC}"
}

log_info() {
  echo -e "  ${INFO} ${CYAN}$1${NC}"
}

print_header() {
  local version="unknown"
  if [[ -f app.config.ts ]]; then
    version=$(grep -Eo "version:\s*'[^']+'" app.config.ts | head -1 | grep -Eo "[0-9.]+" || echo "unknown")
  fi
  clear
  echo -e "\n${BRIGHT}${CYAN}╔════════════════════════════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BRIGHT}${CYAN}║${NC}${BRIGHT}  🔧 SEELLIE — إصلاح وتحقق آمن v1.0 ${ROCKET}${NC}${BRIGHT}${CYAN}                              ║${NC}"
  echo -e "${BRIGHT}${CYAN}║${NC}${BRIGHT}  الإصدار: v${version}  •  بدون تعديلات مدمرة على الكود${NC}${BRIGHT}${CYAN}                         ║${NC}"
  echo -e "${BRIGHT}${CYAN}╚════════════════════════════════════════════════════════════════════════════════════╝${NC}\n"
  log_warning "لا يحذف console.log ولا يشغّل npm audit fix --force ولا يعيد تنسيق المشروع بالكامل."
}

check_environment() {
  log_section "🔍 فحص البيئة"
  command -v node >/dev/null || { log_error "Node.js غير مثبت"; exit 1; }
  log_success "Node.js: $(node --version)"
  command -v npm >/dev/null || { log_error "npm غير مثبت"; exit 1; }
  log_success "npm: $(npm --version)"
  [[ -f package.json ]] || { log_error "package.json غير موجود"; exit 1; }
  log_success "package.json موجود"
  if [[ ! -d node_modules ]]; then
    log_warning "node_modules مفقود — تثبيت التبعيات..."
    npm install
  fi
  log_success "node_modules جاهز"
}

audit_security_readonly() {
  log_section "${SHIELD} فحص الأمان (قراءة فقط)"
  if npm audit --production >/dev/null 2>&1; then
    log_success "npm audit: لا توجد ثغرات حرجة ظاهرة"
  else
    log_warning "npm audit: توجد تحذيرات — راجع يدوياً (لا نستخدم audit fix --force)"
  fi
  [[ -f .env ]] && log_success ".env موجود" || log_warning ".env غير موجود — انسخ من .env.example"
  if [[ -f .gitignore ]] && grep -q '^\.env' .gitignore; then
    log_success ".env مدرج في .gitignore"
  else
    log_warning ".env غير مدرج في .gitignore"
  fi
}

run_typecheck() {
  log_section "🔤 TypeScript"
  if npm run typecheck; then
    log_success "typecheck نجح"
  else
    log_error "typecheck فشل — أصلح الأخطاء يدوياً في الملفات المذكورة"
    exit 1
  fi
}

run_unit_tests() {
  log_section "🧪 اختبارات الوحدة"
  if [[ "$SKIP_TESTS" == true ]]; then
    log_info "تم تخطي الاختبارات (--skip-tests)"
    return
  fi
  if npm run test; then
    log_success "اختبارات الوحدة نجحت"
  else
    log_error "اختبارات الوحدة فشلت"
    exit 1
  fi
}

run_comprehensive_test() {
  log_section "🧪 الفحص الشامل"
  local args=(--skip-build)
  [[ "$WITH_BUILD" == true ]] && args=()
  if npm run comprehensive-test -- "${args[@]}"; then
    log_success "comprehensive-test نجح"
  else
    log_error "comprehensive-test فشل"
    exit 1
  fi
}

optional_web_build() {
  if [[ "$WITH_BUILD" != true ]]; then
    log_info "تخطي build:web (استخدم --with-build لتضمينه)"
    return
  fi
  log_section "🏗️  بناء الويب"
  if npm run build:web; then
    log_success "build:web نجح"
  else
    log_warning "build:web فشل"
  fi
}

report_console_usage() {
  log_section "📝 تقرير console (بدون حذف)"
  local count
  count=$(find src app -type f \( -name '*.ts' -o -name '*.tsx' \) -print0 2>/dev/null \
    | xargs -0 grep -l 'console\.' 2>/dev/null | wc -l | tr -d ' ')
  if [[ "$count" -gt 0 ]]; then
    log_warning "$count ملف يحتوي console.* — راجع يدوياً ما يجب إبقاؤه"
  else
    log_success "لا توجد console.* في src/app"
  fi
}

print_summary() {
  local end_time duration
  end_time=$(date +%s)
  duration=$((end_time - START_TIME))
  log_section "📊 الملخص"
  echo -e "  ${GREEN}${SUCCESS} خطوات ناجحة: ${FIXES_APPLIED}${NC}"
  echo -e "  ⏱️  المدة: ${duration}s"
  echo -e "\n${BRIGHT}${GREEN}${ROCKET} اكتمل التحقق الآمن.${NC}\n"
}

main() {
  print_header
  check_environment
  audit_security_readonly
  run_typecheck
  run_unit_tests
  optional_web_build
  run_comprehensive_test
  report_console_usage
  print_summary
}

main "$@"
