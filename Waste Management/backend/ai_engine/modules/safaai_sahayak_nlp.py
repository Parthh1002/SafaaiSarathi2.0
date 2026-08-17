"""
MODEL 5: AI Safaai Sahayak (Multilingual NLP Assistant)
======================================================
Category: Multilingual Civic NLP Assistant
Core Algorithm: Multilingual Semantic Intent Matching (TF-IDF N-gram & Cosine Similarity)

Features:
- Full native support for English (EN), Hindi (HI), and Gujarati (GU).
- Matches citizen natural-language queries against civic knowledge base intents.
- Evaluates similarity score; falls back gracefully if confidence is below 0.55 threshold.
- Starter Dataset with 50+ realistic multi-lingual civic queries across 5 core intents:
  1. waste_sorting_help
  2. rewards_inquiry
  3. emergency_assistance
  4. pickup_schedule_inquiry
  5. general_faq
"""

from typing import List, Dict, Any, Optional, Tuple
import re
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# Starter Multilingual Knowledge Base for Safaai Sarathi
INTENT_DATASET = [
    # ------------------------------------------------ 1. WASTE SORTING HELP
    {
        "intent": "waste_sorting_help",
        "lang": "en",
        "phrases": [
            "Which bin should I put vegetable peels and leftover food in?",
            "How do I separate wet waste and dry waste at home?",
            "Where do I throw broken glass bottles and plastic containers?",
            "Can I put used batteries and electronics in the blue bin?",
            "What is biodegradable waste and how to segregate it?",
            "Is construction debris accepted in regular household garbage?",
        ],
        "response_en": "Green Bin is for Wet/Biodegradable waste (food scraps, vegetable peels, garden leaves). Blue Bin is for Dry/Recyclable waste (plastic, paper, glass, metal). Hazardous items like batteries belong in red e-waste drops.",
        "response_hi": "हरा कूड़ेदान गीले कचरे (रसोई का कचरा, फलों के छिलके) के लिए है। नीला कूड़ेदान सूखे कचरे (प्लास्टिक, कागज, कांच) के लिए है। बैटरी व ई-वेस्ट को अलग रखें।",
        "response_gu": "લીલી કચરાપેટી ભીના કચરા (રસોડાનો કચરો, શાકભાજીની છાલ) માટે છે. ભૂરી કચરાપેટી સૂકા કચરા (પ્લાસ્ટિક, કાગળ, કાચ) માટે છે. બેટરી અને ઈ-કચરો અલગ રાખો.",
        "action": "OPEN_SEGREGATION_GUIDE"
    },
    {
        "intent": "waste_sorting_help",
        "lang": "hi",
        "phrases": [
            "गीला और सूखा कचरा कैसे अलग करें?",
            "रसोई का बचा हुआ खाना किस डस्टबिन में डालना है?",
            "प्लास्टिक और कांच की बोतलें कौन से कूड़ेदान में डालें?",
            "सब्जियों के छिलके और चाय पत्ती किस बिन में जाएगी?",
            "सूखे कचरे में क्या क्या आता है?",
            "इलेक्ट्रॉनिक कचरा और खराब बैटरी कहाँ फेंके?",
        ],
        "response_en": "Green Bin is for Wet waste (kitchen scraps), Blue Bin is for Dry recyclables (plastic, paper, metal). E-waste must be disposed at designated civic centers.",
        "response_hi": "गीला कचरा (सब्जी, फल, खाना) हरे कूड़ेदान में और सूखा कचरा (प्लास्टिक, गत्ता, कांच) नीले कूड़ेदान में डालें।",
        "response_gu": "રસોડાનો ભીનો કચરો લીલી કચરાપેટીમાં અને પ્લાસ્ટિક-કાગળ જેવો સૂકો કચરો ભૂરી કચરાપેટીમાં અલગ કરીને આપો.",
        "action": "OPEN_SEGREGATION_GUIDE"
    },
    {
        "intent": "waste_sorting_help",
        "lang": "gu",
        "phrases": [
            "ભીનો કચરો અને સૂકો કચરો કઈ કચરાપેટીમાં નાખવો?",
            "રસોડાનો કચરો અને શાકભાજીની છાલ કયા ડબ્બામાં મુકવી?",
            "પ્લાસ્ટિક અને કાગળનો કચરો ક્યાં આપવો?",
            "લીલા અને ભૂરા ડબ્બામાં શું શું નાખવું જોઈએ?",
            "જૂની દવાઓ અને બેટરી ક્યાં ફેંકવી?",
            "કચરાનું વર્ગીકરણ કેવી રીતે કરવું?",
        ],
        "response_en": "Green Bin is for Wet waste; Blue Bin is for Dry waste. Segregate at source to earn maximum Green Credits!",
        "response_hi": "कचरे का सही पृथक्करण करें: गीला कचरा हरे डिब्बे में और सूखा कचरा नीले डिब्बे में डालें।",
        "response_gu": "લીલી કચરાપેટી ભીના કચરા માટે અને ભૂરી કચરાપેટી સૂકા કચરા માટે છે. ઘરમાં જ અલગ પાડવાથી સ્વચ્છતા જળવાય છે.",
        "action": "OPEN_SEGREGATION_GUIDE"
    },

    # ------------------------------------------------ 2. REWARDS / GREEN CREDITS
    {
        "intent": "rewards_inquiry",
        "lang": "en",
        "phrases": [
            "How can I check my Green Credits balance and reward points?",
            "How do I earn reward points by reporting garbage piles?",
            "Can I redeem my green credits for property tax rebate or bus pass?",
            "Where can I find discount coupons and vouchers for sanitation rewards?",
            "How many credits do I get when my complaint is resolved?",
        ],
        "response_en": "You earn 50 Green Credits for every verified waste report! You can redeem your accumulated credits in the Rewards tab for municipal tax rebates, bus passes, and shopping vouchers.",
        "response_hi": "हर सत्यापित रिपोर्ट पर आपको 50 ग्रीन क्रेडिट मिलते हैं! इन्हें 'Rewards' सेक्शन में जाकर संपत्ति कर छूट या बस पास के लिए रिडीम करें।",
        "response_gu": "દરેક વેરિફાઇડ ફરિયાદ પર તમને 50 ગ્રીન ક્રેડિટ્સ મળે છે! આ ક્રેડિટ્સને તમે 'Rewards' ટેબમાં વેરા માફી કે વાઉચર માટે વાપરી શકો છો.",
        "action": "NAVIGATE_REWARDS"
    },
    {
        "intent": "rewards_inquiry",
        "lang": "hi",
        "phrases": [
            "मेरे ग्रीन क्रेडिट्स कितने हैं और बैलेंस कैसे देखें?",
            "कचरे की शिकायत करने पर कितने पॉइंट मिलते हैं?",
            "पॉइंट्स को पैसों या टैक्स छूट में कैसे बदलें?",
            "रिवॉर्ड कूपन और वाउचर कैसे क्लेम करें?",
            "शिकायत साफ होने पर क्या इनाम मिलता है?",
        ],
        "response_en": "Check your points balance in the Rewards tab. Each verified cleanup awards 50 points redeemable for utility rebates.",
        "response_hi": "आपकी प्रोफाइल में ग्रीन क्रेडिट्स सुरक्षित हैं। 100+ क्रेडिट होने पर आप नगर निगम टैक्स छूट वाउचर क्लेम कर सकते हैं।",
        "response_gu": "તમારું ગ્રીન ક્રેડિટ બેલેન્સ 'Rewards' ટેબમાં દેખાશે. આ ક્રેડિટ્સ દ્વારા મ્યુનિસિપલ ટેક્સમાં રાહત મેળવો.",
        "action": "NAVIGATE_REWARDS"
    },
    {
        "intent": "rewards_inquiry",
        "lang": "gu",
        "phrases": [
            "મારી પાસે કેટલા ગ્રીન ક્રેડિટ પોઈન્ટ છે?",
            "કચરાની ફરિયાદ કરવાથી પોઈન્ટ કેવી રીતે મળે?",
            "રિવોર્ડ વાઉચર અને ટેક્સ રિબેટ કેવી રીતે મેળવવું?",
            "ક્રેડિટ્સ રીડીમ કરવા માટે શું કરવું?",
            "પોઈન્ટ્સ માંથી બસ પાસ કે કૂપન મળે?",
        ],
        "response_en": "You earn 50 credits per verified complaint! Open the Rewards tab to view your balance and redeem gift vouchers.",
        "response_hi": "हर वैध रिपोर्ट पर 50 ग्रीन क्रेडिट्स मिलते हैं, जिन्हें आप रिवॉर्ड्स में रिडीम कर सकते हैं।",
        "response_gu": "તમારી દરેક વેરિફાઈડ ફરિયાદ પર 50 ગ્રીન ક્રેડિટ મળે છે. પ્રોફાઇલ અથવા 'Rewards' ટેબમાં જઈને વાઉચર કલેક્ટ કરો.",
        "action": "NAVIGATE_REWARDS"
    },

    # ------------------------------------------------ 3. EMERGENCY ASSISTANCE
    {
        "intent": "emergency_assistance",
        "lang": "en",
        "phrases": [
            "Dead dog or animal carcass lying in the middle of the road",
            "Urgent medical biohazard syringes dumped near residential area",
            "Toxic chemical spill or flammable hazard on main road",
            "Open overflowing sewer drain causing health emergency",
            "Report high priority biohazard issue for immediate pickup",
        ],
        "response_en": "🚨 Emergency alert logged with 30-minute SLA priority! Ward emergency response team and animal husbandry department have been notified.",
        "response_hi": "🚨 आपातकालीन अलर्ट दर्ज हो गया है (30 मिनट SLA)! स्वास्थ्य एवं स्वच्छता नियंत्रण कक्ष को तुरंत सूचित कर दिया गया है।",
        "response_gu": "🚨 ઇમરજન્સી એલર્ટ નોંધાઈ ગયું છે (30 મિનિટ SLA)! વોર્ડ સેનિટેશન અને કંટ્રોલ રૂમને તાત્કાલિક મોકલવામાં આવ્યા છે.",
        "action": "OPEN_EMERGENCY_REPORT"
    },
    {
        "intent": "emergency_assistance",
        "lang": "hi",
        "phrases": [
            "सड़क पर मरा हुआ जानवर पड़ा है तुरंत उठवाओ",
            "अस्पताल का मेडिकल कचरा और जहरीली दवाएं फेंकी हुई हैं",
            "गटर का गंदा पानी सड़क पर बह रहा है बदबू आ रही है",
            "इमरजेंसी कचरा उठाने के लिए शिकायत कैसे करें?",
            "मरे हुए कुत्ते या गाय को उठाने के लिए हेल्पलाइन नंबर",
        ],
        "response_en": "🚨 Emergency dispatch initiated for immediate sanitary clearance with high priority.",
        "response_hi": "🚨 आपातकालीन शिकायत दर्ज कर ली गई है। विशेष टीम 30 मिनट में स्थल पर पहुँचकर सफाई करेगी।",
        "response_gu": "🚨 ઇમરજન્સી ટીમ રવાના કરવામાં આવી છે. 30 મિનિટમાં યોગ્ય નિકાલ કરવામાં આવશે.",
        "action": "OPEN_EMERGENCY_REPORT"
    },
    {
        "intent": "emergency_assistance",
        "lang": "gu",
        "phrases": [
            "રસ્તા પર મરેલું જાનવર કે કૂતરો પડ્યો છે",
            "હોસ્પિટલનો જોખમી બાયોમેડિકલ કચરો ખુલ્લામાં ફેંક્યો છે",
            "ગટર ઉભરાય છે અને રોગચાળો ફેલાવાની બીક છે",
            "તાત્કાલિક ઇમરજન્સી સફાઈ માટે કોલ કરવો છે",
            "ખૂબ જ ગંદકી અને મરેલા ઢોરના નિકાલ માટે મદદ",
        ],
        "response_en": "🚨 Emergency sanitary response team has been paged with priority clearance SLA.",
        "response_hi": "🚨 आपातकालीन स्वास्थ्य दल को तुरंत भेज दिया गया है।",
        "response_gu": "🚨 ઇમરજન્સી સફાઈ વિનંતી સફળતાપૂર્વક નોંધાઈ ગઈ છે. ખાસ ટીમ તાત્કાલિક નિકાલ કરશે.",
        "action": "OPEN_EMERGENCY_REPORT"
    },

    # ------------------------------------------------ 4. PICKUP SCHEDULE INQUIRY
    {
        "intent": "pickup_schedule_inquiry",
        "lang": "en",
        "phrases": [
            "What time will the garbage collection truck arrive in my ward today?",
            "How can I track the live location of the waste collection van?",
            "Can I book an advance scheduled pickup for a wedding event or society function?",
            "Garbage truck did not come this morning who to contact?",
            "Schedule a bulk furniture and construction waste pickup",
        ],
        "response_en": "Municipal collection vans operate daily between 7:00 AM - 1:00 PM. You can track your assigned vehicle live in the 'Track Truck' tab or book a bulk event pickup 24h in advance.",
        "response_hi": "सफाई वैन सुबह 7:00 से दोपहर 1:00 बजे तक चलती है। आप 'Track Truck' टैब में लाइव लोकेशन देख सकते हैं या अग्रिम पिकअप बुक कर सकते हैं।",
        "response_gu": "કચરા કલેક્શન વાન સવારે 7:00 થી બપોરે 1:00 વાગ્યા સુધી આવે છે. 'Track Truck' ટેબમાં લાઈવ લોકેશન જુઓ અથવા શેડ્યુલ બુક કરો.",
        "action": "OPEN_TRACK_TRUCK"
    },
    {
        "intent": "pickup_schedule_inquiry",
        "lang": "hi",
        "phrases": [
            "आज कचरा गाड़ी कितने बजे आएगी?",
            "कचरा वैन की लाइव लोकेशन कैसे ट्रैक करें?",
            "शादी या बड़े कार्यक्रम के लिए अलग से गाड़ी कैसे बुक करें?",
            "आज हमारे मोहल्ले में कचरा गाड़ी नहीं आई",
            "बड़ा कचरा उठाने के लिए टाइम स्लॉट कैसे बुक करें?",
        ],
        "response_en": "Track the waste collection van live on the map, or book a bulk pickup for your event in the Schedule tab.",
        "response_hi": "सफाई वाहन का लाइव रूट 'Track' टैब में दिखाई दे रहा है। अतिरिक्त कचरे के लिए 'Schedule Pickup' से तारीख चुनें।",
        "response_gu": "કચરા ગાડીનું લાઈવ લોકેશન 'Track Truck' ટેબમાં જુઓ અથવા ઘર માટે 'Schedule Pickup' બુક કરો.",
        "action": "OPEN_TRACK_TRUCK"
    },
    {
        "intent": "pickup_schedule_inquiry",
        "lang": "gu",
        "phrases": [
            "આજે કચરાવાળી ગાડી કેટલા વાગે આવશે?",
            "કચરાની ગાડી લાઈવ ક્યાં પહોંચી તે કેમ જોવું?",
            "સોસાયટીના પ્રસંગ માટે કચરા ગાડી બુક કેવી રીતે કરવી?",
            "આજે સવારે કચરા ગાડી અમારા એરિયામાં નથી આવી",
            "મોટો કચરો ઉપાડવા માટે ગાડી બોલાવવાની રીત",
        ],
        "response_en": "You can view the real-time vehicle GPS in 'Track Truck' or request advance collection in 'Schedule Pickup'.",
        "response_hi": "गाड़ी की लाइव स्थिति ट्रैक करें या 'Schedule' टैब से स्पेशल पिकअप बुक करें।",
        "response_gu": "કચરા વાન સવારે 7 થી 1 વચ્ચે તમારા વોર્ડમાં આવે છે. લાઈવ ટ્રેકિંગ માટે 'Track Truck' જુઓ અથવા એડવાન્સ બુકિંગ કરો.",
        "action": "OPEN_TRACK_TRUCK"
    },

    # ------------------------------------------------ 5. GENERAL FAQ & HELPLINE
    {
        "intent": "general_faq",
        "lang": "en",
        "phrases": [
            "What is the 24/7 sanitation control room helpline phone number?",
            "Where is my municipal ward office located?",
            "How do I file a photo complaint about street garbage?",
            "Who is the sanitary inspector for my ward area?",
            "How does Safaai Sarathi automated AI waste classification work?",
        ],
        "response_en": "Sanitation Control Room: 079-23227900 | Fire: 101 | Emergency: 108. You can file a photo complaint directly by tapping the '+' button on your home screen.",
        "response_hi": "स्वच्छता हेल्पलाइन: 079-23227900 | आपातकालीन: 108. फोटो खींचकर शिकायत दर्ज करने के लिए होम स्क्रीन पर '+' दबाएं।",
        "response_gu": "સેનિટેશન કંટ્રોલ રૂમ: 079-23227900 | ઇમરજન્સી: 108. નવી ફરિયાદ માટે હોમ સ્ક્રીન પર '+' બટન દબાવી ફોટો અપલોડ કરો.",
        "action": "SHOW_HELPLINE"
    },
    {
        "intent": "general_faq",
        "lang": "hi",
        "phrases": [
            "कंट्रोल रूम और नगर निगम का हेल्पलाइन नंबर क्या है?",
            "वार्ड ऑफिसर का संपर्क नंबर कहाँ मिलेगा?",
            "कचरे की फोटो खींचकर रिपोर्ट कैसे भेजें?",
            "सफाई साथी ऐप का इस्तेमाल कैसे करें?",
            "शिकायत की स्थिति कैसे चेक करें?",
        ],
        "response_en": "Helpline: 079-23227900. Tap '+' on home screen to file a complaint with photo and GPS.",
        "response_hi": "सफाई कंट्रोल रूम: 079-23227900। नई शिकायत के लिए होम स्क्रीन पर '+' बटन दबाएं।",
        "response_gu": "મહાનગરપાલિકા હેલ્પલાઇન: 079-23227900. નવી ફરિયાદ માટે '+' બટન વાપરો.",
        "action": "SHOW_HELPLINE"
    },
    {
        "intent": "general_faq",
        "lang": "gu",
        "phrases": [
            "મ્યુનિસિપલ કંટ્રોલ રૂમ અને સફાઈ હેલ્પલાઈન નંબર શું છે?",
            "વોર્ડ ઓફિસ અને સેનિટરી ઇન્સ્પેક્ટરનો નંબર",
            "કચરાનો ફોટો પાડીને ફરિયાદ કઈ રીતે કરવી?",
            "સફાઈ સારથિ એપ્લિકેશન વિશે માહિતી",
            "મારી જૂની ફરિયાદનું સ્ટેટસ કેમ ચેક કરવું?",
        ],
        "response_en": "Control Room: 079-23227900. Check complaints status in 'My Reports' tab.",
        "response_hi": "हेल्पलाइन नंबर: 079-23227900. अपनी शिकायतों की स्थिति 'My Reports' में देखें।",
        "response_gu": "સફાઈ હેલ્પલાઇન નંબર: 079-23227900. ફરિયાદની સ્થિતિ તપાસવા 'My Reports' ટેબ ખોલો.",
        "action": "SHOW_HELPLINE"
    },
]

class SafaaiSahayakNLP:
    """
    Multilingual semantic intent extraction engine for civic inquiries in EN, HI, and GU.
    """

    CONFIDENCE_THRESHOLD = 0.55

    FALLBACK_RESPONSES = {
        "en": "I'm not quite sure I understood that clearly. Could you please rephrase your question about waste sorting, green credits, collection trucks, or emergency sanitation?",
        "hi": "माफ़ कीजिये, मैं आपकी बात पूरी तरह समझ नहीं पाया। कृपया कचरा पृथक्करण, ग्रीन क्रेडिट्स, कचरा गाड़ी या आपातकालीन सफाई के बारे में दोबारा पूछें।",
        "gu": "માફ કરશો, હું તમારી વાત બરાબર સમજી શક્યો નથી. કૃપા કરીને કચરાનું વર્ગીકરણ, ગ્રીન ક્રેડિટ્સ, કચરા ગાડી કે ઇમરજન્સી સફાઈ વિશે ફરીથી પૂછો.",
    }

    def __init__(self):
        self.vectorizer = TfidfVectorizer(
            analyzer="char_wb",
            ngram_range=(2, 5),
            lowercase=True,
            strip_accents=None,
        )
        self._corpus_phrases = []
        self._corpus_intents = []
        self._corpus_langs = []
        self._corpus_entries = []
        self._train_index()

    def _train_index(self):
        """Vectorize the multilingual knowledge base."""
        for entry in INTENT_DATASET:
            for phrase in entry["phrases"]:
                self._corpus_phrases.append(phrase)
                self._corpus_intents.append(entry["intent"])
                self._corpus_langs.append(entry["lang"])
                self._corpus_entries.append(entry)

        self.tfidf_matrix = self.vectorizer.fit_transform(self._corpus_phrases)

    @staticmethod
    def detect_script(text: str) -> str:
        """Heuristic language detection based on Unicode script ranges."""
        # Devanagari (Hindi) range: \u0900-\u097F
        # Gujarati range: \u0A80-\u0AFF
        if re.search(r'[\u0A80-\u0AFF]', text):
            return "gu"
        elif re.search(r'[\u0900-\u097F]', text):
            return "hi"
        return "en"

    def match_intent(self, query: str, forced_lang: Optional[str] = None) -> Dict[str, Any]:
        """
        Extract civic intent and confidence from citizen query.

        :param query: Free-text query string in English, Hindi, or Gujarati
        :param forced_lang: Optional language override ('en', 'hi', 'gu')
        :return: Structured prediction dictionary
        """
        if not query or not query.strip():
            detected_lang = forced_lang or "en"
            return {
                "intent": "none",
                "confidence": 0.0,
                "language": detected_lang,
                "reply": self.FALLBACK_RESPONSES.get(detected_lang, self.FALLBACK_RESPONSES["en"]),
                "matched_sample": None,
                "action": None,
                "is_fallback": True,
            }

        cleaned_query = query.strip()
        detected_lang = forced_lang or self.detect_script(cleaned_query)

        # Compute cosine similarity vector
        query_vec = self.vectorizer.transform([cleaned_query])
        similarities = cosine_similarity(query_vec, self.tfidf_matrix)[0]

        best_idx = int(np.argmax(similarities))
        best_score = float(similarities[best_idx])
        matched_entry = self._corpus_entries[best_idx]
        matched_intent = matched_entry["intent"]
        matched_sample_phrase = self._corpus_phrases[best_idx]

        # Check against strict confidence threshold
        if best_score < self.CONFIDENCE_THRESHOLD:
            return {
                "intent": "uncertain",
                "confidence": round(best_score, 3),
                "language": detected_lang,
                "reply": self.FALLBACK_RESPONSES.get(detected_lang, self.FALLBACK_RESPONSES["en"]),
                "matched_sample": matched_sample_phrase,
                "action": "REQUEST_CLARIFICATION",
                "is_fallback": True,
            }

        # Select localized response
        response_key = f"response_{detected_lang}"
        reply_text = matched_entry.get(response_key, matched_entry["response_en"])

        return {
            "intent": matched_intent,
            "confidence": round(best_score, 3),
            "language": detected_lang,
            "reply": reply_text,
            "matched_sample": matched_sample_phrase,
            "action": matched_entry.get("action", "SHOW_INFO"),
            "is_fallback": False,
        }
