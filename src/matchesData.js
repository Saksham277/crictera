import { supabase } from './supabaseClient';

// ============================================================
// MATCHES — Supabase-backed replacement for the old localStorage matches
// object. The full match payload (teams, innings, balls, result, etc.)
// lives in the `data` JSONB column; owner_id/viewer_code/editor_code/
// visibility/status are promoted to real columns (see supabase_schema.sql)
// so they're indexed and usable directly in queries/RLS without unpacking
// JSON every time.
// ============================================================

const genCode = (len = 6) =>
  Math.random().toString(36).substring(2, 2 + len).toUpperCase();

/** Converts a DB row into the flat "match" shape the rest of the app expects. */
function rowToMatch(row) {
  return {
    ...row.data,
    id: row.id,
    ownerId: row.owner_id,
    viewerCode: row.viewer_code,
    editorCode: row.editor_code,
    visibility: row.visibility,
    status: row.status,
    title: row.title,
    seriesId: row.series_id,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

/** Converts an in-app match object into a DB row for insert/update. */
function matchToRow(match, ownerId) {
  // Keep the promoted columns in sync with whatever's inside `data` so
  // queries/RLS/joins always see accurate values, while still storing the
  // full object in `data` for the app to consume as-is.
  const { id, ownerId: _o, viewerCode, editorCode, visibility, status, title, seriesId, createdAt, updatedAt, ...rest } = match;
  return {
    id, // client-generated, same scheme used for every other entity in the app
    owner_id: ownerId,
    viewer_code: viewerCode || genCode(),
    editor_code: editorCode || genCode(),
    visibility: visibility || 'private',
    status: status || 'live',
    title: title || '',
    series_id: seriesId || null,
    data: { ...rest, title, status, viewerCode, editorCode, visibility },
  };
}

/** Fetches every match owned by this user. Used on login / app load. */
export async function fetchMyMatches(ownerId) {
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data.map(rowToMatch);
}

/** Creates a new match row (using the match's own client-generated id), returns it in app-shape. */
export async function createMatch(match, ownerId) {
  const row = matchToRow(match, ownerId);
  const { data, error } = await supabase
    .from('matches')
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return rowToMatch(data);
}

/**
 * Updates an existing match. Pass the full updated match object — this is
 * called after every single ball is scored (per the "write immediately"
 * choice), so it intentionally does a full-row update of `data` rather
 * than a partial JSONB patch, keeping the write path simple and the data
 * always internally consistent.
 */
export async function updateMatch(matchId, match) {
  const { id, ownerId, viewerCode, editorCode, visibility, status, title, seriesId, createdAt, updatedAt, ...rest } = match;
  const { data, error } = await supabase
    .from('matches')
    .update({
      title: title || '',
      status: status || 'live',
      visibility: visibility || 'private',
      series_id: seriesId || null,
      data: { ...rest, title, status, viewerCode, editorCode, visibility },
    })
    .eq('id', matchId)
    .select()
    .single();
  if (error) throw error;
  return rowToMatch(data);
}

export async function deleteMatch(matchId) {
  const { error } = await supabase.from('matches').delete().eq('id', matchId);
  if (error) throw error;
}

/** Looks up a match by its viewer OR editor code — used by "Join a Match". */
export async function fetchMatchByCode(code) {
  const normalized = code.trim().toUpperCase();
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .or(`viewer_code.eq.${normalized},editor_code.eq.${normalized}`)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const isEditor = data.editor_code === normalized;
  return { match: rowToMatch(data), isEditor };
}

export async function fetchMatchById(matchId) {
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .eq('id', matchId)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToMatch(data) : null;
}

/** All matches visible to the public feed / browse page. */
export async function fetchPublicMatches() {
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .eq('visibility', 'public')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return data.map(rowToMatch);
}

// ============================================================
// REALTIME — live score updates push to anyone subscribed to a match,
// without polling. Subscribe when a match page mounts, unsubscribe on
// unmount (the returned function does this).
// ============================================================

/**
 * Subscribes to changes on a single match row. `onChange` is called with
 * the updated match (app-shape) whenever any field changes — including
 * scores from the editor's device arriving on a viewer's screen instantly.
 */
export function subscribeToMatch(matchId, onChange) {
  const channel = supabase
    .channel(`match:${matchId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` },
      (payload) => onChange(rowToMatch(payload.new))
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` },
      () => onChange(null) // signal the match was deleted
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}

/**
 * Subscribes to ALL changes (insert/update/delete) on matches owned by this
 * user — used at the app-root level so the home page / match list updates
 * live across devices without a manual refresh.
 */
export function subscribeToMyMatches(ownerId, { onInsert, onUpdate, onDelete }) {
  const channel = supabase
    .channel(`my-matches:${ownerId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'matches', filter: `owner_id=eq.${ownerId}` },
      (payload) => onInsert?.(rowToMatch(payload.new))
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'matches', filter: `owner_id=eq.${ownerId}` },
      (payload) => onUpdate?.(rowToMatch(payload.new))
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'matches', filter: `owner_id=eq.${ownerId}` },
      (payload) => onDelete?.(payload.old.id)
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}
