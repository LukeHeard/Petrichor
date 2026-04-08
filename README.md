# Petrichor
The minimalist's library

Grounded in the tactile joy of cataloging, elevated by graph-based data. This app aims to be an easy to use, yet powerful tool for tracking your books and reading habits.

Understand the complex simplicity of books with Petrichor.


### Execution

The application is containerized and managed via Docker.

```bash
docker compose up --build
```

To run on custom ports:

```bash
FRONTEND_PORT=4000 BACKEND_PORT=9000 docker compose up --build
```

The interface starts at `http://localhost:3000` (or your custom `FRONTEND_PORT`) and communicates with the API at `http://localhost:8000` (or `BACKEND_PORT`).
