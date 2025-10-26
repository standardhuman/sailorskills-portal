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

## Videos Section (⚠️ Placeholder)

The videos section is implemented with a placeholder message. Video functionality requires:

### Database Schema
- `youtube_playlists` table exists and is ready
- Links boats to YouTube playlists via `boat_id`
- Fields: `playlist_url`, `title`, `description`, `is_public`

### Implementation TODO
To enable video thumbnails from the most recent service:

1. **Add playlist to boat** (via Operations):
   - Use the playlist form in Operations to add YouTube playlist URL
   - Mark as `is_public: true` to show in portal

2. **Fetch YouTube data**:
   - Update `src/api/boat-data.js` to query `youtube_playlists` table
   - Extract playlist ID from YouTube URL
   - Use YouTube Data API to fetch video thumbnails OR
   - Embed playlist directly with iframe

3. **Display thumbnails**:
   - Show latest 3-6 videos from most recent service
   - Clicking thumbnail opens video in modal or new tab
   - Consider using YouTube iframe embed API for best UX

### Example YouTube Playlist URL
```
https://www.youtube.com/playlist?list=PLxxxxxxxxxxxxxxxxxxxxxx
```

### Future Enhancement Ideas
- Filter videos by service date
- Show video count badge
- Add video player modal
- Organize videos by service log
- Download videos for offline viewing

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
