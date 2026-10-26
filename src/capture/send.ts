// Sends the photos to the server and asks for the case to be built.
import { File } from "expo-file-system";
import { createRoom, getRoomPhotos, requestGeneration, uploadRoomPhoto, type GenerationJob } from "@/lib/escapd-api";
import { newId } from "@/lib/uuid";
import { currentTicket, getRollGenre, setTicketRoom, type Slot } from "./roll";

/**
 * Uploads every filled slot the server doesn't have yet, in slot order, each
 * with position = its slot (room_photos allows positions 0-11 with gaps and
 * orders by position; request_room_generation only counts them), then
 * requests generation. The server's flagged positions are therefore slots.
 * The room is created in the roll's mode (getRollGenre); generation then
 * uses the room's, so a retry or a resume can never change it.
 * Safe to call again after any failure: the ticket keeps the same draft room
 * and idempotency key until a slot changes.
 */
export async function developPlates(
  slots: readonly Slot[],
  onProgress: (sent: number, total: number) => void,
): Promise<{ roomId: string; job: GenerationJob }> {
  const ticket = currentTicket();
  let roomId = ticket.roomId;
  if (!roomId) {
    roomId = (await createRoom(undefined, getRollGenre() ?? undefined)).id;
    setTicketRoom(roomId);
  }
  const filled = slots.flatMap((plate, position) => (plate ? [{ plate, position }] : []));
  const onServer = new Set((await getRoomPhotos(roomId)).map((photo) => photo.position));
  let sent = filled.filter(({ position }) => onServer.has(position)).length;
  onProgress(sent, filled.length);
  for (const { plate, position } of filled) {
    if (onServer.has(position)) continue;
    const body = await new File(plate.uri).arrayBuffer();
    await uploadRoomPhoto({ roomId, position, body, contentType: "image/jpeg", width: plate.width, height: plate.height });
    onProgress(++sent, filled.length);
  }
  return { roomId, job: await requestGeneration(roomId, ticket.key) };
}

/** Builds an already-sent room again after a transient failure. */
export async function redevelop(roomId: string) {
  return requestGeneration(roomId, newId());
}
