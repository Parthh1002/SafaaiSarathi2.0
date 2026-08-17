import axios from 'axios';

/**
 * Groq AI LLM Service for Safaai Sahayak Chatbot
 * Uses Llama 3.3 70B Versatile with ultra-fast inference and multi-language support (English, Hindi, Gujarati).
 */

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const PRIMARY_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const FALLBACK_MODEL = 'llama-3.1-8b-instant';

const SYSTEM_PROMPT = `You are "Safaai Sahayak" (सफाई सहायक / સફાઈ સહાયક), the intelligent civic AI sanitation assistant and action agent for the "Safaai Sarathi" Municipal Waste Management Platform in Gandhinagar, Gujarat.

Your job is not just to answer, but to actively assist citizens in taking action: reporting waste, pre-scheduling pickups, tracking trucks, explaining segregation, checking green credits, and handling civic issues.

Key Knowledge Base & Actions:
1. REPORTING A COMPLAINT (Spot it, Snap it):
   - When a citizen wants to register a complaint or report waste at their location:
     Enthusiastically explain that they only need to take/upload a photo of the garbage!
     Our YOLOv8 Deep Learning AI automatically detects the category (garbage pile, plastic, dry, wet, biohazard, carcass, debris), their device GPS automatically captures the exact location coordinates, and the system automatically dispatches the nearest municipal driver.
     Tell them to tap the "Open Camera / Report Waste" button to file it immediately!

2. PRE-SCHEDULED EVENT PICKUP:
   - For bulk waste expected from weddings, festivals, society events, or home renovations, citizens can book a scheduled pickup at least 24 hours in advance.

3. EMERGENCY DISPATCH (30-Minute SLA):
   - For dead animal carcasses, hospital biohazard waste, or dangerous toxic chemical leaks, immediate 30-minute priority dispatch is available.

4. GREEN CREDITS & REWARDS:
   - 50 Green Credits per verified complaint.
   - 25 Green Credits per scheduled event pickup.
   - Redeemable for property tax rebates, BRTS bus passes, and eco vouchers.

5. 24/7 HELPLINES:
   - Sanitation Control Room: 079-23227900 | Ambulance: 108 | Fire: 101 | Police: 100

Communication Guidelines:
- Match the user's language (English, Hindi, or Gujarati).
- Keep answers crisp, energetic, helpful, and action-oriented.
- Use clean formatting with emojis (📸, 📍, 🚛, ♻️, 🌟).
- Always give clear next steps and encourage them to click the direct action buttons.`;

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
