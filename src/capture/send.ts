// Sends the roll to the server and asks for the case to be developed.
import { File } from "expo-file-system";
import { createRoom, getRoomPhotos, requestGeneration, uploadRoomPhoto, type GenerationJob } from "@/lib/escapd-api";
import { newId } from "@/lib/uuid";
import { currentTicket, setTicketRoom, type Plate } from "./roll";

/**
 * Uploads every plate the server doesn't have yet, in roll order, then
 * requests generation. Safe to call again after any failure: the ticket keeps
 * the same draft room and idempotency key until the plates change.
 */
export async function developPlates(
  plates: readonly Plate[],
  onProgress: (sent: number, total: number) => void,
): Promise<{ roomId: string; job: GenerationJob }> {
  const ticket = currentTicket();
  let roomId = ticket.roomId;
  if (!roomId) {
    roomId = (await createRoom()).id;
    setTicketRoom(roomId);
  }
  const onServer = new Set((await getRoomPhotos(roomId)).map((photo) => photo.position));
  let sent = plates.filter((_, position) => onServer.has(position)).length;
  onProgress(sent, plates.length);
  for (const [position, plate] of plates.entries()) {
    if (onServer.has(position)) continue;
    const body = await new File(plate.uri).arrayBuffer();
    await uploadRoomPhoto({ roomId, position, body, contentType: "image/jpeg", width: plate.width, height: plate.height });
    onProgress(++sent, plates.length);
  }
  return { roomId, job: await requestGeneration(roomId, ticket.key) };
}

/** Develops an already-sent room again after a transient failure. */
export async function redevelop(roomId: string) {
  return requestGeneration(roomId, newId());
}
