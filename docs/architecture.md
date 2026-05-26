# System Architecture

## 1. Architecture Goal

The goal of this architecture is to design a maintainable, secure, and realistic full-stack application.

The system should separate frontend responsibilities, backend responsibilities, database responsibilities, and deployment concerns.

## 2. High-Level Architecture

```txt
Customer / Staff / Admin
        |
        v
React Frontend
        |
        v
REST API Server
        |
        v
PostgreSQL Database