import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const port = 3000;

async function bootstrap() {
  const app = express();

  // Allow larger payload for screenshots and camera uploads
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  // 1. AI ENDPOINT: Recognize cocktail / drink / dish recipe from screenshot
  app.post('/api/ai/recipe-from-screenshot', async (req, res) => {
    try {
      const { imageBase64, mimeType } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ error: 'Nenalezen žádný obrázek k analýze' });
      }

      const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');

      const prompt = `Jsi profesionální vrchní barman a šéfkuchař v luxusním podniku "nox. Fleeca Tower - Drinks & Dining".
Analyzuj přiložený screenshot nebo fotografii receptury drinku, koktejlu, nápojového lístku, barmanské karty nebo receptu.

Extrahuj a doplň následující údaje ve strukturovaném JSON formátu:
- "name": Název receptu / nápoje / položky (např. "Nox Old Fashioned", "Espresso Martini")
- "category": Jedna z hodnot: "cocktail" | "shot" | "wine" | "beer" | "soft" | "food" | "special"
- "sellPrice": Doporučená nebo uvedená prodejní cena v dolarech ($) jako číslo (např. 280)
- "description": Krátký lákavý popis a chuťový profil nápoje
- "preparationNotes": Stručný postup přípravy (míchání, šejkrování, sklo, ozdoba)
- "yieldAmount": Kolik kusů se vyrobí z jedné várky (výchozí 20 ks, nebo 1 ks)
- "ingredients": Seznam potřebných surovin:
  - "rawName": Přesný název suroviny (např. "Vodka", "Limetkový džus", "Kávový likér", "Třtinový cukr", "Led")
  - "amountStr": Textová dávka (např. "50 ml", "2 cl", "1 ks", "střik")
  - "quantity": Numerické množství pro recepturu (např. 1.0 pro běžnou dávku suroviny, nebo 0.5)
  - "unit": Jednotka ("ml", "cl", "ks", "dávka")

Odpověz POUZE validním JSON objektem v tomto formátu:
{
  "name": "Název",
  "category": "cocktail",
  "sellPrice": 250,
  "description": "Popis",
  "preparationNotes": "Postup",
  "yieldAmount": 20,
  "ingredients": [
    {
      "rawName": "Vodka Premium",
      "amountStr": "40 ml",
      "quantity": 1.0,
      "unit": "dávka"
    }
  ]
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [
          {
            inlineData: {
              mimeType: mimeType || 'image/png',
              data: cleanBase64,
            },
          },
          { text: prompt },
        ],
        config: {
          responseMimeType: 'application/json',
        },
      });

      const responseText = response.text || '{}';
      const parsed = JSON.parse(responseText);
      return res.json(parsed);
    } catch (err: any) {
      console.error('Chyba při AI analýze receptu:', err);
      return res.status(500).json({ error: err.message || 'Chyba při komunikaci s Gemini AI' });
    }
  });

  // 2. AI ENDPOINT: Recognize stock items and quantities from inventory screenshot
  app.post('/api/ai/inventory-from-screenshot', async (req, res) => {
    try {
      const { imageBase64, mimeType, existingItemNames } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ error: 'Nenalezen žádný obrázek k analýze' });
      }

      const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');

      const existingNamesStr = Array.isArray(existingItemNames) && existingItemNames.length > 0
        ? existingItemNames.slice(0, 100).join(', ')
        : 'žádné';

      const prompt = `Jsi skladový auditor a manažer baru "nox. Fleeca Tower - Drinks & Dining".
Podívej se na tento screenshot nebo fotku, který zobrazuje stav skladu, herní inventář baru (např. FiveM / GTA stash, skříň, trezor, skladový HUD), skladovou tabulku, fakturu nebo dodací list.

Známé existující položky v baru nox.:
${existingNamesStr}

Tvůj úkol:
1. Rozpoznej všechny položky, lahve, suroviny, bedny a nápoje viditelné na screenshotu.
2. Přečti přesný počet kusů (stock / count) u každé položky (např. číslo u ikony "25x", "10", "x15", "100").
3. Urči kategorii: "alcohol" | "soft" | "garnish" | "food" | "other"
4. Pokud je viditelná nákupní/prodejní cena, odhadni ji do "estimatedPrice", jinak 0.
5. Uveď confidence ("high" | "medium" | "low").
6. Pokud se položka shoduje s některou ze známých existujících položek v baru, uveď ji do "matchedExistingName".

Vrať POUZE validní JSON formát:
{
  "summary": "Stručný souhrn nalezených položek a celkového stavu",
  "items": [
    {
      "name": "Název položky",
      "quantity": 10,
      "unit": "ks",
      "category": "alcohol",
      "estimatedPrice": 120,
      "confidence": "high",
      "matchedExistingName": "Položka ze seznamu nebo null"
    }
  ]
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [
          {
            inlineData: {
              mimeType: mimeType || 'image/png',
              data: cleanBase64,
            },
          },
          { text: prompt },
        ],
        config: {
          responseMimeType: 'application/json',
        },
      });

      const responseText = response.text || '{"items": [], "summary": ""}';
      const parsed = JSON.parse(responseText);
      return res.json(parsed);
    } catch (err: any) {
      console.error('Chyba při AI analýze skladu:', err);
      return res.status(500).json({ error: err.message || 'Chyba při komunikaci s Gemini AI' });
    }
  });

  // Frontend integration: Vite middleware in development, static in production
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve('dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve('dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`nox. server running on http://0.0.0.0:${port}`);
  });
}

bootstrap().catch((err) => {
  console.error('Chyba při spuštění nox serveru:', err);
});
