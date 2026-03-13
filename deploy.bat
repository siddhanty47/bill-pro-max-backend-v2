@echo off

echo =====================================
echo Starting deployment...
echo =====================================

echo Pulling latest code from GitHub...
git pull origin main

echo Navigating to docker folder...
cd docker

echo Rebuilding and starting containers...
docker compose -f docker-compose.prod.yml up -d --build

echo =====================================
echo Deployment completed successfully!
echo =====================================