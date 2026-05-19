# GoodBuy

**GoodBuy** is a full-stack collaborative grocery management platform that helps households shop smarter.  
It enables shared shopping lists, real-time collaboration, grocery price comparison across Israeli supermarket chains, and AI-powered product recommendations.

The system combines **mobile applications, backend APIs, real-time synchronization, and automated price data ingestion** to help users manage household grocery shopping efficiently.

Built with **Node.js, Express, MongoDB, React Native, and Expo**.

---

# Features

### Shared Shopping Lists
Create and manage shopping lists collaboratively in real time using **Socket.IO**, with live editing indicators showing which users are currently modifying a list.

### Price Comparison
Compare grocery prices across **15+ Israeli supermarket chains** (Shufersal, Mega, Tiv Taam, Yochananof, and others).  
Supports both single-store shopping and **multi-store price optimization** based on price and product availability.

### Smart Recommendations
Hybrid recommendation engine combining:

- recency-frequency scoring
- product co-occurrence analysis
- collaborative filtering (Jaccard similarity)
- day-of-week habit detection
- LLM-powered suggestions via the **Gemini API**

### Nearest Store Search
Locate nearby supermarkets using geospatial distance calculations based on the **Haversine formula**.

### Automated Price Data Pipeline
A multi-stage pipeline that:

- scrapes retailer pricing data
- decompresses price files
- parses XML datasets
- indexes prices for fast comparison

### Purchase History
Track past purchases and use them to power recommendations and price insights.

### Cloud-Based Image Storage
Product images are stored and synchronized using **Cloudflare R2**.

---

# Architecture

The system follows a full-stack architecture composed of three main layers: a mobile client, a backend API, and a data ingestion pipeline.

### Mobile Layer
**React Native (Expo)** mobile application that allows users to manage shared shopping lists, view price comparisons, and receive recommendations.

### Backend API
**Node.js / Express** REST API responsible for:

- user authentication and authorization
- shopping list management
- recommendation generation
- product and price queries
- real-time collaboration via Socket.IO

Data is stored in **MongoDB** using **Mongoose** models.

### Data Ingestion Pipeline
Automated pipeline that collects and processes supermarket pricing datasets, **run by a separate worker process** (`backend/src/jobs/worker.js`) so that heavy scraping work (Puppeteer, FTP, XML parsing) is isolated from the user-facing API.

Main stages:

1. Scraping retailer data sources
2. Decompressing pricing files
3. Parsing XML price datasets
4. Normalizing product data
5. Indexing prices in MongoDB for fast queries

The worker is triggered either by:

- a **daily cron** at 05:30 Asia/Jerusalem (`node-cron`), or
- a **manual enqueue** from the API — `POST /api/system/price-refresh` writes a `requestedAt` timestamp to MongoDB; the worker polls for it.

Both paths share a single-flight guard so overlapping runs cannot stack.

### Running locally

```bash
npm run dev           # api + worker + mobile (concurrently)
npm run dev:backend   # api only
npm run dev:worker    # worker only
npm run dev:mobile    # expo
```

### Running with Docker

For a fully containerised local stack (API + worker + MongoDB), use `docker-compose`:

```bash
cp backend/src/.env.example backend/src/.env  # then fill in JWT_SECRET etc.
docker compose up --build
```

The two backend images are built from a single multi-stage `Dockerfile` with separate targets:

```bash
docker build --target api    -t goodbuy-api    .
docker build --target worker -t goodbuy-worker .
```

The **API** image is a slim Node container with no Chromium. The **worker** image adds system Chromium (for Puppeteer) and Hebrew/CJK fonts (for scraping retailer pages). Both run as a non-root user.

### Real-Time Collaboration
Shared shopping lists are synchronized across devices using **Socket.IO**, enabling multiple users to edit lists simultaneously.
