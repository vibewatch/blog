---
title: "Building an English Dictionary with LLM"
slug: "building-an-english-dictionary-with-llm"
date: "2025-03-29 03:10:17"
updated: "2025-03-29 11:11:07"
type: "post"
status: "published"
visibility: "public"
featured: false
excerpt: ""
feature_image: "https://images.unsplash.com/photo-1524639064490-254e0a1db723?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3wxMTc3M3wwfDF8c2VhcmNofDR8fGRpY3Rpb25hcnl8ZW58MHx8fHwxNzQzMjE3Nzg5fDA&ixlib=rb-4.0.3&q=80&w=2000"
authors: ["Yingting Huang"]
tags: []
---
In my [previous blog](/my-vibe-coding-journey/), I mentioned about online dictionary feature from my English learning app. Today, I'll share the implementation details and how I overcame several challenges using Large Language Models (LLMs).

## The Challenge

The requirement was straightforward: when a user selects a word in a passage and clicks "explain," the app should display the word's meaning. However, after exploring several dictionary solutions, I discovered that they had some drawbacks:

*   No official APIs from major providers like Google Dictionary
*   Paid services that would incur ongoing costs
*   Free services with rate limiting

I also explored open-source dictionaries like [OPTED](https://www.mso.anu.edu.au/~ralph/OPTED/), but discovered it was based on the 1913 Webster's Dictionary, making it outdated for modern vocabulary (words like "astronaut" weren't included).

## The LLM Approach

I decided to leverage LLMs to generate my English to English dictionary for several reasons in below:

1.  LLMs are trained on massive text corpora containing word meanings
2.  I could extract these definitions efficiently in a one-time process
3.  Once generated, I'd have a permanent dictionary without recurring costs

## Implementation Details

The ovall process begins with a list of common English words. For each word, an LLM is used to generate its meanings.

### Step 1: Finding a Common English Word List

I obtained a comprehensive list of common English words from the internet (Common-Words.txt).

### Step 2: Creating the Dictionary Generator

With GitHub Copilot's assistance, I developed code to:

*   Process each word in the list
*   Generate definitions categorized by parts of speech (noun, verb, adjective, etc.)
*   Format the output as JSON, with each word as a key and definitions grouped by part of speech

The prompt that I used is very simple

```
For each word in the provided list, generate definitions categorized by their respective parts of speech abbreviations (n., v., a., etc.). 
Format the output as JSON, with each word as a key and definitions grouped by part of speech.

WORDS: {words_str}
```

### Step 3: Optimizing for Cost and Performance

To minimize costs while processing thousands of words, I implemented several optimizations:

*   **Self-hosted LLM:** The cost of using the OpenAI API to generate a dictionary varies depending on the model, ranging from $5 to $50 for creating a 20MB dictionary. However, this approach carries the risk of request rate limiting. Therefore, I opted for a self-hosted LLM, which offers greater flexibility in selecting models. For instance, **Phi-4** for creating English-to-English dictionaries. **Qwen-2.5** for English-to-Chinese dictionaries.
*   **Spot VMs**: Leveraged discounted cloud instances for the generation task
*   **vLLM**: Used the vLLM to accelerate batch processing
*   **Concurrency**: Set up concurrent LLM requests to efficiently utilize the batch processing capabilities. From an A100 (80GB) VM(NC24ads), I was able to achieve ~500 tokens/s result with a batch size of 16.

![vLLM batch throughput](/assets/posts/building-an-english-dictionary-with-llm/vllm-throughput.png)

## The Result

Here is the final result for my online dictionary

![Online dictionary result](/assets/posts/building-an-english-dictionary-with-llm/online-dictionary-result.png)

This approach provided several advantages:

1.  **Completeness**: It now covers ~80,000 commonly used English words
2.  **One-time cost**: No ongoing API fees
3.  **No rate limits**: The dictionary is stored locally in my app
4.  **Control**: I could format the definitions exactly as needed for my UI

## Postprocess

To maintain the highest quality standards for my English dictionary, I implement a post-processing workflow for the dictionary file:

1.  Normalizing all Unicode characters throughout the file
2.  Converting all English words to lowercase for consistency
3.  Eliminating all words with empty definitions
4.  Removing problematic words containing whitespace, underscores, or hyphens
5.  Filtering out words that don't appear in the Common-Words.txt reference list (using case-insensitive matching)
6.  Consolidating any duplicate words to ensure each entry is unique

This cleaning process ensures the dictionary remains error-free and optimally structured for reliable performance.

## Conclusion

By leveraging LLMs to generate a dictionary, I created a cost-effective solution that provides high-quality definitions without the limitations of existing APIs. The initial investment in processing time and computing resources yielded a permanent asset for my English learning app.

This approach showcases how LLMs can serve as effective tools for creating a comprehensive and practical English dictionary.
