#!/usr/bin/env bash
# gather-git-data.sh — read-only collection of everything the weekly-report
# skill needs from Git and the repo's config files, in one deterministic pass.
#
# This exists so every report run gathers data the same way instead of the
# model improvising git commands each time (and possibly getting the diff
# range or period math wrong). It never writes anything — no commits, no
# checkouts, no file edits.
#
# Usage:
#   gather-git-data.sh [start-date] [end-date]
#   gather-git-data.sh                 # auto period: continues from the last
#                                       # report if recent, else last 7 days
#   gather-git-data.sh 2026-08-01 2026-08-08   # explicit override
#
# Output: plain, labeled text sections (not JSON — easier to produce
# correctly in bash and just as easy for a model to read).

set -u

# ---- locate repo -----------------------------------------------------
ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
if [ -z "$ROOT" ]; then
  echo "ERROR: not inside a git repository." >&2
  exit 1
fi
cd "$ROOT" || exit 1

BRANCH="$(git branch --show-current 2>/dev/null)"
if [ -z "$BRANCH" ]; then
  BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null)"
fi
REMOTE="$(git remote get-url origin 2>/dev/null)"
[ -z "$REMOTE" ] && REMOTE="none"

REPORTS_DIR="$ROOT/docs/reports"
TODAY="$(date +%Y-%m-%d)"

# ---- resolve the period ------------------------------------------------
START="${1:-}"
END="${2:-$TODAY}"
PERIOD_SOURCE="manual-override"

if [ -z "$START" ]; then
  PERIOD_SOURCE="default-7-days"
  START="$(date -d "$END -7 days" +%Y-%m-%d 2>/dev/null)"
  if [ -d "$REPORTS_DIR" ]; then
    LAST_REPORT_DATE="$(ls "$REPORTS_DIR" 2>/dev/null | grep -oE 'weekly-report-[0-9]{4}-[0-9]{2}-[0-9]{2}\.md' | sed -E 's/weekly-report-(.*)\.md/\1/' | sort | tail -1)"
    if [ -n "$LAST_REPORT_DATE" ]; then
      DAYS_SINCE_LAST=$(( ($(date -d "$END" +%s) - $(date -d "$LAST_REPORT_DATE" +%s)) / 86400 ))
      if [ "$DAYS_SINCE_LAST" -ge 0 ] && [ "$DAYS_SINCE_LAST" -le 14 ] && [ "$LAST_REPORT_DATE" != "$END" ]; then
        START="$(date -d "$LAST_REPORT_DATE +1 day" +%Y-%m-%d)"
        PERIOD_SOURCE="continuation-of-previous-report ($LAST_REPORT_DATE)"
      fi
    fi
  fi
fi

echo "### REPO_INFO"
echo "root=$ROOT"
echo "branch=$BRANCH"
echo "remote=$REMOTE"
echo

echo "### PERIOD"
echo "start=$START"
echo "end=$END"
echo "source=$PERIOD_SOURCE"
echo

echo "### EXISTING_REPORT_FOR_THIS_END_DATE"
if [ -f "$REPORTS_DIR/weekly-report-$END.md" ]; then
  echo "path=docs/reports/weekly-report-$END.md"
  echo "action=UPDATE existing file instead of creating a duplicate"
else
  echo "path=none"
  echo "action=CREATE docs/reports/weekly-report-$END.md"
fi
echo

echo "### PREVIOUS_REPORTS (newest first, excludes this period's file)"
if [ -d "$REPORTS_DIR" ]; then
  ls "$REPORTS_DIR" 2>/dev/null | grep -E '^weekly-report-[0-9]{4}-[0-9]{2}-[0-9]{2}\.md$' | grep -v "weekly-report-$END.md" | sort -r | sed 's/^/docs\/reports\//'
else
  echo "(docs/reports/ does not exist yet — no previous reports)"
fi
echo

echo "### STACK_DETECTED"
[ -f "$ROOT/package.json" ] && echo "node/package.json"
[ -f "$ROOT/tsconfig.json" ] && echo "typescript"
ls "$ROOT"/vite.config.* >/dev/null 2>&1 && echo "vite"
[ -f "$ROOT/firebase.json" ] && echo "firebase-hosting"
[ -f "$ROOT/firestore.rules" ] && echo "firestore"
[ -f "$ROOT/storage.rules" ] && echo "firebase-storage"
ls "$ROOT"/capacitor.config.* >/dev/null 2>&1 && echo "capacitor"
[ -d "$ROOT/android" ] && echo "android-native"
[ -d "$ROOT/ios" ] && echo "ios-native"
[ -f "$ROOT/requirements.txt" ] || [ -f "$ROOT/pyproject.toml" ] && echo "python"
[ -f "$ROOT/go.mod" ] && echo "go"
[ -f "$ROOT/Cargo.toml" ] && echo "rust"
[ -f "$ROOT/pom.xml" ] && echo "java-maven"
[ -f "$ROOT/build.gradle" ] && echo "gradle"
[ -f "$ROOT/docker-compose.yml" ] || [ -f "$ROOT/Dockerfile" ] && echo "docker"
ls "$ROOT"/migrations >/dev/null 2>&1 && echo "sql-migrations"
find "$ROOT" -maxdepth 3 -iname "*.sql" 2>/dev/null | grep -q . && echo "sql-files-present"
[ -f "$ROOT/.github/workflows" ] || ls "$ROOT"/.github/workflows/*.yml >/dev/null 2>&1 && echo "github-actions-ci"
echo

echo "### PACKAGE_SCRIPTS"
if [ -f "$ROOT/package.json" ]; then
  if command -v node >/dev/null 2>&1; then
    node -e "try{const p=require('$ROOT/package.json');const s=p.scripts||{};for(const k in s){console.log(k+': '+s[k])}}catch(e){}" 2>/dev/null
  else
    grep -A 30 '"scripts"' "$ROOT/package.json" | sed -n '2,/}/p'
  fi
else
  echo "(no package.json)"
fi
echo

# ---- commit range -----------------------------------------------------
COMMITS="$(git log --since="$START 00:00:00" --until="$END 23:59:59" --pretty=format:'%H|%ad|%an|%s' --date=short 2>/dev/null)"
COMMIT_COUNT=0
[ -n "$COMMITS" ] && COMMIT_COUNT=$(echo "$COMMITS" | wc -l)

echo "### COMMITS (n=$COMMIT_COUNT, oldest last as returned by git log)"
if [ "$COMMIT_COUNT" -gt 0 ]; then
  echo "$COMMITS"
else
  echo "(no commits found on branch '$BRANCH' in this period)"
fi
echo

if [ "$COMMIT_COUNT" -gt 0 ]; then
  NEWEST_HASH="$(echo "$COMMITS" | head -1 | cut -d'|' -f1)"
  OLDEST_HASH="$(echo "$COMMITS" | tail -1 | cut -d'|' -f1)"
  OLDEST_PARENT="$(git rev-parse "$OLDEST_HASH^" 2>/dev/null)"
  if [ -z "$OLDEST_PARENT" ]; then
    # oldest commit has no parent (root commit) — diff against the empty tree
    OLDEST_PARENT="$(git hash-object -t tree /dev/null)"
  fi

  echo "### DIFFSTAT_SUMMARY (net change across the whole period: $OLDEST_PARENT..$NEWEST_HASH)"
  git diff --shortstat "$OLDEST_PARENT" "$NEWEST_HASH" 2>/dev/null
  echo

  echo "### FILES_CHANGED (status, insertions, deletions, path)"
  git diff --numstat "$OLDEST_PARENT" "$NEWEST_HASH" 2>/dev/null | while IFS=$'\t' read -r add del path; do
    printf '%s\t%s\t%s\n' "$add" "$del" "$path"
  done
  echo

  echo "### TOP_CHANGED_FILES (by total line churn, top 15)"
  git diff --numstat "$OLDEST_PARENT" "$NEWEST_HASH" 2>/dev/null | awk '{
    a=$1; d=$2; $1=""; $2=""; sub(/^  /,"");
    if (a ~ /^[0-9]+$/ && d ~ /^[0-9]+$/) total=a+d; else total=0;
    print total"\t"$0
  }' | sort -rn | head -15
  echo

  echo "### DIFF_RANGE_FOR_MANUAL_INSPECTION"
  echo "Use: git show <hash>        (single commit)"
  echo "Use: git diff $OLDEST_PARENT $NEWEST_HASH -- <path>   (net change to one file across the period)"
  echo "Use: git log --since=\"$START\" --until=\"$END 23:59:59\" -p -- <path>   (full history of one file in range)"
else
  echo "### FILES_CHANGED"
  echo "(none — no commits in range)"
fi
