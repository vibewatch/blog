---
title: "My Vibe Coding Journey - Developing an AI-Powered English Learning Application"
slug: "my-vibe-coding-journey"
date: "2025-03-25 12:08:50"
updated: "2025-03-25 12:39:19"
type: "post"
status: "published"
visibility: "public"
featured: true
excerpt: ""
feature_image: ""
authors: ["Yingting Huang"]
tags: ["Vibe Coding", "GenAI", "Azure", "GitHub Copilot"]
---
# My Vibe Coding Journey - Developing an AI-Powered English Learning Application

I want to share my story about vibe coding. I started this project to support my son's English learning, and I also wanted to see whether I could rely on generative AI to complete a full project, including both client and server. My goal was twofold: to support his learning and challenge myself to build a robust, interactive web app.

### **Project Objectives**

The application focuses on:

*   Mastering English grammar and language forms
*   Developing reading comprehension skills
*   Improving listening comprehension abilities

Despite having limited web programming experience, I successfully created a comprehensive learning tool. Using [a Next.js project](https://github.com/quentin-mckay/AI-Quiz-Generator/) from GitHub as the foundation, I expanded its functionality with GitHub Copilot and cutting-edge AI technologies.

---

### **Key Features**

The application includes:

*   Integration with Azure OpenAI for content generation
*   Multi-provider OAuth authentication
*   Azure Text-to-Speech (TTS) for listening comprehension audio generation
*   Interactive dictionary hints
*   English language tips
*   PDF exam generation capability

---

### **Lessons Learned**

**Prompt Optimization**  
Crafting effective prompts is crucial. I spent considerable time refining them to ensure they generated accurate content at the appropriate levels (beginner, intermediate, and advanced tests). For listening comprehension, I relied on prompts to produce correct SSML (Speech Synthesis Markup Language). This was necessary to mimic different roles with distinct voices. To achieve this, it is essential to define clear SSML syntax rules in the prompt; otherwise, the generated SSML may be incorrect.

**GitHub Copilot as a Development Partner**  
GitHub Copilot is incredibly powerful—it often understands my intentions and provides accurate suggestions. However, as the developer, you must review and validate its suggestions. Additionally, it's important to use the right AI models for specific tasks. For instance, the GPT-4o model (GPT-4O) can interpret images, allowing you to capture a screenshot and request code to replicate a particular UI style.

**Leveraging Generative AI for Content Creation**  
Generative AI is invaluable for creating content. I used GitHub Copilot to generate all my English language tips, and I used Azure TTS to generate audio feedback (e.g., playing encouraging phrases like "Good work!" upon selecting the correct answer). I also used consumer Copilot services to create images, which I incorporated into my web application.

---

### **Outcome**

The application is now live at [https://toefl.aiazure.net/](https://toefl.aiazure.net/), and here are a few screenshots:

![Test generation form](/assets/posts/my-vibe-coding-journey/test-generation-form.png)

Test generation workflow

![Offline PDF and online dictionary](/assets/posts/my-vibe-coding-journey/offline-pdf-online-dictionary.png)

![TTS subtitles playback](/assets/posts/my-vibe-coding-journey/tts-subtitles-playback.png)
