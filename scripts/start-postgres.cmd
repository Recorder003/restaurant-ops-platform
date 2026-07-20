@echo off
docker start restaurant-orders-postgres
if errorlevel 1 (
  docker compose up --no-deps -d postgres
)

docker start restaurant-orders-redis
if errorlevel 1 (
  docker run -d --name restaurant-orders-redis -p 6379:6379 redis:7-alpine
)
