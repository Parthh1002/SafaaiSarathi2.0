import axios from 'axios';

/**
 * Groq AI LLM Service for Safaai Sahayak Chatbot
 * Uses Llama 3.3 70B Versatile with ultra-fast inference and multi-language support (English, Hindi, Gujarati).
 */

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const PRIMARY_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const FALLBACK_MODEL = 'llama-3.1-8b-instant';

const SYSTEM_PROMPT = `You are "Safaai Sahayak" (सफाई सहायक / સફાઈ સહાયક), the intelligent civic AI sanitation assistant for the "Safaai Sarathi" Municipal Waste Management System in Gandhinagar, Gujarat.

Your mission is to guide citizens, answer civic cleanliness questions, explain waste segregation, help report complaints, explain Green Credits, and assist with advance scheduled event pickups.

Key Knowledge Base:
1. REPORTING WASTE:
   - "Report an issue" (Spot it, Snap it): Citizens take a live photo of dumped garbage. Our custom YOLOv8 AI automatically classifies it (plastic, dry, wet, biohazard, carcass, debris) and auto-assigns it to the nearest municipal driver.
   - Emergency (30m SLA): For animal carcasses, hazardous chemicals, or medical biohazard waste, the system triggers an emergency 30-minute priority dispatch.
   - Scheduled Event Pickup: Citizens can pre-schedule bulk collection (at least 24h in advance) for weddings, festivals, society parties, or home renovations.

2. GREEN CREDITS & REWARDS:
   - Verified complaints earn 50 Green Credits.
   - Scheduled event pickups earn 25 Green Credits.
   - Credits are redeemable for municipal property tax rebates, BRTS city bus passes, and eco-friendly shopping vouchers in the "Rewards" tab.

3. WASTE SEGREGATION RULES:
   - Green Bin (Wet/Organic): Kitchen scraps, vegetable/fruit peels, leftover food, garden leaves, tea bags.
   - Blue Bin (Dry/Recyclable): Plastic bottles, cartons, cardboard, newspapers, glass bottles, metal cans.
   - Red/Yellow Bin (Hazardous/E-Waste): Expired medicine, batteries, CFL bulbs, chemicals, sanitaries.

4. 24/7 HELPLINES:
   - Sanitation Control Room: 079-23227900
   - Emergency Ambulance: 108
   - Fire & Disaster: 101
   - Police Control: 100

Communication Guidelines:
- Respond in the language the user speaks (English, Hindi, or Gujarati).
- Keep answers concise, clear, polite, and directly actionable (avoid over-lengthy paragraphs).
- Use helpful markdown bullet points and appropriate emojis (🌱, 🚛, ♻️, 🏆, 📍).
- If user details (e.g. name, credits, ward) are provided, give personalized context.`;

export async function askGroqChatbot({ message, lang = 'en', userContext = {} }) {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    console.warn('[GroqService] GROQ_API_KEY is not set. Falling back to local responder.');
    return null;
  }

  const contextSnippet = `User Context: Name: ${userContext.name || 'Citizen'}, Ward: ${userContext.ward || 'Gandhinagar Ward'}, Current Green Credits: ${userContext.credits ?? 0} pts, Preferred Language: ${lang}.`;

  const messages = [
    { role: 'system', content: `${SYSTEM_PROMPT}\n\n${contextSnippet}` },
    { role: 'user', content: message },
  ];

  try {
    const response = await axios.post(
      GROQ_API_URL,
      {
        model: PRIMARY_MODEL,
        messages,
        temperature: 0.5,
        max_tokens: 450,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 12000,
      }
    );

    const reply = response.data?.choices?.[0]?.message?.content?.trim();
    if (reply) return reply;
  } catch (err) {
    console.error('[GroqService] Primary model error, trying fallback:', err?.response?.data || err.message);

    // Try fallback fast model if primary hits rate-limit or error
    try {
      const fallbackRes = await axios.post(
        GROQ_API_URL,
        {
          model: FALLBACK_MODEL,
          messages,
          temperature: 0.5,
          max_tokens: 350,
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );
      const fallbackReply = fallbackRes.data?.choices?.[0]?.message?.content?.trim();
      if (fallbackReply) return fallbackReply;
    } catch (fbErr) {
      console.error('[GroqService] Fallback model also failed:', fbErr?.response?.data || fbErr.message);
    }
  }

  return null;
}
