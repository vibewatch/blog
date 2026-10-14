---
title: "GitHub Copilot Model Token Speed Benchmark: Decomposing Latency, Verbosity, and Throughput Across 28 Hosted Models"
slug: "github-copilot-model-token-speed-benchmark"
date: "2026-10-14 13:00:00"
updated: "2026-10-14 13:00:00"
type: "post"
status: "published"
visibility: "public"
featured: true
excerpt: "An empirical analysis of 280 sequential benchmark runs across 28 GitHub Copilot-hosted models and 10 scenarios — separating the 8–14s first-token prefill floor from true marginal token streaming speed, verbosity bias, reasoning effort overhead, and polyglot coding performance."
feature_image: ""
authors: ["Yingting Huang"]
tags: ["GitHub Copilot", "LLM Benchmark", "Token Speed", "Model Inference", "AI Coding"]
---
# GitHub Copilot Model Token Speed Benchmark: Decomposing Latency, Verbosity, and Throughput Across 28 Hosted Models

With GitHub Copilot now hosting more than two dozen foundation models from Anthropic, OpenAI, Google, xAI, and Microsoft behind a unified gateway, how fast is each hosted model in practice — and why does a model with a higher `tok/s` rating sometimes take twice as long to finish a coding task as a model ranked ten places below it?

To answer that with real telemetry rather than vendor spec sheets, I ran an end-to-end benchmark across **28 GitHub Copilot-hosted models** and **10 scenarios** (`280` sequential runs total, with `276/280` succeeding). The suite spans six model families hosted by GitHub Copilot as of October 2026:

- **Anthropic Claude (8 models):** `claude-haiku-4.5`, `claude-haiku-5.5`, `claude-sonnet-5`, `claude-sonnet-5.5`, `claude-opus-4.8`, `claude-opus-5`, `claude-opus-5.5`, and `claude-fable-5`.
- **OpenAI GPT-5 & GPT-6 (12 models):** `gpt-5-mini`, `gpt-5.3-codex`, `gpt-5.4`, `gpt-5.4-mini`, `gpt-5.5`, `gpt-5.6-luna`, `gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-6-astra`, `gpt-6-luna`, `gpt-6-sol`, and `gpt-6.1-sol`.
- **Google Gemini (3 models):** `gemini-3.7-flash`, `gemini-3.8-flash`, and `gemini-4-argon`.
- **xAI Grok (3 models):** `grok-4.5`, `grok-4.6`, and `grok-4.7`.
- **Microsoft MAI (1 model):** `mai-code-1.1-flash`.
- **Copilot Dynamic Router (1 target):** `auto`.

Look at a standard one-dimensional bar chart of `tok/s` and you will walk away with only half the story. In an end-to-end request against a Copilot-hosted model, **observed token speed is a composite ratio governed by three coupled forces**: a fixed 7.7–13.7 second gateway + prefill latency floor, the post-prefill streaming velocity of the model backend, and the model's output verbosity. Once you separate those three dimensions using phase-space contours, bipartite slopegraphs, and marginal latency decomposition, the benchmark tells a much sharper engineering story.

---

## 1. Measurement Methodology & The End-to-End Throughput Equation

To probe every Copilot-hosted model through the exact same client path, each cell in the benchmark executes a fresh one-shot request (`copilot -p "<scenario_prompt>" --model <M> -s`) and measures the full request lifecycle:

1. **Wall-clock time (`T_total`):** Total elapsed seconds from request initiation to completion.
2. **Estimated output tokens (`N_tok`):** Approximated as `chars / 4`.

The reported end-to-end throughput (`R_E2E`) is therefore:

```text
R_E2E = N_tok / T_total
      = N_tok / (T_floor + T_think + N_tok / v_stream)
```

where:

- **`T_floor`** is the fixed per-request latency floor: client initialization, Copilot gateway authentication, system-prompt prefill, model routing, and time to first token (`TTFT`).
- **`T_think`** is the unprinted reasoning time (for reasoning models that generate hidden chain-of-thought tokens before emitting visible text).
- **`v_stream`** is the true marginal token decoding speed once visible tokens begin streaming.

This single equation explains three counterintuitive phenomena that show up across the 280 runs:

1. **Short answers are 100% latency-bound:** When `N_tok = 1` (the 1-word scenario), `R_E2E ≈ 1 / T_floor`, compressing every model into `0.07–0.13 tok/s`.
2. **Verbosity inflates end-to-end `tok/s`:** Because `T_floor` is a fixed ~8–10 second overhead paid once per request, a model that writes `1,600` tokens of heavily commented code amortizes `T_floor` over a much larger numerator than a terse model that solves the same problem in `450` tokens.
3. **Hidden thinking tokens depress visible `tok/s`:** On logic puzzles, models spend wall-clock time generating internal reasoning tokens that are never returned in the final text, making `N_tok / T_total` drop to `1–8 tok/s`.

---

## 2. The Speed–Verbosity Phase Space: Why High `tok/s` Does Not Always Mean Fast Code

A conventional horizontal bar chart ranks `claude-opus-5` (`49.3 tok/s`) fourth overall on coding tasks — far ahead of `gpt-5.6-luna` (`34.3 tok/s`, ranked 18th) and `gpt-6-luna` (`35.7 tok/s`, ranked 16th). Yet if you wait for those six coding tasks to finish, `gpt-5.6-luna` completes in **13.42 seconds** on average, whereas `claude-opus-5` takes **32.19 seconds** — the slowest wall-clock coding time of all 28 hosted models.

Instead of a single bar chart, plotting **Mean Coding Wall-Clock Time (`T`)** on the horizontal axis against **Mean Coding Throughput (`R_E2E`)** on the vertical axis maps every model into a 2D **Speed–Verbosity Phase Space**. Because `N_tok ≈ R_E2E × T`, curves of constant token output form **diagonal iso-token contours** across the chart, while bubble area encodes mean output token volume.

![Iso-Token Phase Space: Mean Coding Throughput vs. Wall-Clock Completion Time Across 28 Hosted Models](/assets/posts/github-copilot-model-token-speed-benchmark/speed-verbosity-phase-space.svg)

Splitting the phase space at the benchmark medians (`17.0s` wall-clock time and `40.0 tok/s` throughput) divides the 28 models into four distinct operational quadrants:

### Quadrant I: The Pareto Sprinters (`<17s` wall time, `>40 tok/s`)

These seven models deliver both rapid wall-clock completion and high token generation velocity:

| Model | Coding Avg Throughput (`tok/s`) | Coding Mean Wall Time (`s`) | Coding Mean Output (`tok`) | Long Prose Throughput (`tok/s`) | Operational Profile |
| :--- | ---: | ---: | ---: | ---: | :--- |
| **`claude-haiku-5.5`** | **63.6** | **11.49** | 744 | 62.49 | **Overall Pareto leader:** fastest wall-clock coding time and highest coding `tok/s` |
| **`claude-sonnet-5.5`** | **54.7** | **13.75** | 761 | 56.67 | Frontier-grade code quality at near-Haiku wall-clock latency |
| **`gpt-5.4-mini`** | **51.6** | **13.75** | 705 | 68.65 | Tied for 3rd-fastest wall-clock coding time (`13.75s`) with 300+ tok/s burst decode |
| **`gpt-5.6-terra`** | **49.1** | **12.58** | 634 | 49.03 | **2nd-fastest wall-clock coder (`12.58s`);** rock-steady `49.1 tok/s` across prose and code |
| **`claude-sonnet-5`** | **45.0** | **16.35** | 747 | 45.33 | Balanced mid-tier throughput across both prose and code |
| **`gemini-4-argon`** | **43.5** | **16.22** | 723 | 53.46 | Fastest Google model across both coding (`43.5 tok/s`) and prose (`53.46 tok/s`) |
| **`mai-code-1.1-flash`** | **42.2** | **16.57** | 667 | **69.42** | #1 in long prose (`12.14s`), dragged to `16.57s` coding mean by a `30.45s` Rust run |

Together, **`claude-haiku-5.5`**, **`gpt-5.6-terra`**, and **`gpt-5.6-luna`** define the empirical **Pareto frontier**: no other model in the 28-model pool finishes faster in wall-clock time while achieving higher throughput.

### Quadrant II: The Verbose Heavyweights (`>20s` wall time, `>40 tok/s`)

- **`claude-opus-5` (`49.3 tok/s`, `32.19s` mean time, `1,634` mean tokens):** Emits **2.2× to 3.5× more tokens** per coding prompt than the rest of the field (`1,782` tokens in Python, `1,623` in JavaScript, `2,701` in Rust). Because its `8.02s` startup floor is amortized across `1,634` tokens, its end-to-end `tok/s` looks deceptively fast (`49.3 tok/s`) even though a user waits half a minute per response.
- **`claude-opus-5.5` (`49.2 tok/s`, `20.44s` mean time, `1,015` mean tokens):** A major generational improvement over Opus 5 — it preserves the exact same `49.2 tok/s` throughput while reigning in verbosity by **38%**, shaving **11.75 seconds** off average coding wait time.
- **`gpt-5-mini` (`41.8 tok/s`, `21.37s` mean time, `856` mean tokens):** High token volume keeps its `tok/s` above `41`, but long wall-clock runs in JavaScript (`26.09s`) and Rust (`32.54s`) push it into the slower half of the chart.

### Quadrant III: The Terse Finishers (`13.4s–16.9s` wall time, `<40 tok/s`)

Models in the bottom-left quadrant are **much faster in practice than their `tok/s` ranking implies**:

- **`gpt-5.6-luna` (`13.42s`, `476` tok, `34.3 tok/s`)** and **`gpt-6-luna` (`13.96s`, `512` tok, `35.7 tok/s`)** finish coding tasks faster than 24 of the 28 models tested.
- **`gpt-6-sol` (`14.34s`, `481` tok, `32.8 tok/s`)**, **`gpt-5.6-sol` (`14.90s`, `561` tok, `36.7 tok/s`)**, and **`auto` (`15.27s`, `466` tok, `29.7 tok/s`)** all complete average coding tasks in under `15.5` seconds.
- Their `tok/s` numbers look modest only because they emit compact, minimal-prose code blocks (`466–561` tokens) where the ~9–14s initial prefill floor accounts for **60% to 75% of total wall-clock time**.

### Quadrant IV: Latency Drag (`>18s` wall time, `<39 tok/s`)

In the bottom-right quadrant, models suffer from genuine generation latency without compensating verbosity: **`gpt-6-astra`** (`23.27s`, `26.3 tok/s`), **`gpt-6.1-sol`** (`21.44s`, `27.3 tok/s`), **`grok-4.6`** (`19.09s`, `24.8 tok/s`), **`claude-haiku-4.5`** (`25.41s`, `31.4 tok/s`), and **`gemini-3.8-flash`** (`24.69s`, `30.8 tok/s`, heavily skewed by `34.35s` in Go and `51.36s` in Rust).

---

## 3. Decomposing the First-Token Floor, Marginal Streaming Speed, and Reasoning Effort

How much of a request to a Copilot-hosted model is spent waiting for gateway routing and prompt prefill versus actually streaming tokens? Because the benchmark includes both a **1-word scenario (`short`, `N_tok = 1`)** and a **500-word prose scenario (`long`, `N_tok` between `655` and `1,035`)** at default reasoning effort, we can use `T_short` as an empirical proxy for the fixed first-token floor (`T_floor`) and isolate the **net streaming window**:

```text
ΔT_stream  = T_long - T_short
v_marginal = (N_long - 1) / (T_long - T_short)
```

The three-panel telemetry chart below pairs this two-stage wall-clock split (**Panel A**) with the implied post-prefill streaming velocity (**Panel B**) and the logic-puzzle reasoning effort barbell (**Panel C**).

![Three-Panel Telemetry Decomposition: 1-Word Baseline Floor, Implied Marginal Decode Speed, and Reasoning Effort Latency Delta](/assets/posts/github-copilot-model-token-speed-benchmark/model-latency-decomposition.svg)

### A. The 7.67s–13.72s Gateway & Prefill Floor

Across all 28 hosted models, generating a single one-word response (`1 token`) never takes less than **7.67 seconds** — and the baseline floor clusters tightly by provider backend:

1. **Anthropic Claude 5 / 5.5 tier (`7.67s – 8.13s`):** `claude-sonnet-5.5` (`7.67s`), `claude-sonnet-5` (`7.69s`), `claude-haiku-5.5` (`7.76s`), `claude-opus-5.5` (`7.76s`), `claude-haiku-4.5` (`7.98s`), `claude-opus-5` (`8.02s`), and `claude-opus-4.8` (`8.13s`) have the lowest first-token floor among all Copilot-hosted endpoints (`claude-fable-5` is the lone exception at `9.56s`).
2. **Google Gemini tier (`8.59s – 9.23s`):** `gemini-3.7-flash` (`8.59s`), `gemini-3.8-flash` (`8.77s`), and `gemini-4-argon` (`9.23s`).
3. **OpenAI GPT-5 / GPT-6 & Microsoft MAI tier (`9.03s – 10.02s`):** Nearly every GPT model lands in a narrow `9.03s–9.49s` band (`gpt-6-luna` and `gpt-6.1-sol` at `9.03s`, `mai-code-1.1-flash` at `9.17s`, `gpt-5-mini` at `10.01s`, `gpt-6-astra` at `10.02s`).
4. **Copilot `auto` router (`13.72s`):** Targeting `auto` adds **4.5 to 6.0 seconds of routing overhead** on a one-word prompt compared to specifying a concrete model ID.

### B. Burst Streaming: 280–350 tok/s Behind the Prefill Curtain

Once `T_short` is subtracted from `T_long`, the marginal time required to stream ~840 tokens of prose reveals a dramatic separation between ultra-fast flash/mini decoders and standard frontier decoders:

- **`auto` (`13.72s` floor + `2.30s` net window for `804` tokens → `~350 tok/s` marginal):** Despite having the slowest 1-word floor (`13.72s`), `auto` completes an 804-token essay in `16.02s` total — meaning that once the router selects a backend for the prose prompt, the underlying model streams 803 tokens in just **2.30 seconds**.
- **`gpt-5.4-mini` (`9.49s` floor + `2.76s` net window for `841` tokens → `~305 tok/s` marginal):** Generates 840 additional tokens in `2.76s`, achieving `68.65 tok/s` end-to-end.
- **`mai-code-1.1-flash` (`9.17s` floor + `2.97s` net window for `843` tokens → `~284 tok/s` marginal):** Finishes the 500-word generation in **12.14 seconds** (`69.42 tok/s` end-to-end, #1 overall).
- **Next-tier fast streamers (`100–140 tok/s` marginal):** `claude-haiku-5.5` (`138 tok/s` marginal, `6.40s` net window), `gpt-5.6-luna` (`137 tok/s` marginal, `6.15s` net window), `gpt-5-mini` (`120 tok/s` marginal), `gemini-4-argon` (`114 tok/s` marginal), `claude-haiku-4.5` (`106 tok/s` marginal), `gpt-6-luna` (`102 tok/s` marginal), and `claude-sonnet-5.5` (`99 tok/s` marginal).

### C. Reasoning Effort (`low` vs. `high`) and the 4 Failed Runs

Scenarios 3 and 4 run a logic puzzle with explicit reasoning effort configuration (`low` vs. `high`). Three findings stand out in **Panel C**:

1. **Four runs failed due to unsupported reasoning-effort configuration:** Both `auto` and `claude-haiku-4.5` rejected the configuration on `reason_low` and `reason_high` with:
   ```text
   Error: Model "auto" does not support reasoning effort configuration (requested: "low" / "high").
   Error: Model "claude-haiku-4.5" does not support reasoning effort configuration (requested: "low" / "high").
   ```
   If your harness or agent configuration passes reasoning-effort parameters globally, targeting `auto` or `claude-haiku-4.5` will hard-fail the request.
2. **Hidden thinking tokens make visible `tok/s` look tiny (`0.94–7.96 tok/s`):** Visible answers on the logic puzzle are only `10 to 80 tokens` long, so total time reflects internal reasoning rather than output serialization.
3. **Divergent sensitivity to `high` vs. `low` effort:**
   - **High thinking expansion:** `gpt-5-mini` jumps from `11.13s` (`low`) to `17.57s` (`high`) (`+6.44s`), `gemini-3.7-flash` rises `+3.58s` (`9.32s → 12.90s`), `gemini-3.8-flash` rises `+3.14s` (`9.01s → 12.15s`), and `gpt-6-astra` rises `+2.63s` (`11.02s → 13.65s`).
   - **Reasoning invariance on trivial logic:** Anthropic's `claude-sonnet-5.5` (`8.46s → 8.25s`), `claude-opus-5.5` (`8.55s → 8.39s`), `claude-sonnet-5` (`8.50s → 7.95s`), and `claude-opus-4.8` (`8.77s → 8.70s`) solve the puzzle in ~8.0–8.8s regardless of effort setting.

---

## 4. Regime Shift: Unconstrained Prose vs. Polyglot Code Generation

Does a model that tops the leaderboard on a 500-word essay stay on top when writing Python, JavaScript, Go, Java, C++, and Rust?

The bipartite **Regime-Transition Slopegraph** below connects each model's rank and throughput on **Long Prose (`~500 words`)** (left axis) to its **6-Language Coding Average** (right axis).

![Bipartite Slopegraph: Ranking and Throughput Shifts from 500-Word Prose Generation to 6-Language Coding](/assets/posts/github-copilot-model-token-speed-benchmark/prose-vs-code-slopegraph.svg)

The slope trajectories expose a sharp bifurcation between **Code Accelerators** (green upward slopes) and **Prose-to-Code Decelerators** (red downward slopes):

- **Anthropic's Claude 5 / 5.5 family dominates the upward slopes:**
  - `claude-opus-5` surges **+16 ranks** (`#20` in prose at `37.62 tok/s` → `#4` in code at `49.3 tok/s`, `+11.7 tok/s`), propelled by its `1,634`-token average code output.
  - `claude-opus-5.5` climbs **+10 ranks** (`#15` at `44.31 tok/s` → `#5` at `49.2 tok/s`, `+4.9 tok/s`).
  - `claude-opus-4.8` climbs **+9 ranks** (`#21 → #12`, `+2.2 tok/s`), `claude-fable-5` climbs **+8 ranks** (`#25 → #17`, `+1.5 tok/s`), `claude-sonnet-5` climbs **+7 ranks** (`#14 → #7`), and `claude-haiku-5.5` rises **+2 ranks** (`#3 → #1` at `63.6 tok/s`).
- **Flash/Mini prose leaders drop when code outputs contract or hit language outliers:**
  - `mai-code-1.1-flash` drops from `#1` (`69.42 tok/s`) to `#9` (`42.2 tok/s`, `-27.2 tok/s`), primarily because its Go (`26.96 tok/s`) and Rust (`33.30 tok/s`, `30.45s`) runs run slower than its prose burst.
  - `claude-haiku-4.5` falls **19 ranks** (`#4` at `58.39 tok/s` → `#23` at `31.4 tok/s`, `-27.0 tok/s`) as its wall-clock time stretches to `23–32s` across every programming language.
  - `auto` drops **16 ranks** (`#9` at `50.17 tok/s` → `#25` at `29.7 tok/s`, `-20.5 tok/s`) because its coding outputs average only `466 tokens` against its heavy router startup floor.
  - `gpt-5.6-luna` drops **12 ranks** (`#6` at `54.55 tok/s` → `#18` at `34.3 tok/s`, `-20.3 tok/s`), despite finishing code in `13.42s` on average, because its C++ response was only `37` tokens (`2.88 tok/s`).

---

## 5. Polyglot Fingerprint: 28 Models × 10 Scenarios and Three Empirical Anomalies

To inspect every run without losing granularity to averages, the **Polyglot Fingerprint Matrix** below encodes all `280` cells simultaneously — pairing top column distribution summaries (`μ` throughput and token volume) with per-cell `tok/s` color intensity and `(token count)` annotations.

![Polyglot Fingerprint Matrix: Complete 28-Model by 10-Scenario Throughput, Token Volume, and Anomaly Heatmap](/assets/posts/github-copilot-model-token-speed-benchmark/polyglot-fingerprint-matrix.svg)

Aggregating across all 28 models by programming language reveals why language choice alone can swing your measured `tok/s` by **more than 60%**:

| Coding Scenario | Field Mean Throughput (`tok/s`) | Field Mean Wall Time (`s`) | Field Mean Output (`tok`) | Fastest Throughput Cell (`tok/s`) | Fastest Wall-Clock Cell (`s`) | Slowest Wall-Clock Cell (`s`) |
| :--- | ---: | ---: | ---: | :--- | :--- | :--- |
| **Code: Python** | 40.86 | 16.42 | 674 | `gpt-5.6-terra` (`58.29`) | `claude-haiku-5.5` (`10.19s`) | `claude-opus-5` (`32.88s`) |
| **Code: JavaScript** | 34.49 | 16.09 | 557 | `claude-haiku-5.5` (`62.96`) | `gpt-5.6-terra` (`11.04s`) | `claude-opus-5` (`32.61s`) |
| **Code: Go** | 31.37 | 16.61 | 498 | `claude-haiku-5.5` (`54.52`) | `claude-haiku-5.5` (`11.54s`) | `gemini-3.8-flash` (`34.35s`) |
| **Code: Java** | **50.61** | 16.38 | 813 | `claude-haiku-5.5` (`73.75`) | `claude-haiku-5.5` (`11.13s`) | `claude-opus-5` (`29.33s`) |
| **Code: C++** | 29.96 | 16.50 | 501 | `claude-haiku-5.5` (`55.61`) | `claude-haiku-5.5` (`11.20s`) | `claude-opus-5` (`29.39s`) |
| **Code: Rust** | 45.95 | **25.83** | **1,105** | **`claude-haiku-5.5` (`91.11`)** | `claude-haiku-5.5` (`13.56s`) | `gemini-3.8-flash` (`51.36s`) |

### Which Hosted Model Should You Use for Each Programming Language?

Because token density and completion behavior vary sharply across ecosystems, the matrix points to clear per-language model choices rather than a single one-size-fits-all default:

- **Python:** Use **`gpt-5.6-terra`** (`58.29 tok/s`, `13.55s`) or **`claude-sonnet-5.5`** (`56.19 tok/s`, `13.22s`) when you want complete, idiomatic implementations at top throughput, or **`claude-haiku-5.5`** (`10.19s`) and **`mai-code-1.1-flash`** (`11.15s`) for the fastest sub-12-second turnaround.
- **JavaScript / TypeScript:** Pick **`claude-haiku-5.5`** (`62.96 tok/s`, `11.31s`) or **`gpt-5.4-mini`** (`56.27 tok/s`, `11.37s`) for rapid front-end and Node.js iteration, with **`gpt-5.6-terra`** (`11.04s`) and **`claude-sonnet-5.5`** (`48.95 tok/s`, `13.18s`) as strong alternatives.
- **Go:** Stick to **`claude-haiku-5.5`** (`54.52 tok/s`, `11.54s`) or **`gpt-5.4-mini`** (`51.15 tok/s`, `11.59s`) — the only two models that break `50 tok/s` and finish under `12` seconds in Go — or **`gpt-5.6-luna`** (`43.57 tok/s`, `13.52s`); avoid `gemini-3.8-flash`, which stalls to `34.35s` (`16.01 tok/s`).
- **Java:** Choose **`claude-haiku-5.5`** (`73.75 tok/s`, `11.13s`), **`mai-code-1.1-flash`** (`66.68 tok/s`, `13.81s`), or **`claude-sonnet-5.5`** (`63.70 tok/s`, `13.28s`), all of which stream through Java's heavy class and type scaffolding at `63–74 tok/s` without wall-clock drag.
- **C++:** Prefer **`claude-haiku-5.5`** (`55.61 tok/s`, `11.20s`), **`claude-sonnet-5.5`** (`53.24 tok/s`, `13.49s`), **`claude-opus-5.5`** (`53.20 tok/s`, `17.76s`), or **`gpt-5.4-mini`** (`49.07 tok/s`, `11.25s`), and avoid `gpt-5.3-codex`, `gpt-5.4`, `gpt-5.5`, and `gpt-5.6-luna` on terse C++ prompts where they emitted truncated `27–37` token responses.
- **Rust:** Default to **`claude-haiku-5.5`** (`91.11 tok/s`, `13.56s`), **`gpt-5.6-terra`** (`74.55 tok/s`, `14.49s`), or **`claude-sonnet-5.5`** (`68.06 tok/s`, `16.60s`); Rust's `1,105`-token average output punishes slower or overly verbose models like `gemini-3.8-flash` (`51.36s`), `claude-opus-5` (`48.67s`), and `claude-opus-5.5` (`36.27s`).

Three structural anomalies stand out across the matrix:

### Anomaly 1: The Java vs. Go/JS Token-Density Illusion (`16.4s` for Both, `50.6` vs. `31.4 tok/s`)

Look closely at the first five programming languages (Python, JavaScript, Go, Java, and C++). Their field-wide mean wall-clock completion times are virtually identical: **`16.42s`, `16.09s`, `16.61s`, `16.38s`, and `16.50s`** — a spread of just `0.52` seconds!

Yet Java's mean throughput is **`50.61 tok/s`** while Go's is **`31.37 tok/s`**. Because Java syntax involves longer class/type identifiers and ceremony (`813` average estimated tokens vs. Go's `498` tokens), and because post-prefill streaming happens at `100–300 tok/s`, generating an extra `315` tokens of Java boilerplate adds less than two seconds of decode time while boosting `est_tokens / total_time` by **+61%**.

### Anomaly 2: The C++ Terse-Output Collapse on Four GPT-5 Models

In the `Code: C++` column, four strong OpenAI models suddenly drop to red single-digit `tok/s` cells:

- **`gpt-5.3-codex`:** `27` tokens in `15.13s` → `1.78 tok/s` (vs. `35–58 tok/s` in the other 5 languages)
- **`gpt-5.4`:** `32` tokens in `15.24s` → `2.10 tok/s` (vs. `31–56 tok/s` in the other 5 languages)
- **`gpt-5.5`:** `32` tokens in `13.58s` → `2.36 tok/s` (vs. `34–63 tok/s` in the other 5 languages)
- **`gpt-5.6-luna`:** `37` tokens in `12.83s` → `2.88 tok/s` (vs. `32–55 tok/s` in the other 5 languages)

These models did not stall on C++ — their wall-clock times (`12.83s–15.24s`) were actually faster than the `16.50s` field average. Instead, they returned a bare ~110–150 character response (`27–37` estimated tokens) without surrounding prose or full boilerplate. Because a single-run average across 6 languages weights each language equally, that one 30-token C++ cell drags their reported 6-language coding average down by **6.5 to 8.0 tok/s**:

| Model | Reported 6-Lang Coding Avg (`tok/s`) | 5-Lang Coding Avg Excl. C++ Outlier (`tok/s`) | C++ Tokens (`chars/4`) | C++ Wall Time (`s`) |
| :--- | ---: | ---: | ---: | ---: |
| **`gpt-5.3-codex`** | 39.4 | **46.98** | 27 | 15.13 |
| **`gpt-5.4`** | 37.7 | **44.84** | 32 | 15.24 |
| **`gpt-5.5`** | 37.7 | **44.71** | 32 | 13.58 |
| **`gpt-5.6-luna`** | 34.3 | **40.56** | 37 | 12.83 |

### Anomaly 3: The Rust Token Explosion (`1,105` Avg Tokens, `91.11 tok/s` Peak)

Rust is the only language where every model family generates substantially more text (`1,105` tokens on average — more than double Go's `498` and C++'s `501` tokens) and takes **`25.83s`** on average (`+9.4s` longer than the other five languages).

- On fast decoders, Rust's large token payload fully dilutes the initial prefill floor, propelling **`claude-haiku-5.5` to `91.11 tok/s`** (`1,235` tokens in `13.56s` — the single fastest throughput run in the entire 280-run dataset) and **`gpt-5.6-terra` to `74.55 tok/s`** (`1,080` tokens in `14.49s`).
- On verbose or slower decoders, Rust triggers tail-latency spikes: **`gemini-3.8-flash` takes `51.36s`** (`964` tokens, `18.77 tok/s`), **`claude-opus-5` takes `48.67s`** while emitting **`2,701` tokens** (`55.50 tok/s`), and **`claude-opus-4.8` takes `36.44s`** (`1,900` tokens).

---

## 6. Complete 28-Model Benchmark Leaderboard & Reference Table

The table below consolidates all 28 models ordered by **6-Language Coding Throughput (`tok/s`)**, alongside their 1-word baseline floor, 500-word prose generation metrics, implied post-prefill streaming speed, and logic-puzzle reasoning latency:

| Rank (Code) | Model | Family | 1-Word Floor (`s`) | Long Prose (`tok/s`) | Long Time (`s` / `tok`) | Implied Marginal Stream (`tok/s`) | Coding Avg (`tok/s`) | Coding Mean Time (`s` / `tok`) | Logic Low → High (`s`) |
| ---: | :--- | :--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| **1** | `claude-haiku-5.5` | Claude | 7.76 | 62.49 | 14.16s / 885 | ~138 | **63.6** | **11.49s** / 744 | 7.99 → 9.45 |
| **2** | `claude-sonnet-5.5` | Claude | **7.67** | 56.67 | 17.89s / 1014 | ~99 | **54.7** | 13.75s / 761 | 8.46 → 8.25 |
| **3** | `gpt-5.4-mini` | GPT | 9.49 | 68.65 | 12.25s / 841 | **~305** | **51.6** | 13.75s / 705 | 10.58 → 10.79 |
| **4** | `claude-opus-5` | Claude | 8.02 | 37.62 | 24.19s / 910 | ~56 | **49.3** | 32.19s / **1634** | 8.20 → 8.42 |
| **5** | `claude-opus-5.5` | Claude | 7.76 | 44.31 | 18.87s / 836 | ~75 | **49.2** | 20.44s / 1015 | 8.55 → 8.39 |
| **6** | `gpt-5.6-terra` | GPT | 9.34 | 49.03 | 19.17s / 940 | ~96 | **49.1** | **12.58s** / 634 | 9.51 → 10.36 |
| **7** | `claude-sonnet-5` | Claude | 7.69 | 45.33 | 20.03s / 908 | ~74 | **45.0** | 16.35s / 747 | 8.50 → 7.95 |
| **8** | `gemini-4-argon` | Gemini | 9.23 | 53.46 | 17.38s / 929 | ~114 | **43.5** | 16.22s / 723 | 10.49 → 11.10 |
| **9** | `mai-code-1.1-flash` | MAI | 9.17 | **69.42** | **12.14s** / 843 | **~284** | **42.2** | 16.57s / 667 | 11.49 → 11.22 |
| **10** | `gpt-5-mini` | GPT | 10.01 | 52.66 | 17.79s / 937 | ~120 | **41.8** | 21.37s / 856 | 11.13 → 17.57 |
| **11** | `gpt-5.3-codex` | GPT | 9.25 | 47.14 | 20.37s / 960 | ~86 | **39.4** | 17.18s / 691 | 9.70 → 11.05 |
| **12** | `claude-opus-4.8` | Claude | 8.13 | 36.70 | 25.07s / 920 | ~54 | **38.9** | 21.26s / 876 | 8.77 → 8.70 |
| **13** | `gpt-5.4` | GPT | 9.31 | 40.06 | 22.14s / 887 | ~69 | **37.7** | 17.27s / 665 | 10.30 → 11.64 |
| **14** | `gpt-5.5` | GPT | 9.36 | 42.58 | 20.13s / 857 | ~80 | **37.7** | 15.67s / 608 | 10.76 → 10.68 |
| **15** | `gpt-5.6-sol` | GPT | 9.42 | 46.88 | 21.33s / 1000 | ~84 | **36.7** | 14.90s / 561 | 9.45 → 9.61 |
| **16** | `gpt-6-luna` | GPT | 9.03 | 47.95 | 17.08s / 819 | ~102 | **35.7** | 13.96s / 512 | 9.47 → 11.10 |
| **17** | `claude-fable-5` | Claude | 9.56 | 34.04 | 25.00s / 851 | ~55 | **35.5** | 16.95s / 616 | 9.86 → 9.92 |
| **18** | `gpt-5.6-luna` | GPT | 9.28 | 54.55 | 15.43s / 842 | ~137 | **34.3** | 13.42s / 476 | 9.20 → 10.97 |
| **19** | `gemini-3.7-flash` | Gemini | 8.59 | 33.53 | 21.11s / 708 | ~57 | **33.7** | 19.06s / 646 | 9.32 → 12.90 |
| **20** | `grok-4.7` | Grok | 9.07 | 34.93 | 22.04s / 770 | ~59 | **33.4** | 18.57s / 608 | 9.97 → 11.03 |
| **21** | `gpt-6-sol` | GPT | 9.20 | 42.87 | 17.12s / 734 | ~93 | **32.8** | 14.34s / 481 | 9.74 → 10.82 |
| **22** | `grok-4.5` | Grok | 9.21 | 29.86 | 29.10s / 869 | ~44 | **32.2** | 16.73s / 556 | 9.88 → 11.01 |
| **23** | `claude-haiku-4.5` | Claude | 7.98 | 58.39 | 17.73s / 1035 | ~106 | **31.4** | 25.41s / 780 | `fail` / `fail` |
| **24** | `gemini-3.8-flash` | Gemini | 8.77 | 43.89 | 19.41s / 852 | ~80 | **30.8** | 24.69s / 639 | 9.01 → 12.15 |
| **25** | `auto` | Router | 13.72 | 50.17 | 16.02s / 804 | **~350** | **29.7** | 15.27s / 466 | `fail` / `fail` |
| **26** | `gpt-6.1-sol` | GPT | 9.03 | 35.99 | 26.53s / 955 | ~55 | **27.3** | 21.44s / 593 | 11.11 → 12.35 |
| **27** | `gpt-6-astra` | GPT | 10.02 | 34.38 | 27.16s / 934 | ~55 | **26.3** | 23.27s / 628 | 11.02 → 13.65 |
| **28** | `grok-4.6` | Grok | 10.91 | 25.57 | 25.61s / 655 | ~45 | **24.8** | 19.09s / 475 | 9.55 → 10.64 |

---

## 7. Practical Takeaways for Selecting GitHub Copilot Models

1. **Pin a concrete hosted model instead of `auto` for latency-sensitive workloads:** Targeting `auto` incurs a **13.72s** baseline floor (`4.5–6.0s` slower than calling Claude or GPT models directly) and throws an error if a reasoning-effort parameter is supplied.
2. **For the fastest interactive coding loops, pick from the Pareto frontier:**
   - **`claude-haiku-5.5`** (`11.49s` mean coding time, `63.6 tok/s`) is the undisputed speed king across all six programming languages (`10.19s` in Python to `13.56s` in Rust).
   - **`gpt-5.6-terra`** (`12.58s` mean coding time, `49.1 tok/s`) and **`claude-sonnet-5.5`** (`13.75s` mean coding time, `54.7 tok/s`) offer the best balance of frontier coding capability and sub-14-second wall-clock turnaround.
   - **`gpt-5.4-mini`** (`13.75s` coding, `12.25s` long prose) and **`mai-code-1.1-flash`** (`12.14s` long prose, `69.42 tok/s`) are ideal when generating long markdown documentation, commit summaries, or release notes.
3. **Prefer `claude-opus-5.5` over `claude-opus-5` for heavy reasoning + code:** `claude-opus-5.5` matches `claude-opus-5`'s throughput (`49.2` vs. `49.3 tok/s`) while cutting excessive token verbosity from `1,634` to `1,015` tokens and reducing average coding wait time from **32.19s down to 20.44s**.
4. **Always pair `tok/s` with wall-clock time and token volume when evaluating hosted models:** Because every request pays an 8–10 second gateway and prefill floor, end-to-end `tok/s` rewards verbose models and penalizes concise ones. Evaluating models in the **2D Speed–Verbosity Phase Space** prevents you from mistaking boilerplate volume for raw inference speed.
