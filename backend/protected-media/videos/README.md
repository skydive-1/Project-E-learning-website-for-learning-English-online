# Protected interface videos

Files in this directory are served only by `/api/media/video/stream/:assetId` after a short-lived HttpOnly ticket is issued. Do not expose this directory through `express.static` or copy it into `frontend/public`.

Every file must also be registered in `backend/src/modules/media/publicVideoAssets.js`.
