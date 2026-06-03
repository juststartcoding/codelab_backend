# CodeLab Backend — Deploy to Railway or Render

## Railway (Recommended)
1. Push this `backend/` folder to GitHub
2. railway.app → New Project → Deploy from GitHub
3. Set Root Directory: `backend`
4. Add Environment Variables:
   - PORT = 5000
   - JWT_SECRET = (any long random string)
   - FRONTEND_URL = https://your-frontend.vercel.app
   - NODE_ENV = production
5. Deploy → copy your Railway URL

## Render (Alternative)
1. render.com → New Web Service → Connect GitHub
2. Root Directory: `backend`
3. Build Command: `npm install`
4. Start Command: `node server.js`
5. Add same env vars as above
