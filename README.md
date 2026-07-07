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

### Execution

The application is containerized for easy setup. Simply run:

```bash
docker compose up --build
```

To run on custom ports:

```bash
FRONTEND_PORT={PORT} BACKEND_PORT={PORT} docker compose up -d --build
```

- **Frontend:** [http://localhost:3000](http://localhost:3000) (or your custom `FRONTEND_PORT`)
- **Backend API:** [http://localhost:8000](http://localhost:8000) (or `BACKEND_PORT`)

## Architecture

Petrichor uses a graph-based data model (following FRBR principles) to manage bibliographic records. By using **KùzuDB**, the application can efficiently traverse complex relationships between authors, works, and editions, powering the interactive "Galaxy" visualization.

- `frontend/`: React/Next.js application.
- `backend/`: FastAPI service with KùzuDB integration and Goodreads scraping logic.
- `backend/data/`: Persistent storage for the graph database.

## AI Use

This project is developed and maintained using a mix of solo and vibe coding (Claude). I have a life and limited time, womp womp.
Also, was originally developed for use as a personal project, so as such I didn't much care for the way it got done.

That being said, if AI use bothers you for solo, open source, and free applications, I sincerely apologize and you're welcome to go to the store and buy a pencil and paper to track your books.
