# Order Processing Workflow Engine

A highly scalable, real-time event-driven architecture for processing multi-step order workflows. Built with FastAPI, React, Apache Kafka, and Celery.

## Architecture Overview

The entire backbone of this system is built on **Event-Driven Architecture (EDA)** using **Apache Kafka** to communicate asynchronously between the API, the background workers, and the frontend.

### Event-Driven Workflow
1. **The Event Bus (Kafka)**: A central Kafka topic (`order-events`) routes all state changes. Instead of services calling each other synchronously, they broadcast events to this topic whenever an action occurs.
2. **The API (FastAPI) as the Producer**: User actions in the UI (e.g., placing an order, retrying payments, failing manually) cause FastAPI to immediately update the database and publish an event to Kafka. FastAPI responds instantly to the client with a `202 Accepted` response.
3. **The Orchestrator (Kafka Consumer Thread)**: A dedicated Kafka Consumer thread runs in the background of the FastAPI application. It listens to the `order-events` topic and routes events to their appropriate background handlers (e.g., triggering a Celery task for payment processing or 5-minute delayed delivery).
4. **Background Workers (Celery)**: Celery workers perform the heavy lifting, such as database updates, simulated payment/shipping gateways, and backoff retries. Upon completion, the worker publishes a new event back to Kafka.
5. **Real-Time UI (WebSocket Bridge)**: The Kafka Consumer thread bridges all consumed Kafka events to an internal asyncio queue. A WebSocket broadcasting loop pushes these payloads directly to the React frontend. This results in a fully dynamic, reactive UI requiring no manual polling or page refreshes.

## Database Schema / Design

The database uses a relational SQL structure (configured via SQLAlchemy ORM).

### 1. `orders` Table
Tracks the current state of an order through a strict state machine.
- `id` (String, UUID) - Primary Key
- `item_name` (String)
- `price` (Float)
- `status` (String) - State Machine: `PENDING` -> `PAID` -> `SHIPPED` -> `DELIVERED` (or `FAILED` / `CANCELLED`)
- `tracking_number` (String) - Populated upon shipping
- `created_at` (Timestamp)
- `updated_at` (Timestamp)

### 2. `order_events` Table
Acts as an immutable audit timeline for an order, recording every state transition.
- `id` (Integer) - Primary Key
- `order_id` (String) - Foreign Key mapping
- `event_type` (String) - E.g., `order.created`, `payment.retry`, `order.delivered`
- `from_status` (String)
- `to_status` (String)
- `detail` (Text) - Human-readable context
- `created_at` (Timestamp)

### 3. `retry_logs` Table
Tracks retry attempts and backoff metrics for Celery tasks.
- `id` (Integer) - Primary Key
- `order_id` (String)
- `task_name` (String)
- `attempt` (Integer)
- `max_retries` (Integer)
- `error_message` (Text)
- `status` (String) - `RETRYING`, `SUCCEEDED`, or `EXHAUSTED`

### 4. `idempotent_keys` Table
Ensures exactly-once processing semantics for Celery tasks.
- `key` (String) - Primary Key
- `created_at` (Timestamp)

## Setup Instructions

### Prerequisites
- Docker and Docker Compose
- Node.js (v16+)
- Python (3.9+)

### 1. Start Infrastructure Services
Use Docker Compose to spin up the required backing services (Kafka, Zookeeper, Redis, and the Database).
```bash
docker-compose up -d
```

### 2. Start the Backend API (FastAPI)
Create a Python virtual environment, install dependencies, and start the Uvicorn server.
```bash
python -m venv .venv
source .venv/bin/activate  # Or `.venv\Scripts\activate` on Windows
pip install -r requirements.txt

# Start the FastAPI server on port 8000
uvicorn app.main:app --reload --reload-dir app --port 8000
```

### 3. Start the Background Workers (Celery)
In a separate terminal (with the virtual environment activated), start the Celery worker pool to process background tasks.
```bash
# On Windows, use --pool=solo. On Unix, omit it or use prefork.
celery -A app.core.celery_app worker --loglevel=info --pool=solo
```

### 4. Start the Frontend (React)
Open a third terminal, navigate to the `frontend` directory, install NPM dependencies, and start the development server.
```bash
cd frontend
npm install
npm start
```
The React application will be available at `http://localhost:3000`.

## Assumptions Made During Implementation

1. **Idempotency Strategy**: It is assumed that multiple Celery workers could attempt to process the same task simultaneously (e.g., due to duplicate Kafka events or Celery visibility timeouts). An `idempotent_keys` table is used inside a database transaction to guarantee exactly-once processing.
2. **WebSocket Scalability**: The current WebSocket manager is implemented as an in-memory singleton inside the FastAPI application, bridging Kafka events to connected clients. It is assumed this will scale horizontally by allowing multiple FastAPI instances to run behind a load balancer, as each instance will consume from Kafka and notify its respective WebSocket clients.
3. **Delivery Countdown**: It is assumed that "Delivery" takes a static simulated amount of time (5 minutes) after an order reaches the `SHIPPED` state. This is executed by scheduling a Celery task with a `countdown=300`.
4. **Failure State Finality**: Once manual payment retries are exhausted and an order reaches the `FAILED` state, it is assumed this is a terminal state. No automated recovery is attempted past this point.
5. **Security / Authentication**: It is assumed this engine operates inside a trusted VPC for administrative purposes. Authentication, Authorization, and Rate Limiting middlewares were omitted to focus purely on the architectural orchestration workflow.
