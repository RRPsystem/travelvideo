# AI Travel Video Studio

Genereer professionele reisvideo's met AI. Selecteer clips per bestemming, voeg een voiceover toe, en laat de AI een prachtige video maken.

## Features

- 🎬 **Video Generator** - Maak automatisch video's van je reisbestemmingen
- 🔍 **Media Selector** - Zoek clips via Pexels, Unsplash, en Storyblocks
- 🎤 **Voiceover Upload** - Voeg je eigen voiceover toe
- 📚 **Video Bibliotheek** - Bekijk en beheer je gegenereerde video's
- 🗺️ **Rondreis Planner Import** - Importeer bestemmingen automatisch

## Deployment naar Vercel

### 1. Maak een nieuwe GitHub repository

```bash
git init
git add .
git commit -m "Initial commit - AI Travel Video Studio"
git branch -M main
git remote add origin https://github.com/JOUW-USERNAME/ai-travel-video.git
git push -u origin main
```

### 2. Importeer in Vercel

1. Ga naar [vercel.com](https://vercel.com)
2. Klik op "Add New Project"
3. Importeer je GitHub repository
4. Vercel detecteert automatisch de configuratie

### 3. Environment Variables toevoegen

Ga naar **Project Settings → Environment Variables** en voeg toe:

| Variable | Beschrijving |
|----------|-------------|
| `PEXELS_API_KEY` | Pexels API key (gratis op pexels.com/api) |
| `UNSPLASH_ACCESS_KEY` | Unsplash API key (gratis op unsplash.com/developers) |
| `STORYBLOCKS_PUBLIC_KEY` | Storyblocks API key (optioneel) |
| `SHOTSTACK_API_KEY` | Shotstack API key voor video rendering |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob Storage token |

### 4. Custom Domain (optioneel)

1. Ga naar **Project Settings → Domains**
2. Voeg je domein toe (bijv. `ai-travelvideo.nl`)
3. Configureer DNS bij je domeinprovider

## Lokaal ontwikkelen

```bash
npm install
vercel dev
```

Open http://localhost:3000

## API Routes

| Route | Beschrijving |
|-------|-------------|
| `GET /api/pexels/search` | Zoek Pexels video's |
| `GET /api/unsplash/search` | Zoek Unsplash afbeeldingen |
| `GET /api/storyblocks/search` | Zoek Storyblocks video's |
| `POST /api/video/generate` | Start video generatie |
| `GET /api/video/status/:id` | Check video status |
| `POST /api/video/upload-voiceover` | Upload voiceover |
| `POST /api/videos/upload` | Upload video naar storage |
| `GET /api/videos/list` | Lijst van opgeslagen video's |
| `DELETE /api/videos/delete` | Verwijder video |

## Licentie

MIT License - RRP System
