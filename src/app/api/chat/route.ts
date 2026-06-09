import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Invalid messages format" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "YOUR_GEMINI_API_KEY_HERE") {
      return NextResponse.json(
        { error: "Süni İntellekt (Gemini) API açarı əlavə edilməyib. Zəhmət olmasa adminlə əlaqə saxlayın və ya .env.local faylını yoxlayın." },
        { status: 500 }
      );
    }

    // Map message history to Gemini API format
    // Gemini roles must be 'user' or 'model' (Next.js chat components often use 'user' or 'assistant')
    const contents = messages.map((msg: { role: string; content: string }) => {
      const role = msg.role === "assistant" ? "model" : "user";
      return {
        role: role,
        parts: [{ text: msg.content }],
      };
    });

    const systemInstruction = 
      "Sən Quran Xətm tətbiqinin Süni İntellekt Köməkçisisən (İslam AI Assistant). " +
      "İstifadəçilərin suallarına yalnız Quran ayələri, təfsirlər, mötəbər hədislər və dini biliklər çərçivəsində cavab verirsən. " +
      "Sənə verilən əsas tapşırıqlar:\n" +
      "1. Həmişə Azərbaycan dilində cavab ver.\n" +
      "2. Quran ayələrini təqdim edərkən imkan daxilində ərəbcə orijinal mətnini (hərəkəli şəkildə) yaz, ardınca Azərbaycan dilindəki mənasını/tərcüməsini qeyd et və mütləq Surə və ayə nömrəsini göstər (məsələn, Əl-Bəqərə surəsi, 153-cü ayə).\n" +
      "3. Hədis təqdim edərkən onun ravisini və hansı mötəbər hədis mənbəyindən (Səhih əl-Buxari, Müslim, Tirmizi, Əbu Davud və s.) olduğunu mütləq qeyd et.\n" +
      "4. Əgər istifadəçi dini mövzulardan kənar suallar verərsə, zərif şəkildə ona yalnız Quran, hədis və İslam dini mövzusunda kömək edə biləcəyini xatırlat.\n" +
      "5. Cavablarında həmişə hörmətli, zərif, elmi və yardımsevər ton istifadə et.";

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: contents,
        systemInstruction: {
          parts: [{ text: systemInstruction }],
        },
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
        }
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Gemini API Error Response:", errorData);
      const apiErrorMessage = errorData?.error?.message || "Müraciət uğursuz oldu.";
      return NextResponse.json(
        { error: `Gemini API xətası: ${apiErrorMessage}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!reply) {
      return NextResponse.json(
        { error: "Modeldən boş cavab gəldi." },
        { status: 502 }
      );
    }

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Daxili server xətası baş verdi." },
      { status: 500 }
    );
  }
}
