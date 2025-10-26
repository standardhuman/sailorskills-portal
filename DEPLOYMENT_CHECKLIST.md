# YouTube Video Integration - Deployment Checklist

## ✅ Completed

- [x] Edge function created with OAuth support (`get-playlist-videos`)
- [x] Portal API updated to fetch videos (`boat-data.js`)
- [x] Portal UI updated to display thumbnails (`portal.js`)
- [x] Documentation complete (BOATY_PLAYLIST_INTEGRATION.md, TESTING_VIDEOS.md)
- [x] Code pushed to GitHub (both repos)
- [x] Paint condition gradient working in portal

## 🚀 Next Steps to Deploy

### 1. Configure Supabase Secrets

Run these commands from the Operations directory:

```bash
cd /Users/brian/app-development/sailorskills-repos/sailorskills-operations

# Get credentials from BOATY:
# - client_id and client_secret: sailorskills-video/client_secrets.json
# - refresh_token: sailorskills-video/token.json

supabase secrets set YOUTUBE_CLIENT_ID=<paste_client_id>
supabase secrets set YOUTUBE_CLIENT_SECRET=<paste_client_secret>
supabase secrets set YOUTUBE_REFRESH_TOKEN=<paste_refresh_token>
```

**Verify secrets are set:**
```bash
supabase secrets list
```

### 2. Deploy Edge Function

```bash
cd /Users/brian/app-development/sailorskills-repos/sailorskills-operations
supabase functions deploy get-playlist-videos
```

### 3. Add Test Playlist for Maris

**Option A: Via SQL (Supabase Dashboard)**

```sql
-- Verify Maris boat ID
SELECT id, name FROM boats WHERE name ILIKE '%maris%';

-- Insert playlist (replace with real YouTube playlist)
INSERT INTO youtube_playlists (
  boat_id,
  playlist_url,
  playlist_id,
  title,
  is_public
) VALUES (
  '73ea20dd-3dca-4ec6-bc64-f09a3279874a',  -- Maris boat_id
  'https://www.youtube.com/playlist?list=PLxxxxxx',  -- Replace with real playlist
  'PLxxxxxx',  -- Replace with real playlist ID
  'Maris',
  true
);
```

**Option B: Via Operations UI** (when playlist form is implemented)
1. Navigate to Maris boat details
2. Click "Add YouTube Playlist"
3. Paste playlist URL
4. Mark as "Public"
5. Save

### 4. Test in Portal

1. Visit https://portal.sailorskills.com
2. Login as standardhuman@gmail.com / KLRss!650
3. Check "Latest Service Videos" section
4. Verify videos appear as thumbnails
5. Click thumbnail to open video

## 🔧 Troubleshooting

### Edge Function Errors

Check logs:
```bash
supabase functions logs get-playlist-videos
```

### No Videos Showing

1. Verify secrets are configured
2. Check playlist exists in database
3. Verify playlist privacy (unlisted/public)
4. Check browser console for errors

### OAuth Token Issues

If you see "Failed to refresh access token":
- Verify all 3 secrets are set correctly
- Check that refresh token hasn't been revoked
- Try getting a fresh token from BOATY

## 📋 Files Modified

**sailorskills-portal:**
- src/api/boat-data.js
- src/views/portal.js
- portal.html
- PORTAL_FEATURES.md
- TESTING_VIDEOS.md

**sailorskills-operations:**
- supabase/functions/get-playlist-videos/index.ts
- BOATY_PLAYLIST_INTEGRATION.md

## 🎯 Success Criteria

- [ ] Supabase secrets configured
- [ ] Edge function deployed successfully
- [ ] Test playlist added to youtube_playlists table
- [ ] Videos appear on portal dashboard for Maris
- [ ] Clicking thumbnails opens videos
- [ ] Videos filtered by latest service date

## 💡 How It Works

1. **Customer visits portal** → Dashboard loads
2. **Portal fetches playlist** → Queries youtube_playlists table
3. **Portal calls edge function** → Passes playlist ID + service date
4. **Edge function uses OAuth** → Refreshes token, fetches videos from YouTube
5. **Videos filtered by date** → Only videos from latest service
6. **Thumbnails displayed** → Customer can click to watch

## 🔐 Security Notes

- OAuth credentials stored in Supabase secrets (encrypted)
- Refresh token lasts indefinitely (until manually revoked)
- Access tokens auto-refresh every hour
- Works with unlisted playlists (your standard privacy level)
- Portal uses anon key (no OAuth credentials exposed to browser)
