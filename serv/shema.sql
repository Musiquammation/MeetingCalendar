-- Drop tables if they exist (in reverse order of dependencies)
DROP TABLE IF EXISTS appointments CASCADE;
DROP TABLE IF EXISTS client_requests CASCADE;
DROP TABLE IF EXISTS hoster_timeslots CASCADE;
DROP TABLE IF EXISTS hoster_clients CASCADE;
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS hosters CASCADE;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Hosters table
CREATE TABLE hosters (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Clients table
CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Hoster-Client relationships
CREATE TABLE hoster_clients (
    id SERIAL PRIMARY KEY,
    hoster_id INTEGER NOT NULL REFERENCES hosters(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    connection_id TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(hoster_id, client_id)
);

-- Hoster availability timeslots
CREATE TABLE hoster_timeslots (
    id SERIAL PRIMARY KEY,
    hoster_id INTEGER NOT NULL REFERENCES hosters(id) ON DELETE CASCADE,
    start_time TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    end_time TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    CHECK (end_time > start_time)
);

-- Client requests within hoster timeslots
CREATE TABLE client_requests (
    id SERIAL PRIMARY KEY,
    hoster_timeslot_id INTEGER NOT NULL REFERENCES hoster_timeslots(id) ON DELETE CASCADE,
    connection_id TEXT NOT NULL REFERENCES hoster_clients(connection_id) ON DELETE CASCADE,
    start_time TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    end_time TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    preference SMALLINT NOT NULL CHECK (preference BETWEEN 1 AND 5),
    validated_by_hoster BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    CHECK (end_time > start_time)
);

-- Confirmed appointments
CREATE TABLE appointments (
    id SERIAL PRIMARY KEY,
    hoster_id INTEGER NOT NULL REFERENCES hosters(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    hoster_timeslot_id INTEGER NOT NULL REFERENCES hoster_timeslots(id) ON DELETE CASCADE,
    start_time TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    end_time TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    done BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    CHECK (end_time > start_time)
);

-- Indexes for performance
CREATE INDEX idx_hoster_timeslots_hoster ON hoster_timeslots(hoster_id);
CREATE INDEX idx_hoster_timeslots_time ON hoster_timeslots(start_time, end_time);
CREATE INDEX idx_client_requests_timeslot ON client_requests(hoster_timeslot_id);
CREATE INDEX idx_client_requests_connection ON client_requests(connection_id);
CREATE INDEX idx_appointments_hoster ON appointments(hoster_id);
CREATE INDEX idx_appointments_client ON appointments(client_id);
CREATE INDEX idx_appointments_time ON appointments(start_time, end_time);
CREATE INDEX idx_hoster_clients_connection ON hoster_clients(connection_id);