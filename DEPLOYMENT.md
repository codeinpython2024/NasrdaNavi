# Deployment Guide - Render

## Quick Deploy Steps

### 1. Push to GitHub
```bash
git add render.yaml DEPLOYMENT.md
git commit -m "Add Render deployment configuration"
git push
```

### 2. Create Render Account
- Go to https://render.com
- Sign up with GitHub (recommended)

### 3. Create New Web Service
1. Click "New +" → "Web Service"
2. Connect your GitHub repository (NasrdaNavi)
3. Render will auto-detect the `render.yaml` configuration

### 4. Configure Environment Variables
In the Render dashboard:
- Add environment variable: `MAPBOX_ACCESS_TOKEN`
- Value: Your Mapbox token from `.env` file
- Click "Save"

### 5. Deploy
- Click "Create Web Service"
- Render will automatically build and deploy
- First deploy takes ~2-3 minutes
- You'll get a URL like: `https://nasrdanavi.onrender.com`

## Important Notes

### Free Tier Limitations
- Service sleeps after 15 minutes of inactivity
- Cold start takes ~30 seconds when waking up
- 750 hours/month free (enough for most use cases)

### Custom Domain (Optional)
- Go to Settings → Custom Domain
- Add your domain and configure DNS

### Monitoring
- View logs in Render dashboard
- Check deployment status
- Monitor resource usage

## Troubleshooting

**Build fails:**
- Check that all dependencies are in `requirements.txt`
- Verify Python version compatibility

**App crashes:**
- Check logs in Render dashboard
- Verify `MAPBOX_ACCESS_TOKEN` is set correctly
- Ensure GeoJSON files are in `static/` directory

**Slow performance:**
- Free tier has limited resources
- Consider upgrading to paid tier for production use

## Alternative: Manual Configuration

If `render.yaml` doesn't work, configure manually:

**Build Command:**
```
pip install -r requirements.txt
```

**Start Command:**
```
gunicorn -w 4 -b 0.0.0.0:$PORT main:app
```

**Environment:**
- Python 3
- Auto-deploy: Yes
