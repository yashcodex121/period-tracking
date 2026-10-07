CHAKRA - Period Tracker & Alarm
================================
Files: index.html (poori app), manifest.json + sw.js + icons (PWA / offline)

Chalane ka tareeka
1) Laptop par: index.html double-click karo (Chrome). Demo ke liye Settings > "Demo data".
2) Phone par: folder ko Netlify / GitHub Pages / Vercel par upload karo (HTTPS zaroori),
   phir Chrome menu > "Add to Home screen".
3) Local test: is folder mein `python3 -m http.server 8000`, phir http://localhost:8000

Features: cycle prediction, calendar, alarms/reminders, BBT chart, pregnancy mode,
PIN lock, doctor report, CSV/JSON export, partner share, demo data.

Note
- Alarm tab tak bajta hai jab app khula ho (ya installed PWA chal raha ho).
  Phone band hone par bhi alarm ke liye native app (Flutter/React Native) chahiye.
- "Claude se pucho" aur Cloud backup sirf claude.ai wale published version mein chalte hain;
  is hosted copy mein ye band rahenge. Baaki sab offline kaam karta hai.
- Ye app sirf andaza deti hai, contraception ya diagnosis ke liye nahi hai.
