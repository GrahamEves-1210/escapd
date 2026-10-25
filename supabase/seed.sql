-- =============================================================================
-- Seed: the guided introductory (tutorial) escape room.
-- Runs on `supabase db reset` locally. For hosted projects, run once in the
-- SQL editor (it is idempotent). Tutorial photos are app-bundled assets
-- referenced by asset_key (or upload them to the system-assets bucket).
-- =============================================================================
do $$
declare
  v_room_id    constant uuid := '00000000-0000-4000-8000-000000000001';
  v_version_id constant uuid := '00000000-0000-4000-8000-000000000002';
  v_public jsonb := $json$
  {
    "schema_version": 1,
    "title": "The Study",
    "intro": "The door clicked shut behind you. Search the study, piece together the clues, and find a way out.",
    "photos": [
      { "asset_key": "tutorial/study_1.jpg" },
      { "asset_key": "tutorial/study_2.jpg" },
      { "asset_key": "tutorial/study_3.jpg" }
    ],
    "items": [
      { "id": "brass_key",        "name": "Brass key",        "description": "Small and a little tarnished." },
      { "id": "torn_note_left",   "name": "Torn note (left)", "description": "It reads: 04..." },
      { "id": "torn_note_right",  "name": "Torn note (right)","description": "It reads: ...27" },
      { "id": "full_note",        "name": "Taped note",       "description": "The two halves read 0427." }
    ],
    "hotspots": [
      { "id": "desk_drawer", "photo_index": 0, "object_label": "drawer",    "name": "Desk drawer",
        "description": "A shallow drawer.", "shape": { "type": "rect", "x": 0.10, "y": 0.55, "w": 0.25, "h": 0.12 } },
      { "id": "bookshelf",   "photo_index": 0, "object_label": "bookshelf", "name": "Bookshelf",
        "description": "Rows of dusty books.", "shape": { "type": "rect", "x": 0.55, "y": 0.10, "w": 0.35, "h": 0.60 } },
      { "id": "rug",         "photo_index": 1, "object_label": "rug",       "name": "Rug",
        "description": "One corner is curled up.", "shape": { "type": "rect", "x": 0.20, "y": 0.70, "w": 0.60, "h": 0.25 } },
      { "id": "cabinet",     "photo_index": 1, "object_label": "cabinet",   "name": "Locked cabinet",
        "description": "It has a small keyhole.", "shape": { "type": "rect", "x": 0.05, "y": 0.20, "w": 0.30, "h": 0.45 } },
      { "id": "safe",        "photo_index": 1, "object_label": "safe",      "name": "Wall safe", "hidden": true,
        "description": "A four-digit keypad.", "shape": { "type": "rect", "x": 0.10, "y": 0.30, "w": 0.15, "h": 0.15 } },
      { "id": "door",        "photo_index": 2, "object_label": "door",      "name": "Door",
        "description": "Locked tight.", "shape": { "type": "rect", "x": 0.35, "y": 0.05, "w": 0.30, "h": 0.90 } }
    ],
    "puzzles": [
      { "id": "find_key",        "kind": "inspect",  "hotspot_id": "desk_drawer", "title": "Search the drawer" },
      { "id": "find_note_left",  "kind": "inspect",  "hotspot_id": "bookshelf",   "title": "Search the shelf" },
      { "id": "find_note_right", "kind": "inspect",  "hotspot_id": "rug",         "title": "Look under the rug" },
      { "id": "open_cabinet",    "kind": "use_item", "hotspot_id": "cabinet",     "title": "Unlock the cabinet", "requires": ["find_key"] },
      { "id": "join_notes",      "kind": "combine",  "title": "Piece the note together" },
      { "id": "open_safe",       "kind": "code",     "hotspot_id": "safe",        "title": "Open the safe",
        "requires": ["open_cabinet"], "prompt": "Enter the 4-digit code.",
        "answer_format": { "kind": "digits", "length": 4 } },
      { "id": "escape",          "kind": "inspect",  "hotspot_id": "door",        "title": "Unlock the door", "requires": ["open_safe"] }
    ],
    "exit": { "requires": ["escape"], "message": "The door swings open. You escaped!" }
  }
  $json$;
  v_secret jsonb := $json$
  {
    "schema_version": 1,
    "puzzles": {
      "find_key":        { "rewards": { "items": ["brass_key"] },       "message": "Under some papers you find a brass key.",
                           "hints": [ "The first view has a desk. Desks keep small things close.",
                                      "A shallow drawer is just the place a key waits for someone careful.",
                                      "Search the desk drawer. The brass key is under the papers." ] },
      "find_note_left":  { "rewards": { "items": ["torn_note_left"] },  "message": "A torn note falls out of a book.",
                           "hints": [ "Not everything on a shelf is there to be read. The first view is worth another look.",
                                      "Paper tucked between books is easy to miss. The bookshelf is keeping a scrap.",
                                      "Search the bookshelf. Half of a torn note falls out of a book." ] },
      "find_note_right": { "rewards": { "items": ["torn_note_right"] }, "message": "Another torn note was hidden under the rug.",
                           "hints": [ "The floor in the second view deserves a second look.",
                                      "One corner of the rug is curled, as if something was slid beneath it.",
                                      "Look under the rug. The other half of the torn note is there." ] },
      "open_cabinet":    { "item_id": "brass_key",
                           "rewards": { "consume_items": ["brass_key"], "reveal_hotspots": ["safe"] },
                           "message": "The cabinet opens, revealing a wall safe.",
                           "hints": [ "A lock in the second view asks a simple question: what are you carrying?",
                                      "You noticed the keyhole. The brass key from the desk is small enough to fit it.",
                                      "Use the brass key on the locked cabinet. It opens onto a wall safe." ] },
      "join_notes":      { "inputs": ["torn_note_left", "torn_note_right"],
                           "rewards": { "items": ["full_note"], "consume_items": ["torn_note_left", "torn_note_right"] },
                           "message": "The halves fit together: 0427.",
                           "hints": [ "Two scraps of paper rarely say much on their own. Look at what you are holding.",
                                      "The torn notes were one page once. Their ragged edges should meet.",
                                      "Combine the left and right halves of the torn note to read the whole code." ] },
      "open_safe":       { "answer": "0427", "message": "The safe pops open. Inside is the door key.",
                           "hints": [ "A four-digit keypad wants four digits. Something you carry has some written down.",
                                      "The taped note is the combination. The two halves agree on one number.",
                                      "Enter 0427 on the wall safe." ] },
      "escape":          { "message": "You turn the key...",
                           "hints": [ "The way out has been in plain sight all along, in the third view.",
                                      "The safe gave you the door key. The door is the last lock in the room.",
                                      "Open the door to leave the study." ] }
    }
  }
  $json$;
  v_errors text[];
begin
  v_errors := private.validate_puzzle_definition(v_public, v_secret);
  if cardinality(v_errors) > 0 then
    raise exception 'tutorial definition invalid: %', array_to_string(v_errors, '; ');
  end if;

  insert into public.rooms (id, owner_id, kind, title, description, status)
  values (v_room_id, null, 'tutorial', 'The Study', 'Learn how to play.', 'draft')
  on conflict (id) do nothing;

  insert into public.puzzle_versions (id, room_id, owner_id, version, schema_version, status, public_definition, content_hash)
  values (v_version_id, v_room_id, null, 1, 1, 'published', v_public,
          encode(sha256(convert_to(v_public::text || v_secret::text, 'UTF8')), 'hex'))
  on conflict (id) do update
    set public_definition = excluded.public_definition, content_hash = excluded.content_hash;

  insert into private.puzzle_solutions (puzzle_version_id, schema_version, solution)
  values (v_version_id, 1, v_secret)
  on conflict (puzzle_version_id) do update set solution = excluded.solution;

  update public.rooms set status = 'ready', current_version_id = v_version_id where id = v_room_id;
end;
$$;
