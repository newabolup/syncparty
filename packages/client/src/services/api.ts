import { CreateRoomInput, RoomMetadata } from '@syncparty/shared';

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export interface CreateRoomResponse {
  success: boolean;
  room: RoomMetadata;
  slug: string;
  hostToken: string;
}

export interface RoomInfoResponse {
  id: string;
  slug: string;
  name: string;
  hasPassword: boolean;
  isHostOnlyControls: boolean;
  createdAt: number;
  memberCount: number;
  currentVideoUrl: string;
  currentVideoProvider: string;
}

export async function createRoom(data: CreateRoomInput): Promise<CreateRoomResponse> {
  const res = await fetch(`${API_BASE}/api/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to create room');
  }

  return res.json();
}

export async function getRoomInfo(idOrSlug: string): Promise<RoomInfoResponse> {
  const res = await fetch(`${API_BASE}/api/rooms/${encodeURIComponent(idOrSlug)}`);

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Room not found');
  }

  return res.json();
}

export async function verifyRoomPassword(
  idOrSlug: string,
  password: string
): Promise<{ valid: boolean; error?: string }> {
  const res = await fetch(`${API_BASE}/api/rooms/${encodeURIComponent(idOrSlug)}/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    return { valid: false, error: errorData.error || 'Incorrect password' };
  }

  return res.json();
}

export async function checkServerHealth(): Promise<{ status: string; uptimeSeconds: number }> {
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) throw new Error('Server unhealthy');
  return res.json();
}

