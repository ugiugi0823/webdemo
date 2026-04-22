#!/bin/bash
set -e

DEST=/tmp/LLM42

# /tmp 날아갔으면 다시 클론
if [ ! -d "$DEST/.git" ]; then
  git clone https://github.com/42maru-ai/LLM42.git $DEST
  git -C $DEST config user.email "acerghjk@gmail.com"
  git -C $DEST config user.name "ugiugi0823"
fi

# 최신 상태로 동기화
git -C $DEST pull origin master

# 파일 복사
rm -rf $DEST/DEMO
mkdir -p $DEST/DEMO
cp -r /data/rex/workspace/dev/webdemo/dev $DEST/DEMO/dev
cp /data/rex/workspace/dev/webdemo/README.md $DEST/DEMO/
cp /data/rex/workspace/dev/webdemo/사용법.md $DEST/DEMO/
cp -r /data/rex/workspace/dev/webdemo/screenshots $DEST/DEMO/screenshots

# 커밋 & 푸시
git -C $DEST add DEMO/
git -C $DEST commit -m "chore: update web demo $(date '+%Y-%m-%d %H:%M')"
git -C $DEST push origin master

echo "✅ 배포 완료"