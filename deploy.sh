#!/bin/bash

echo "Pulling latest code..."

git pull origin main

echo "Rebuilding containers..."

docker compose build

echo "Restarting services..."

docker compose up -d

echo "Deployment completed!"