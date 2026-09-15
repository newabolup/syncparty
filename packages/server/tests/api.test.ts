import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('HTTP API Endpoints', () => {
  const app = createApp();

  it('GET /api/health returns 200 OK and health statistics', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.uptimeSeconds).toBe('number');
    expect(typeof res.body.activeRooms).toBe('number');
  });

  it('POST /api/rooms rejects invalid room input', async () => {
    const res = await request(app).post('/api/rooms').send({
      name: '', // Invalid empty name
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });

  it('POST /api/rooms creates a room successfully', async () => {
    const res = await request(app).post('/api/rooms').send({
      name: 'Friday Watch',
      hostUsername: 'Abol',
      isHostOnlyControls: true,
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.slug).toBeDefined();
    expect(res.body.hostToken).toBeDefined();
    expect(res.body.room.name).toBe('Friday Watch');
    expect(res.body.room.hasPassword).toBe(false);
  });

  it('GET /api/rooms/:slug returns room metadata', async () => {
    const createRes = await request(app).post('/api/rooms').send({
      name: 'Sci-Fi Night',
      hostUsername: 'Abol',
    });
    const slug = createRes.body.slug;

    const res = await request(app).get(`/api/rooms/${slug}`);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Sci-Fi Night');
    expect(res.body.hasPassword).toBe(false);
  });

  it('GET /api/rooms/:slug returns 404 for nonexistent room', async () => {
    const res = await request(app).get('/api/rooms/nonexistent-room-slug-1234');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Room not found');
  });
});
