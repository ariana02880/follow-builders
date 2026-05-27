#!/bin/bash
# Stop hook: appends a timestamped entry to session_log.md in memory
# Runs automatically when Claude stops in this project

cat > /dev/null  # discard stdin (Stop hook pipes session JSON here)

MEMORY_DIR="/Users/arianali/.claude/projects/-Users-arianali-Desktop-0work-follow-builders/memory"
PROJECT_DIR="/Users/arianali/Desktop/0work/follow-builders"
DATE=$(date +%Y-%m-%d)
TIME=$(date +%H:%M)

COMMITS=$(cd "$PROJECT_DIR" && git log --since="24 hours ago" --oneline 2>/dev/null | head -10)
GIT_STATUS=$(cd "$PROJECT_DIR" && git status --short 2>/dev/null)

printf '\n---\n## Session ended: %s %s\n\n### Git activity (last 24h):\n%s\n\n### Pending changes:\n%s\n' \
  "$DATE" "$TIME" \
  "${COMMITS:-(no commits)}" \
  "${GIT_STATUS:-(clean)}" \
  >> "$MEMORY_DIR/session_log.md" 2>/dev/null

echo '{"systemMessage": "Session log saved to memory."}'
