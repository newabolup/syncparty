import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RoomManager } from '../src/services/room-manager.js';

describe('RoomManager Authoritative Playback Engine', () => {
  let roomManager: RoomManager;

  beforeEach(() => {
    roomManager = new RoomManager();
  });

  it('initializes room with paused state at position 0', async () => {
    // Mock prisma
    const fakeRoom = await roomManager.createRoom({
      name: 'Movie Night',
      hostUsername: 'Alice',
      isHostOnlyControls: true,
      videoUrl: 'https://example.com/test.mp4',
    });

    const room = await roomManager.getOrCreateRoom(fakeRoom.slug);
    expect(room).not.toBeNull();
    expect(room?.playbackState.isPlaying).toBe(false);
    expect(room?.playbackState.position).toBe(0);
    expect(room?.playbackState.sequenceNumber).toBe(1);
    expect(room?.playbackState.url).toBe('https://example.com/test.mp4');
    expect(room?.playbackState.provider).toBe('direct');
  });

  it('updates state to playing when host issues play action', async () => {
    const created = await roomManager.createRoom({
      name: 'Movie Night',
      hostUsername: 'Alice',
      isHostOnlyControls: true,
      videoUrl: 'https://example.com/test.mp4',
    });

    const room = (await roomManager.getOrCreateRoom(created.slug))!;
    const { member } = await roomManager.joinParticipant(room, 'sock-alice', 'Alice', created.hostToken);

    expect(member.role).toBe('host');

    const result = await roomManager.handlePlaybackAction(room, 'sock-alice', {
      action: 'play',
      position: 10.5,
    });

    expect(result.error).toBeUndefined();
    expect(result.state.isPlaying).toBe(true);
    expect(result.state.position).toBe(10.5);
    expect(result.state.sequenceNumber).toBe(2);
    expect(result.state.updatedBy).toBe('sock-alice');
  });

  it('prevents non-host from controlling playback when isHostOnlyControls is true', async () => {
    const created = await roomManager.createRoom({
      name: 'Host Only Room',
      hostUsername: 'Alice',
      isHostOnlyControls: true,
      videoUrl: 'https://example.com/test.mp4',
    });

    const room = (await roomManager.getOrCreateRoom(created.slug))!;
    await roomManager.joinParticipant(room, 'sock-alice', 'Alice', created.hostToken);
    const guestJoin = await roomManager.joinParticipant(room, 'sock-bob', 'Bob');

    expect(guestJoin.member.role).toBe('participant');

    // Bob tries to pause
    const result = await roomManager.handlePlaybackAction(room, 'sock-bob', {
      action: 'pause',
      position: 15.0,
    });

    expect(result.error).toBe('Only the host can control playback in this room');
  });

  it('allows non-host to control playback when isHostOnlyControls is false', async () => {
    const created = await roomManager.createRoom({
      name: 'Free Control Room',
      hostUsername: 'Alice',
      isHostOnlyControls: false,
      videoUrl: 'https://example.com/test.mp4',
    });

    const room = (await roomManager.getOrCreateRoom(created.slug))!;
    await roomManager.joinParticipant(room, 'sock-alice', 'Alice', created.hostToken);
    await roomManager.joinParticipant(room, 'sock-bob', 'Bob');

    const result = await roomManager.handlePlaybackAction(room, 'sock-bob', {
      action: 'seek',
      position: 45.0,
    });

    expect(result.error).toBeUndefined();
    expect(result.state.position).toBe(45.0);
    expect(result.state.updatedByName).toBe('Bob');
  });

  it('reassigns host when current host leaves', async () => {
    const created = await roomManager.createRoom({
      name: 'Succession Test',
      hostUsername: 'Alice',
    });

    const room = (await roomManager.getOrCreateRoom(created.slug))!;
    await roomManager.joinParticipant(room, 'sock-alice', 'Alice', created.hostToken);
    await roomManager.joinParticipant(room, 'sock-bob', 'Bob');
    await roomManager.joinParticipant(room, 'sock-charlie', 'Charlie');

    const { removedMember, newHost } = roomManager.removeParticipant(room, 'sock-alice');

    expect(removedMember?.username).toBe('Alice');
    expect(newHost?.username).toBe('Bob');
    expect(newHost?.role).toBe('host');

    // Bob should now be able to control playback
    const result = await roomManager.handlePlaybackAction(room, 'sock-bob', {
      action: 'play',
      position: 0,
    });
    expect(result.error).toBeUndefined();
    expect(result.state.isPlaying).toBe(true);
  });
});
