# Portal Dashboard Features

## Paint Condition Gradient (✅ Implemented)

The dashboard displays a prominent rainbow gradient showing the current paint condition of the vessel. This helps customers visualize when repainting is needed.

### Features
- **Rainbow gradient bar**: Matches the billing UI gradient (gray → green → yellow → orange → red)
- **Anchor marker**: Positioned on the gradient based on paint condition from latest service
- **Status message**: Color-coded message indicating:
  - **Good** (green): Paint condition is excellent
  - **Due Soon** (yellow): Good-fair or fair - consider repainting in near future
  - **Past Due** (red): Fair-poor or worse - paint needs attention soon
- **Service date**: Shows days since last inspection

### Data Source
- Fetches latest `service_logs` entry for the boat
- Uses `paint_condition_overall` field
- Calculates days since `service_date`

### Paint Condition Values
- `not-inspected` (0%) - gray
- `excellent` (12.5%) - green
- `exc-good` (18.75%)
- `good` (37.5%) - lime
- `good-fair` (50%) - yellow ⚠️ **Repainting window begins**
- `fair` (62.5%) - orange
- `fair-poor` (75%) - deep orange ⚠️ **Past due**
- `poor` (87.5%) - red
- `very-poor` (100%) - dark red

## Videos Section (✅ Implemented)

The videos section fetches and displays service videos from YouTube playlists linked to each boat.

### How It Works
1. **Playlist Storage**: `youtube_playlists` table stores playlist URLs for each boat
2. **Video Fetching**: Supabase Edge Function `get-playlist-videos` fetches videos via YouTube Data API v3
3. **Service Filtering**: Videos are filtered to show only those published on/after the latest service date
4. **Display**: Thumbnails shown in a responsive grid, clicking opens video in new tab

### Integration with BOATY

This feature uses BOATY's proven playlist matching logic:
- **Exact Match**: Playlist title == boat name
- **Prefix Match**: Playlist starts with boat name
- **Contains Match**: Boat name appears in playlist title

See `/Users/brian/app-development/sailorskills-repos/sailorskills-operations/BOATY_PLAYLIST_INTEGRATION.md` for details on how Operations team populates the `youtube_playlists` table.

### Adding Videos for a Boat

**Via Operations Team**:
1. Navigate to boat details in Operations
2. Use "Add YouTube Playlist" form
3. Enter playlist URL (e.g., `https://www.youtube.com/playlist?list=PLxxx`)
4. Mark as `is_public: true`
5. Save

**Result**: Videos automatically appear in customer portal dashboard

### Database Schema
```sql
CREATE TABLE youtube_playlists (
  id UUID PRIMARY KEY,
  boat_id UUID REFERENCES boats(id),
  playlist_url TEXT NOT NULL,
  playlist_id TEXT,
  title TEXT,
  is_public BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMP
);
```

### API Functions

#### `getBoatPlaylist(boatId)`
Queries `youtube_playlists` table for public playlists linked to the boat.

#### `getPlaylistVideos(playlistId, serviceDate)`
Calls Supabase Edge Function to fetch videos from YouTube and filter by service date.

#### `getServiceMedia(boatId)`
Combines photos from service logs with videos from YouTube playlist.

### Video Display Features
- ✅ Responsive grid layout
- ✅ Thumbnail preview images
- ✅ Play button overlay
- ✅ Click to open in new tab
- ✅ Filtered by latest service date
- ✅ Graceful handling when no playlist exists

### Future Enhancements
- Video player modal (in-page viewing)
- Video title/description overlay
- Video count badge
- Multiple playlists per boat
- Video upload date display

## API Functions

### `getPaintCondition(boatId)`
Returns paint condition data from latest service log.

### `getPaintStatus(condition, daysSince)`
Calculates if paint is due for repainting based on condition and time.

### `getServiceMedia(boatId)`
Returns photos from latest service (videos TODO).

### `daysSinceService(serviceDate)`
Calculates days elapsed since service date.

## Testing

Tested with vessel "Maris":
- ✅ Paint condition: Fair (62.5% on gradient)
- ✅ Status: "Consider repainting in the near future" (due-soon)
- ✅ Service date: "Last inspected 8 days ago (Oct 18, 2025)"
- ✅ Videos placeholder displayed correctly
