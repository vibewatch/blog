---
title: "ReAct Agents: Building From Scratch - Native Function Calling vs. Custom TAO Parsing"
slug: "react-agents-building-from-scratch-native-function-calling-vs-custom-tao-parsing"
date: "2025-05-11 10:11:14"
updated: "2025-05-11 10:11:14"
type: "post"
status: "published"
visibility: "public"
featured: false
excerpt: ""
feature_image: "https://images.unsplash.com/photo-1694903110330-cc64b7e1d21d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3wxMTc3M3wwfDF8c2VhcmNofDMxfHxhaSUyMGFnZW50fGVufDB8fHx8MTc0Njk1NjA3M3ww&ixlib=rb-4.1.0&q=80&w=2000"
authors: ["Yingting Huang"]
tags: []
---
## Introduction

In this article, I'll walk you through two different ways to implement ReAct agents without relying on any existing frameworks:

1.  **Native Function Calling**: Tapping into the built-in capabilities of modern LLMs
2.  **Custom TAO Parsing**: A more flexible text-based approach for parsing Thoughts, Actions, and Observations

I've deliberately avoided using frameworks like LangChain or AutoGen – not because they aren't valuable, but because building from scratch offers insights you simply can't get otherwise.

The sample code provided here are minimal working examples, but they should give you a solid foundation to build upon. You could find the full code on my GitHub repository [here](https://github.com/huangyingting/agent-learn/tree/main/from-scratch)

## What is AI Agent?

An AI agent is a system that autonomously performs tasks by interacting with its environment. In AI applications, this often involves leveraging a Large Language Model (LLM) to analyze problems and take actions based on its reasoning.

The agent can utilize various tools to gather information, perform calculations, and interact with APIs. Its key capability lies in adapting its approach based on the outcomes of its actions.

The agent operates through an iterative cycle of generating thoughts, executing actions, and observing results. This process continues until it either reaches a solution, completes its task, or hits a predefined turn limit.

## The ReAct Framework Explained

Most of the agent frameworks use ReAct because it mimics how we naturally solve problems – we think, we do something, we see what happens, and then we think again.

At its core, the ReAct framework is deceptively simple yet incredibly powerful. It creates a loop of:

*   **Reasoning**: The model thinks through problems step by step (like we humans do!)
*   **Acting**: It takes concrete actions by using tools to gather information
*   **Observation**: It processes the results and adjusts its approach accordingly

## Why Build From Scratch?

You might be wondering, "Why reinvent the wheel when there are established frameworks?" Great question! After using several popular agent frameworks, I found myself wanting to understand what's happening under the hood. Building from scratch has given me:

*   Complete transparency into every component
*   A deeper appreciation for the design decisions in existing frameworks
*   The flexibility to customize everything to my specific needs
*   Freedom from dependency headaches and version conflicts

Plus, there's something deeply satisfying about creating something from the ground up that works exactly how you want it to!

## Approach #1: Native Function Calling

Modern LLMs like GPT-40, Claude, and Gemini have a neat built-in capability: they can generate structured function calls. This makes creating agents surprisingly straightforward.

### How It Works

When using native function calling, the process feels almost magical:

1.  Tools are defined as Python functions with clear docstrings
2.  These are converted into a standardized schema that is understood by the LLM
3.  When and how to use these tools is decided by the model, with parameters being correctly formatted
4.  The functions are executed by the code and results are fed back to the model

The beauty of this approach is that most of the heavy lifting is handled by the LLM. Which function to call is determined by the model and the arguments are appropriately formatted – no parsing is required by the developer!

### A Practical Example

Here's a glimpse of what this looks like in practice:

```python
def web_search(query: str) -> str:
  """Search the web for information using DuckDuckGo.
  
  Args:
      query: A string containing the search query to look up online
      
  Returns:
      A string containing the top search results
  """
    # Implementation here
    
# The LLM can then call this with proper parameters
# without me having to parse text to figure out what it wants to do
```

The model naturally formats its request to call this function with the correct parameters, making integration smooth and reliable.

## Approach #2: Custom TAO parsing

While native function calling is convenient, sometimes you need more control or are working with models that don't support this feature. That's where custom TAO parsing comes in.

### How It Works

The TAO parsing is more hands-on but offers incredible flexibility:

1.  A detailed prompt is crafted to instruct the LLM to format its thoughts and actions in a specific way
2.  Structured information is extracted from the model's text output using regex patterns
3.  The conversation context is carefully managed to maintain coherence across multiple turns
4.  The model's reasoning is explicitly captured in natural language

What makes this approach compelling is how visible the model's thinking process becomes. The problem-solving steps can be observed in detail as they unfold!

### The Secret Sauce: Structured Prompting

The key to making this work is a clear, structured prompt that looks something like:

```
Thought: My previous attempts to search for Bill Gates' birthplace and date of birth failed. However, I know from general knowledge that Bill Gates is the founder of Microsoft. I will try searching again for his birthplace and date of birth to ensure accuracy, then calculate his current age.
Action: web_search
Action Input: Bill Gates birthplace and date of birth
```

These components are then extracted by the regex parsing and handled appropriately. More work is required up front, but the control that is provided is well worth it.

## Choosing the Right Approach

After building both implementations, here's my practical advice:

**Go with Native Function Calling when:**

*   You're working with the latest commercial models
*   You need to move quickly and minimize custom code
*   Your tools have complex parameter structures
*   You want built-in parameter validation

**Choose the Custom TAO Parser when:**

*   You need to work with a variety of different models
*   You want maximum control over the format
*   Explicitly seeing the model's reasoning is important
*   You're building something that needs to be model-agnostic

## Conclusion

Building AI agents may seem daunting at first, but it doesn’t have to be complex. Once you grasp the core principles, you can develop powerful agents with minimal code. Many developers feel overwhelmed by intricate frameworks and extensive documentation, yet beneath these layers lies a fundamentally straightforward process.

I hope sharing my experience helps you on your own journey building AI agents. Feel free to reach out with questions or share your own experiences with these approaches!
