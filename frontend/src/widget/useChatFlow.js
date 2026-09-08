import { useEffect, useRef, useState } from "react";

// How long the "bot is typing…" indicator shows before a reply appears.
// Short enough to feel snappy, long enough to read as a real reply being
// composed rather than an instant lookup.
const TYPING_DELAY_MS = 550;

/**
 * Client-side traversal of the flow tree returned by
 * GET /api/public/bots/:slug. Shared by the normal and voice engines
 * (mirrors how ramajeyam-chatbot / ManiMark both load the whole tree
 * up front and walk it in the browser).
 *
 * Every node has a `nodeType`:
 *   "message"  (default) -> rendered as text + tappable options, advanced
 *                            via choose(option)
 *   "products" -> rendered as a card grid; advanced via advance(node.productsNext)
 *                 when the Admin configured a "Continue" target
 *   "form"     -> rendered as a dynamic form; advanced via advance(node.formNext)
 *                 after a successful submit
 *
 * `isTyping` is exposed so the UI can render a "bot is typing…" bubble
 * (see .widget-typing in widget.css) between the user's action and the
 * next bot message actually appearing.
 */
export function useChatFlow(bot, language) {
  const languageFlow = bot?.flow?.[language];
  const [currentKey, setCurrentKey] = useState(languageFlow?.start);
  const [messages, setMessages] = useState(() =>
    languageFlow ? [{ sender: "bot", text: languageFlow.questions[languageFlow.start]?.text }] : []
  );
  const [path, setPath] = useState([]);
  const [finished, setFinished] = useState(false);
  // true once the conversation ended by a dynamic "form" node being
  // submitted successfully -> skip the legacy generic contact form, since
  // the form node already collected whatever the Admin asked for.
  const [endedByForm, setEndedByForm] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  // true when an option/step points at a node key that doesn't exist in the
  // flow this widget actually loaded (almost always: the Admin added/edited
  // that node in the Chatbot Builder but never hit "Generate"/"Publish"
  // again afterwards, so the *live* bot is still running the older tree).
  // Surfaced by NormalEngine as a friendly notice instead of silently
  // falling through to the generic contact form, which looked like the
  // step/product/etc. content had simply vanished.
  const [brokenLink, setBrokenLink] = useState(null);
  const typingTimeout = useRef(null);

  useEffect(() => {
    return () => {
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
    };
  }, []);

  // Reset the whole conversation whenever the customer switches language
  // (e.g. taps "தமிழ்" in the header) or a different bot loads.
  //
  // Without this, switching language did nothing to `messages`/`currentKey`:
  // both are seeded once via useState's lazy initializer above, which only
  // ever runs on the component's very first render — changing the
  // `language` prop afterwards does NOT re-run it. So a customer who
  // opened the bot in English (loading the English Q1 greeting into
  // `messages`) and then tapped Tamil kept seeing that *same* English Q1
  // message: the header/labels updated, but the chat body still showed
  // English text under "Tamil". In the AI Voice Chatbot this compounded
  // into "Tamil voice doesn't work", because VoiceEngine dutifully sent
  // that leftover *English* text to be spoken with a Tamil voice —
  // producing garbled/incorrect speech (or the "no Tamil voice" notice)
  // even on devices with a perfectly good Tamil voice installed, since the
  // text it was asked to speak was never actually Tamil to begin with.
  useEffect(() => {
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    setIsTyping(false);
    setBrokenLink(null);
    setFinished(false);
    setEndedByForm(false);
    setPath([]);
    setCurrentKey(languageFlow?.start);
    setMessages(
      languageFlow ? [{ sender: "bot", text: languageFlow.questions[languageFlow.start]?.text }] : []
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, bot]);

  const currentNode = languageFlow?.questions?.[currentKey];

  // Shared "reveal the next bot node after a short typing pause" step,
  // used by both choose() and advance() below.
  const revealNext = (nextKey, { onNoNext } = {}) => {
    if (nextKey && !languageFlow.questions[nextKey]) {
      // A key was specified but isn't in the loaded tree -> almost always a
      // stale/unpublished flow, not an intentional "end here". Warn loudly
      // in devtools and let the UI say so, instead of quietly acting as if
      // there were nothing configured at all.
      console.warn(
        `[chatbot] "${currentKey}" points to node "${nextKey}", which isn't in the published flow. ` +
          `Did you forget to re-generate/publish the bot after your last edit?`
      );
      setBrokenLink({ from: currentKey, to: nextKey });
      onNoNext?.();
      return;
    }
    if (!nextKey) {
      onNoNext?.();
      return;
    }

    setBrokenLink(null);
    setIsTyping(true);
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      const nextNode = languageFlow.questions[nextKey];
      setCurrentKey(nextKey);
      setMessages((prev) => [...prev, { sender: "bot", text: nextNode.text }]);
      setIsTyping(false);

      if ((nextNode.nodeType || "message") === "message" && nextNode.isEnd) {
        setFinished(true);
      }
    }, TYPING_DELAY_MS);
  };

  const choose = (option) => {
    setMessages((prev) => [...prev, { sender: "user", text: option.text }]);

    setPath((prev) => [
      ...prev,
      {
        questionKey: currentKey,
        questionText: currentNode?.text,
        selectedLabel: option.label,
        selectedText: option.text,
      },
    ]);

    // Optional external link (see backend/models/Chatbot.js -> optionSchema
    // "url"). Opens in a new tab regardless of whether "next" is also set.
    if (option.url) {
      window.open(option.url, "_blank", "noopener,noreferrer");
    }

    if (option.next) {
      revealNext(option.next, { onNoNext: () => setFinished(true) });
    } else if (!option.url) {
      // No link and nowhere to go — legacy behavior: ends the conversation
      // (falls through to the generic contact form).
      setFinished(true);
    }
    // else: link-only option (no "next") — stays on the current node so
    // the customer can still pick one of the other options.
  };

  /**
   * Move on from a "products" or "form" node to whatever comes next
   * (or mark the conversation finished if there's nowhere to go).
   *
   * opts.summaryText -> recorded into `path` as a user-side step (e.g. a
   *                     one-line recap of what was submitted/picked)
   * opts.viaForm      -> pass true when this advance happened right after a
   *                      dynamic form node's successful submit, so we don't
   *                      show the legacy generic contact form on top of it
   */
  const advance = (nextKey, opts = {}) => {
    const { summaryText, viaForm } = opts;

    if (summaryText) {
      setMessages((prev) => [...prev, { sender: "user", text: summaryText }]);
      setPath((prev) => [
        ...prev,
        { questionKey: currentKey, questionText: currentNode?.text, selectedLabel: "", selectedText: summaryText },
      ]);
    }

    revealNext(nextKey, {
      onNoNext: () => {
        setFinished(true);
        if (viaForm) setEndedByForm(true);
      },
    });
  };

  return { languageFlow, currentNode, messages, path, finished, endedByForm, isTyping, brokenLink, choose, advance };
}