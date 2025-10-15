# Scalable Real-Time Microservices Platform

A lightweight yet robust microservices architecture featuring real-time notifications and high-throughput background processing, powered by **Express.js**, **Redis**, **MongoDB**, **Socket.io**, **Docker**, and **Nginx**.

---

## 🚀 Features

- **Queue Processing**: Redis + BullMQ, 100+ tasks/sec throughput.
- **Real-Time Notifications**: Socket.io + Redis Pub/Sub, supports 500+ concurrent users.
- **RESTful APIs**: User and task management built on Express.js.
- **Load Balancing**: Nginx acts as API gateway and WebSocket proxy.
- **Containerized Deployment**: Easy multi-service orchestration with Docker Compose.

---

## 📦 Tech Stack

- **Express.js** — REST API services
- **BullMQ**/Redis — Task queues
- **MongoDB** — Data persistence
- **Socket.io** — WebSocket/real-time
- **Nginx** — API Gateway & LB
- **Docker Compose** — Dev & scale

---

## 🏗️ Architecture Diagram

```
                                  +-------------------+
                                  |      Client       |
                                  +---------+---------+
                                            |
                        +-------------------v-------------------+
                        |           Nginx (Gateway)            |
                        +----------+-------------+-------------+
                                   |             |
                    +--------------v---+     +---v--------------+
                    |   API Service    |     |  Notification    |
                    |   (Express.js)   |     |  Service         |
                    +--------+-+-------+     |  (Socket.io)     |
                             | |             +--------+---------+
                   +----------v |                      |
                   |            |                      |
           +-------v----+   +---v-----+        +-------v-------+
           |  MongoDB   |   |  Redis  |        | Redis Pub/Sub |
           +------------+   +---------+        +---------------+
                   |                |
           +-------v-----+    +-----v---------+
           |   Worker    |    |  Socket.io    |
           |   Service   |    |  Connections  |
           +-------------+    +---------------+

```

- **Nginx** routes all requests and balances load to API and Notification services.
- **API Service** handles tasks and user APIs, queues background jobs (Redis).
- **Worker Service** picks tasks from Redis and processes them asynchronously.
- **Notification Service** delivers real-time updates to clients using Socket.io and listens to Redis Pub/Sub channels.

---

## 🛠️ Installation

```


# Clone the repo

git clone <your-repo-url>
cd Scalable-Real-Time-Microservices-Platform

# Copy environment variables

cp .env.example .env

# Start all services

docker-compose up --build

# See running containers

docker-compose ps

```

---

## 🌐 API Endpoints

| Method | Endpoint                      | Description                |
|--------|-------------------------------|----------------------------|
| GET    | `/health`                     | API health check           |
| POST   | `/api/tasks`                  | Create background task     |
| GET    | `/api/tasks/:id`              | Get task status            |
| GET    | `/api/tasks`                  | List tasks                 |
| POST   | `/api/users`                  | Create user                |
| GET    | `/api/users/:id`              | Get user details           |
| GET    | `/api/users`                  | List users                 |

---

## 💻 Testing

- Run API tests with the included tester in `/tests/api-tester.js`:
```

cd tests
npm install
node api-tester.js

```
- Use Postman/curl/WebSocket clients for manual testing and real-time validation.

---

## 🌐 WebSocket Usage

- Connect to `ws://localhost:4000`
- Emit `"identify"` to join your notification room.
- Listen for `"notification"`, `"task:completed"`, etc.

---