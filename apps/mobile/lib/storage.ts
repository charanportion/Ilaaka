import { supabase } from '@/lib/supabase';

// Pick a photo path under <user_id>/draft/<localActivityId>/<position>.<ext>
// Returns the storage path string the recorder hands to submit-activity, which
// then moves it into <user_id>/<activity_id>/<position>.<ext> server-side.
export async function uploadActivityPhotoDraft(opts: {
  userId:           string;
  localActivityId:  string;
  position:         number;
  fileUri:          string;
  mimeType?:        string;
}): Promise<string> {
  const { userId, localActivityId, position, fileUri, mimeType } = opts;

  const ext = (fileUri.split('.').pop() ?? 'jpg').toLowerCase().split('?')[0];
  const path = `${userId}/draft/${localActivityId}/${position}.${ext}`;
  const contentType = mimeType ?? `image/${ext === 'jpg' ? 'jpeg' : ext}`;

  // RN-friendly: read the local file as ArrayBuffer (avoids RN Blob quirks).
  const arrayBuffer = await fetch(fileUri).then((r) => r.arrayBuffer());
  if (!arrayBuffer.byteLength) throw new Error('image read returned 0 bytes');

  const { error } = await supabase.storage
    .from('activity-photos')
    .upload(path, arrayBuffer, { contentType, upsert: true });
  if (error) throw error;

  return path;
}

// Best-effort: delete a draft photo the user removed before publishing.
export async function deleteDraftPhoto(path: string): Promise<void> {
  await supabase.storage.from('activity-photos').remove([path]).catch(() => {/* non-fatal */});
}
