@echo off

echo =====================================
echo Starting deployment...
echo =====================================

REM Move to the directory where this script exists
cd /d "%~dp0"

echo Pulling latest code from GitHub...
git pull origin main

echo Navigating to docker folder...
cd docker

echo Rebuilding and starting containers...
docker compose -f docker-compose.prod.yml up -d --build

echo =====================================
echo Deployment completed successfully!
echo =====================================