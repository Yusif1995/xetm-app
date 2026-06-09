import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";

export const dynamic = "force-dynamic";

interface DailyItem {
  text: string;
  translation: string;
  source: string;
  type: "ayah" | "hadith";
}

const DEFAULT_FALLBACKS: DailyItem[] = [
  {
    text: "فَإِنَّ مَعَ الْعُسْرِ يُسْرًا",
    translation: "Şübhəsiz ki, hər çətinliklə bərabər bir asanlıq da vardır.",
    source: "Şərh (İnşirah) surəsi, 5-ci ayə",
    type: "ayah"
  },
  {
    text: "خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ",
    translation: "Sizin ən xeyirliniz Quranı öyrənən və onu başqalarına öyrədəndir.",
    source: "Hədis (Səhih əl-Buxari)",
    type: "hadith"
  }
];

export async function GET() {
  try {
    const configRef = doc(db, "settings", "config");
    const configSnap = await getDoc(configRef);
    
    // Get current date in Baku timezone (YYYY-MM-DD)
    const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Baku" });

    if (configSnap.exists()) {
      const configData = configSnap.data();
      
      // If already updated today, return the cached daily item
      if (configData.lastDailyUpdate === todayStr && configData.currentDailyItem) {
        return NextResponse.json(configData.currentDailyItem);
      }
    }

    // Otherwise, generate a new daily item using Gemini API
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "YOUR_GEMINI_API_KEY_HERE") {
      console.warn("Gemini API Key missing for daily item generation. Using fallback.");
      return NextResponse.json(getRandomFallback());
    }

    const systemInstruction = 
      "Sən Quran Xətm tətbiqinin gündəlik məzmun seçən köməkçisisən. " +
      "Hər gün üçün bir ədəd Quran ayəsi və ya mötəbər (səhih) hədis seçirsən. " +
      "Seçdiyin ayə/hədis insanların mənəviyyatını ucaldan, səbr, elm, gözəl əxlaq, yardımsevərlik, sevgi və ya doğruluq mövzularında olmalıdır. " +
      "Sən cavabı yalnız və yalnız aşağıdakı JSON formatında qaytarmalısan:\n" +
      "{\n" +
      "  \"text\": \"Ərəbcə orijinal mətn (hərəkələri ilə birlikdə)\",\n" +
      "  \"translation\": \"Azərbaycan dilində gözəl və anlaşıqlı tərcüməsi\",\n" +
      "  \"source\": \"Dəqiq mənbə (məs. Bəqərə surəsi, 153-cü ayə və ya Səhih əl-Buxari, 1234)\",\n" +
      "  \"type\": \"ayah\" və ya \"hadith\"\n" +
      "}";

    const prompt = "Bu gün üçün ilhamverici bir Quran ayəsi və ya mötəbər bir hədis seçib JSON olaraq qaytar.";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: {
          parts: [{ text: systemInstruction }],
        },
        generationConfig: {
          temperature: 1.0, // higher temperature to get a different one every day
          responseMimeType: "application/json",
          maxOutputTokens: 1024,
        }
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini API returned status ${response.status}`);
    }

    const data = await response.json();
    const jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!jsonText) {
      throw new Error("No text returned from Gemini");
    }

    const dailyItem: DailyItem = JSON.parse(jsonText);
    
    // Validate response structure
    if (!dailyItem.text || !dailyItem.translation || !dailyItem.source || !dailyItem.type) {
      throw new Error("Invalid daily item structure from Gemini");
    }

    // Save to Firestore config so we don't query Gemini again today
    if (configSnap.exists()) {
      await updateDoc(configRef, {
        currentDailyItem: dailyItem,
        lastDailyUpdate: todayStr
      });
    }

    return NextResponse.json(dailyItem);
  } catch (error) {
    console.error("Error generating daily item, returning fallback:", error);
    return NextResponse.json(getRandomFallback());
  }
}

function getRandomFallback(): DailyItem {
  const randomIdx = Math.floor(Math.random() * DEFAULT_FALLBACKS.length);
  return DEFAULT_FALLBACKS[randomIdx];
}
