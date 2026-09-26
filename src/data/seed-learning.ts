import type { Deck, Flashcard, ReviewLog } from "@/domain/types";
import { newMemory, review, type Rating } from "@/domain/srs";
import { toKey } from "@/lib/dates";

type Raw = { f: string; b: string; ex?: string; n?: string; t?: string[] };

const DECKS: {
  key: string;
  name: string;
  description: string;
  icon: string;
  tone: Deck["tone"];
  cards: Raw[];
}[] = [
  {
    key: "ml",
    name: "Machine Learning",
    description: "Core concepts for the reading group and interviews.",
    icon: "brain",
    tone: "iris",
    cards: [
      {
        f: "What is an embedding?",
        b: "A dense, low-dimensional vector representation of a discrete object (word, item, user) learned so that similar objects end up close together in vector space.",
        ex: "word2vec maps “king” and “queen” to nearby vectors.",
        t: ["nlp", "representation"],
      },
      {
        f: "Bias–variance trade-off",
        b: "Simple models underfit (high bias); flexible models overfit (high variance). Total error = bias² + variance + irreducible noise.",
        t: ["fundamentals"],
      },
      {
        f: "What does dropout do?",
        b: "Randomly zeroes a fraction of activations during training, preventing co-adaptation of neurons and acting as a regulariser.",
        t: ["regularisation", "deep-learning"],
      },
      {
        f: "Precision vs. recall",
        b: "Precision = TP / (TP + FP): how many predicted positives are right. Recall = TP / (TP + FN): how many actual positives were found.",
        ex: "A spam filter that flags little but is always right has high precision, low recall.",
        t: ["metrics"],
      },
      {
        f: "What is attention (in transformers)?",
        b: "A mechanism that computes a weighted sum of value vectors, where weights come from the similarity (softmax of scaled dot product) between a query and keys.",
        ex: "softmax(QKᵀ / √dₖ) · V",
        t: ["transformers"],
      },
      {
        f: "Gradient descent learning rate too high?",
        b: "Updates overshoot the minimum; loss oscillates or diverges.",
        t: ["optimisation"],
      },
      {
        f: "What is cross-validation?",
        b: "Splitting data into k folds, training on k−1 and validating on the remaining fold, rotating so every fold is used for validation once.",
        t: ["evaluation"],
      },
      {
        f: "L1 vs. L2 regularisation",
        b: "L1 (lasso) adds |w| — drives weights to exactly zero (sparsity). L2 (ridge) adds w² — shrinks weights smoothly.",
        t: ["regularisation"],
      },
      {
        f: "What is a confusion matrix?",
        b: "A table of predicted vs. actual classes showing TP, FP, FN and TN counts.",
        t: ["metrics"],
      },
      {
        f: "Batch normalisation",
        b: "Normalises layer inputs per mini-batch to zero mean / unit variance, then applies a learned scale and shift. Speeds up and stabilises training.",
        t: ["deep-learning"],
      },
      {
        f: "What is RAG?",
        b: "Retrieval-augmented generation: retrieve relevant documents (often via embeddings) and pass them to an LLM as context for grounded answers.",
        t: ["llm"],
      },
      {
        f: "Softmax",
        b: "Turns a vector of logits into a probability distribution: eˣⁱ / Σ eˣʲ.",
        t: ["fundamentals"],
      },
    ],
  },
  {
    key: "fr",
    name: "French Vocabulary",
    description: "Everyday words for the Lisbon → Paris trip.",
    icon: "languages",
    tone: "sky",
    cards: [
      {
        f: "la bibliothèque",
        b: "the library",
        ex: "Je travaille à la bibliothèque le mardi.",
        t: ["places"],
      },
      {
        f: "se débrouiller",
        b: "to manage, to get by",
        ex: "Je me débrouille en français.",
        n: "Very common in spoken French.",
        t: ["verbs"],
      },
      { f: "un rendez-vous", b: "an appointment / a date", t: ["nouns"] },
      {
        f: "d'ailleurs",
        b: "besides, moreover",
        ex: "D'ailleurs, il pleut.",
        t: ["connectors"],
      },
      { f: "la veille", b: "the day before / the eve", t: ["time"] },
      { f: "épuisé(e)", b: "exhausted", t: ["adjectives"] },
      { f: "un tiroir", b: "a drawer", t: ["home"] },
      {
        f: "avoir le cafard",
        b: "to feel down, to have the blues",
        n: "Literally “to have the cockroach”.",
        t: ["idioms"],
      },
      { f: "la facture", b: "the bill / invoice", t: ["nouns"] },
      { f: "davantage", b: "more (formal)", t: ["adverbs"] },
    ],
  },
  {
    key: "sql",
    name: "SQL",
    description: "Query patterns I keep looking up.",
    icon: "database",
    tone: "teal",
    cards: [
      {
        f: "WHERE vs. HAVING",
        b: "WHERE filters rows before grouping; HAVING filters groups after aggregation.",
        ex: "SELECT team, COUNT(*) FROM t GROUP BY team HAVING COUNT(*) > 5",
        t: ["aggregation"],
      },
      {
        f: "What does a LEFT JOIN return?",
        b: "All rows from the left table, with matching right-table columns or NULL when there's no match.",
        t: ["joins"],
      },
      {
        f: "ROW_NUMBER() vs. RANK()",
        b: "ROW_NUMBER gives unique sequential numbers; RANK gives ties the same rank and leaves gaps.",
        t: ["window-functions"],
      },
      {
        f: "What is a CTE?",
        b: "A Common Table Expression — a named temporary result set defined with WITH, usable in the following query.",
        ex: "WITH recent AS (SELECT …) SELECT * FROM recent",
        t: ["syntax"],
      },
      {
        f: "COALESCE(a, b, c)",
        b: "Returns the first non-NULL argument.",
        t: ["functions"],
      },
      {
        f: "What does an index trade off?",
        b: "Faster reads/filters for slower writes and extra storage.",
        t: ["performance"],
      },
    ],
  },
  {
    key: "int",
    name: "Interview Preparation",
    description: "System design + behavioural prompts.",
    icon: "briefcase",
    tone: "amber",
    cards: [
      {
        f: "CAP theorem",
        b: "In a network partition a distributed system must choose between consistency and availability.",
        t: ["system-design"],
      },
      {
        f: "STAR method",
        b: "Situation, Task, Action, Result — a structure for behavioural answers.",
        t: ["behavioural"],
      },
      {
        f: "Idempotency",
        b: "An operation that has the same effect whether applied once or many times.",
        ex: "PUT /users/42 with the same body",
        t: ["api"],
      },
      {
        f: "Back-pressure",
        b: "A consumer signalling a producer to slow down when it can't keep up.",
        t: ["system-design"],
      },
    ],
  },
];

/** Deterministic PRNG so seeded history is stable. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0), s / 4294967296);
}

/**
 * Generates decks + cards, then *simulates* ~5 weeks of reviews through the
 * real scheduler so stability, due dates, streaks and history are coherent.
 */
export function seedLearning(accountId: string, flavor: "personal" | "studio") {
  const rand = rng(
    accountId.split("").reduce((a, c) => a * 33 + c.charCodeAt(0), 11),
  );
  const decks: Deck[] = [];
  const cards: Flashcard[] = [];
  const reviews: ReviewLog[] = [];
  let n = 0;
  const id = (p: string) =>
    `${p}_${accountId.slice(0, 3)}${(++n).toString(36)}`;
  const now = Date.now();
  // Stop simulating at the start of today so today's reviews are still waiting.
  const todayStart = new Date(new Date(now).setHours(0, 0, 0, 0)).getTime();
  const source =
    flavor === "personal" ? DECKS : DECKS.filter((d) => d.key === "fr");

  for (const d of source) {
    const deck: Deck = {
      id: id("d"),
      name: d.name,
      description: d.description,
      icon: d.icon,
      tone: d.tone,
      newPerDay: 10,
      createdAt: new Date(now - 40 * 864e5).toISOString(),
      updatedAt: new Date(now - 864e5).toISOString(),
    };
    decks.push(deck);
    const skill = d.key === "fr" ? 0.72 : d.key === "ml" ? 0.84 : 0.8;
    d.cards.forEach((raw, i) => {
      // later cards were added more recently; the last few stay "new"
      const startDaysAgo = Math.max(0, 36 - i * 3);
      const keepNew = i >= d.cards.length - (d.key === "int" ? 2 : 3);
      let mem = newMemory(new Date(now - startDaysAgo * 864e5));
      const created = new Date(now - (startDaysAgo + 1) * 864e5).toISOString();
      const cid = id("c");
      if (!keepNew) {
        let t = now - startDaysAgo * 864e5 + 9 * 3600e3;
        for (let guard = 0; guard < 40 && t < todayStart; guard++) {
          const at = new Date(t);
          const p =
            mem.state === "new"
              ? skill - 0.15
              : skill + Math.min(0.12, mem.stability / 200);
          const x = rand();
          const rating: Rating =
            x > p ? 1 : x > p - 0.12 ? 2 : x < 0.12 ? 4 : 3;
          const elapsed = mem.lastReview
            ? (t - new Date(mem.lastReview).getTime()) / 864e5
            : 0;
          const prev = mem.state;
          mem = review(mem, rating, at);
          reviews.push({
            id: id("r"),
            cardId: cid,
            deckId: deck.id,
            rating,
            prevState: prev,
            elapsedDays: Math.round(elapsed * 10) / 10,
            scheduledDays:
              Math.round(((new Date(mem.due).getTime() - t) / 864e5) * 100) /
              100,
            day: toKey(at),
            at: at.toISOString(),
            ms: 2500 + Math.round(rand() * 7000),
          });
          // learning steps are same-session; jump to next due time
          t = Math.max(new Date(mem.due).getTime(), t + 60_000);
        }
      }
      // A realistic backlog: cards coming up in the next few days are treated as due this morning.
      if (
        !keepNew &&
        new Date(mem.due).getTime() - todayStart < 10 * 864e5 &&
        rand() < 0.85
      ) {
        mem = { ...mem, due: new Date(todayStart + 7 * 3600e3).toISOString() };
      }
      cards.push({
        id: cid,
        deckId: deck.id,
        front: raw.f,
        back: raw.b,
        example: raw.ex,
        note: raw.n,
        tags: raw.t ?? [],
        source: { kind: "manual" },
        memory: mem,
        createdAt: created,
        updatedAt: mem.lastReview ?? created,
      });
    });
  }
  // Fill any gaps in the last 9 days with a short practice pass so the demo has a streak.
  const reviewedCards = cards.filter((c) => c.memory.state !== "new");
  for (let back = 9; back >= 1 && reviewedCards.length; back--) {
    const day = new Date(todayStart - back * 864e5 + 19 * 3600e3);
    if (reviews.some((r) => r.day === toKey(day))) continue;
    for (let k = 0; k < 3; k++) {
      const c = reviewedCards[Math.floor(rand() * reviewedCards.length)];
      const at = new Date(day.getTime() + k * 40_000);
      reviews.push({
        id: id("r"),
        cardId: c.id,
        deckId: c.deckId,
        rating: rand() < 0.85 ? 3 : 2,
        prevState: "review",
        elapsedDays: 1,
        scheduledDays: 0,
        day: toKey(at),
        at: at.toISOString(),
        ms: 3000 + Math.round(rand() * 5000),
      });
    }
  }
  return {
    decks,
    cards,
    reviews: reviews.sort((a, b) => (a.at < b.at ? -1 : 1)),
  };
}
