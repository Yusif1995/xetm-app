import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface DailyResponse {
  text: string;
  translation: string;
  source: string;
  type: "ayah";
  ayah: {
    text: string;
    translation: string;
    source: string;
  };
  hadith: {
    text: string;
    translation: string;
    source: string;
  };
}

const FALLBACK_RESPONSE: DailyResponse = {
  text: "فَإِنَّ مَعَ الْعُسْرِ يُسْرًا",
  translation: "Şübhəsiz ki, hər çətinliklə bərabər bir asanlıq da vardır.",
  source: "Şərh (İnşirah) surəsi, 5-ci ayə",
  type: "ayah",
  ayah: {
    text: "فَإِنَّ مَعَ الْعُسْرِ يُسْرًا",
    translation: "Şübhəsiz ki, hər çətinliklə bərabər bir asanlıq da vardır.",
    source: "Şərh (İnşirah) surəsi, 5-ci ayə"
  },
  hadith: {
    text: "خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ",
    translation: "Sizin ən xeyirliniz Quranı öyrənən və onu başqalarına öyrədəndir.",
    source: "Hədis (Səhih əl-Buxari)"
  }
};

// In-memory cache for the current day's item. The server has no Firestore write access,
// so the item is kept per server process instead of in settings/config.
let cachedItem: { date: string; data: DailyResponse } | null = null;
// Shared in-flight generation so concurrent requests trigger a single Gemini call
let inflight: { date: string; promise: Promise<DailyResponse> } | null = null;

export async function GET() {
  // Get current date in Baku timezone (YYYY-MM-DD)
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Baku" });

  if (cachedItem && cachedItem.date === todayStr) {
    return NextResponse.json(cachedItem.data);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "YOUR_GEMINI_API_KEY_HERE") {
    console.warn("Gemini API Key missing for daily item generation. Using fallback.");
    return NextResponse.json(FALLBACK_RESPONSE);
  }

  if (!inflight || inflight.date !== todayStr) {
    const promise = generateDailyItem(apiKey);
    inflight = { date: todayStr, promise };
    promise
      .then((data) => {
        cachedItem = { date: todayStr, data };
      })
      .catch(() => {})
      .finally(() => {
        if (inflight?.promise === promise) inflight = null;
      });
  }

  try {
    return NextResponse.json(await inflight.promise);
  } catch (error) {
    console.error("Error generating daily item, returning fallback:", error);
    return NextResponse.json(FALLBACK_RESPONSE);
  }
}

async function generateDailyItem(apiKey: string): Promise<DailyResponse> {
  const systemInstruction = 
    "Sən Quran Xətm tətbiqinin gündəlik məzmun seçən köməkçisisən. " +
    "Hər gün üçün eyni anda bir ədəd Quran ayəsi və bir ədəd mötəbər (səhih) hədis seçirsən. " +
    "Seçdiyin ayə və hədis insanların mənəviyyatını ucaldan, səbr, elm, gözəl əxlaq, yardımsevərlik, sevgi və ya doğruluq mövzularında olmalıdır. " +
    "Sən cavabı yalnız və yalnız aşağıdakı JSON formatında qaytarmalısan:\n" +
    "{\n" +
    "  \"ayah\": {\n" +
    "    \"text\": \"Ayənin ərəbcə orijinal mətn (hərəkələri ilə birlikdə)\",\n" +
    "    \"translation\": \"Azərbaycan dilində gözəl və anlaşıqlı tərcüməsi\",\n" +
    "    \"source\": \"Dəqiq surə adı və ayə nömrəsi (məs. Bəqərə surəsi, 153)\"\n" +
    "  },\n" +
    "  \"hadith\": {\n" +
    "    \"text\": \"Hədisin ərəbcə orijinal mətn (əgər varsa, yoxdursa boş burax)\",\n" +
    "    \"translation\": \"Azərbaycan dilində gözəl və anlaşıqlı tərcüməsi\",\n" +
    "    \"source\": \"Mötəbər hədis mənbəyi (məs. Səhih əl-Buxari, 1234)\"\n" +
    "  }\n" +
    "}";

  const prompt = "Bu gün üçün bir ədəd Quran ayəsi və bir ədəd mötəbər hədis seçib JSON olaraq qaytar.";
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

  const dailyData = JSON.parse(jsonText);
  
  // Validate response structure
  if (!dailyData.ayah || !dailyData.ayah.text || !dailyData.ayah.translation || !dailyData.ayah.source ||
      !dailyData.hadith || !dailyData.hadith.translation || !dailyData.hadith.source) {
    throw new Error("Invalid daily item structure from Gemini");
  }

  const responseData: DailyResponse = {
    text: dailyData.ayah.text,
    translation: dailyData.ayah.translation,
    source: dailyData.ayah.source,
    type: "ayah",
    ayah: {
      text: dailyData.ayah.text,
      translation: dailyData.ayah.translation,
      source: dailyData.ayah.source
    },
    hadith: {
      text: dailyData.hadith.text || "",
      translation: dailyData.hadith.translation,
      source: dailyData.hadith.source
    }
  };

  return responseData;
}
