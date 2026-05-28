@echo off
docker start restaurant-orders-postgres || docker compose up -d postgres
