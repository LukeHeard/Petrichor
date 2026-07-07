# Petrichor
The minimalist's library

Grounded in the tactile joy of cataloging, elevated by graph-based data. Petrichor is a modern, minimalist book tracking application that helps you understand your reading habits and the connections between your books.

Understand the complex simplicity of books with Petrichor.

(or don't understand anything and just track your books because, like me, you don't care all too much about 'the complex simplicity of books' and just want a cool place to track books and brag to people that it's self hosted so you can look down on them with contempt as they open goodreads)

![Petrichor Home](images/4_15_26_home.png)

## Features

- **Personal Catalog:** Manage your library with personal ratings and reviews using minimal list and grid designs for simple and aesthetically pleasing viewing. (the books. this is where the books go. obviously)
  
  <div style="display: flex; gap: 10px;">
    <img src="images/4_15_26_library_list.png" width="48%" alt="Reading Stats 1" />
    <img src="images/4_15_26_library_grid.png" width="48%" alt="Reading Stats 2" />
  </div>

- **Comprehensive Tracking:** Log reading sessions with page-level granularity. Track minutes read and visualize your progress over time with our calendar view. (although i stopped using this almost immediately, there will be some freaks who want this tedious ass feature)
  
  ![Reading Calendar](images/4_15_26_calendar.png)

- **Deep Insights:** Dynamic statistics and charts showing your reading frequency, genre distribution, and library composition. (so you can come to terms with how much sci-fi and smut you've read)
  
  <div style="display: flex; gap: 10px;">
    <img src="images/4_15_26_stats_1.png" width="48%" alt="Reading Stats 1" />
    <img src="images/4_15_26_stats_2.png" width="48%" alt="Reading Stats 2" />
  </div>

- **Petrichor Galaxy:** An interactive 3D force-directed graph visualization of your library, mapping the relationships between works, authors, and genres in a celestial interface. (i got hella bored one night i wont lie to you)
  
  ![Petrichor Galaxy](images/4_15_26_galaxy.png)



## Tech Stack

- **Frontend:** [Next.js](https://nextjs.org/) (TypeScript, Tailwind-ish CSS)
- **Backend:** [FastAPI](https://fastapi.tiangolo.com/) (Python)
- **Database:** [KùzuDB](https://kuzudb.com/) (Embedded Graph Database)
- **Visualization:** [Three.js](https://threejs.org/) & [React Force Graph](https://github.com/vasturiano/react-force-graph)
- **Deployment:** [Docker](https://www.docker.com/) & [Docker Compose](https://docs.docker.com/compose/)

## Getting Started

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)

Both images are production builds (Next.js standalone output, FastAPI/uvicorn without `--reload`) - no source checkout is required for the prebuilt-image paths below.

### Option 1: Docker Compose (GHCR images)

Grab just the compose file (no need to clone the repo):

```bash
curl -O https://raw.githubusercontent.com/LukeHeard/Petrichor/main/docker-compose.yml
docker compose pull
docker compose up -d
```

### Option 2: Docker Compose, build from source

```bash
git clone https://github.com/LukeHeard/Petrichor.git
cd Petrichor
docker compose up -d --build
```

Either way:

- **Frontend:** [http://localhost:3000](http://localhost:3000)
- **Backend API:** [http://localhost:8000](http://localhost:8000)

To use different host ports, just edit the `ports:` lines in `docker-compose.yml` (e.g. `"8080:3000"` for the frontend).

Your library data lives in the `kuzu_data` named Docker volume, independent of the containers - `docker compose down` and `up` again (with or without `--build`) never touches it. To actually wipe it: `docker compose down -v`.

### Option 3: Docker run

For anyone who'd rather wire the containers up by hand:

```bash
docker network create petrichor-net
docker volume create petrichor-data

docker run -d --name petrichor-backend \
  --network petrichor-net \
  -v petrichor-data:/app/data \
  -p 8000:8000 \
  --restart unless-stopped \
  ghcr.io/lukeheard/petrichor-backend:latest

docker run -d --name petrichor-frontend \
  --network petrichor-net \
  -e BACKEND_URL=http://petrichor-backend:8000 \
  -p 3000:3000 \
  --restart unless-stopped \
  ghcr.io/lukeheard/petrichor-frontend:latest
```

The frontend resolves the backend at *request time* (via `BACKEND_URL`, read live by `frontend/src/middleware.ts`), so it just needs to be able to reach whatever hostname you give it on the shared network - it doesn't have to be named `petrichor-backend`. Building your own images instead of using GHCR's works the same way: `docker build -t petrichor-backend ./backend` / `docker build -t petrichor-frontend ./frontend`, then `docker run` those tags.

### Published images

Every push to `main` publishes `:latest`, and tagged releases (`vX.Y.Z`) publish matching semver tags, via [`.github/workflows/docker-publish.yml`](.github/workflows/docker-publish.yml):

- `ghcr.io/lukeheard/petrichor-backend`
- `ghcr.io/lukeheard/petrichor-frontend`

## Architecture

Petrichor uses a graph-based data model (following FRBR principles) to manage bibliographic records. By using **KùzuDB**, the application can efficiently traverse complex relationships between authors, works, and editions, powering the interactive "Galaxy" visualization.

- `frontend/`: React/Next.js application.
- `backend/`: FastAPI service with KùzuDB integration and Goodreads scraping logic.
- `backend/data/`: Persistent storage for the graph database.

## AI Use

This project is developed and maintained using a mix of solo and vibe coding (Claude). I have a life and limited time, womp womp.
Also, was originally developed for use as a personal project, so as such I didn't much care for the way it got done.

That being said, if AI use bothers you for solo, open source, and free applications, I sincerely apologize and you're welcome to go to the store and buy a pencil and paper to track your books.
