# Testing Video Integration with Maris

## Prerequisites

1. **YouTube API Key**: Required in Supabase secrets
2. **Supabase Edge Function**: `get-playlist-videos` must be deployed
3. **YouTube Playlist**: Create or identify a playlist for Maris

## Step 1: Create/Find YouTube Playlist

### Option A: Use Existing Playlist
If Maris already has a YouTube playlist:
1. Go to Sailor Skills YouTube channel
2. Find the "Maris" playlist (or similar name)
3. Copy the playlist URL

### Option B: Create Test Playlist
1. Go to YouTube (logged in as Sailor Skills account)
2. Create new playlist named "Maris" or "Maris Test"
3. Add 1-2 test videos to the playlist
4. Make playlist **Public** or **Unlisted** (not Private)
5. Copy the playlist URL

Example URL format: `https://www.youtube.com/playlist?list=PLxxxxxxxxxxxxxxxxxxxxxx`

## Step 2: Extract Playlist ID

From the URL `https://www.youtube.com/playlist?list=PLxxxxxx`, extract the ID after `list=`:

Example:
- URL: `https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf`
- Playlist ID: `PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf`

## Step 3: Add Playlist to Database

### Using SQL (Supabase Dashboard)

1. Go to Supabase Dashboard → SQL Editor
2. Run this query (replace values):

```sql
-- Get Maris boat ID
SELECT id, name FROM boats WHERE name ILIKE '%maris%';

-- Insert playlist (replace IDs and URL)
INSERT INTO youtube_playlists (
  boat_id,
  playlist_url,
  playlist_id,
  title,
  is_public
) VALUES (
  '73ea20dd-3dca-4ec6-bc64-f09a3279874a',  -- Maris boat_id
  'https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf',
  'PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf',
  'Maris',
  true
);
```

### Using Operations UI (Future)

Once the Operations playlist form is implemented:
1. Navigate to Maris boat details
2. Click "Add YouTube Playlist"
3. Paste playlist URL
4. Mark as "Public"
5. Save

## Step 4: Deploy Edge Function (if not deployed)

```bash
cd /Users/brian/app-development/sailorskills-repos/sailorskills-operations
supabase functions deploy get-playlist-videos
```

## Step 5: Add YouTube OAuth Credentials to Supabase Secrets

If not already configured, set BOATY's OAuth credentials:

```bash
# Get credentials from BOATY directory:
# - client_id and client_secret from: sailorskills-video/client_secrets.json
# - refresh_token from: sailorskills-video/token.json

supabase secrets set YOUTUBE_CLIENT_ID=<client_id_from_client_secrets>
supabase secrets set YOUTUBE_CLIENT_SECRET=<client_secret_from_client_secrets>
supabase secrets set YOUTUBE_REFRESH_TOKEN=<refresh_token_from_token_json>
```

**Why OAuth?** Unlisted playlists require OAuth authentication (API key only works for public playlists)

## Step 6: Test in Portal

1. Visit https://portal.sailorskills.com
2. Login as `standardhuman@gmail.com` / `KLRss!650`
3. Should see "Welcome to Maris's Portal"
4. Scroll to "Latest Service Videos" section
5. Videos should appear as thumbnails

### Expected Behavior

**If playlist has videos**:
- Video thumbnails displayed in grid
- Play button overlay on each thumbnail
- Clicking opens video in new tab
- Only shows videos from latest service date (Oct 18, 2025)

**If playlist is empty**:
- "No videos available yet" message

**If no playlist in database**:
- "No videos available yet" message

## Troubleshooting

### No videos showing

1. **Check database**:
   ```sql
   SELECT * FROM youtube_playlists WHERE boat_id = '73ea20dd-3dca-4ec6-bc64-f09a3279874a';
   ```

2. **Check edge function logs**:
   - Go to Supabase Dashboard → Edge Functions → get-playlist-videos
   - Check logs for errors

3. **Check browser console**:
   - Open DevTools → Console
   - Look for errors calling edge function

4. **Verify OAuth credentials**:
   ```bash
   supabase secrets list
   ```
   Should show `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REFRESH_TOKEN`

5. **Check playlist privacy**:
   - Works with Public, Unlisted, AND Private playlists
   - OAuth authentication allows access to all privacy levels

### Videos from wrong date

The filter uses the latest service date (Oct 18, 2025 for Maris). Videos must be published on or after that date.

To test:
1. Upload a new video to the playlist today
2. Refresh portal dashboard
3. Should appear in the grid

## Manual API Test

Test the edge function directly (requires OAuth to be configured):

```bash
curl "https://fzygakldvvzxmahkdylq.supabase.co/functions/v1/get-playlist-videos?playlistId=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf&serviceDate=2025-10-18" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

Should return JSON with videos array.

**Note**: The edge function will use OAuth internally to access unlisted playlists. You don't need to pass OAuth tokens in the request - the function handles that automatically using the secrets configured in Supabase.

## Success Criteria

- ✅ Playlist added to youtube_playlists table
- ✅ Edge function deployed and accessible
- ✅ YouTube API key configured in secrets
- ✅ Videos display as thumbnails on portal dashboard
- ✅ Clicking thumbnail opens video in new tab
- ✅ Only videos from latest service shown

## Next Steps

Once working with Maris:
1. Add playlists for other boats
2. Test with boats that have multiple services
3. Verify date filtering works correctly
4. Consider adding video upload dates to UI
5. Implement video player modal (optional)
