import { useEffect, useRef } from "react";
import { useChatFlow } from "./useChatFlow.js";
import ProductGrid from "./ProductGrid.jsx";
import DynamicForm from "./DynamicForm.jsx";
import StepsCard from "./StepsCard.jsx";
import { BotBadgeIcon } from "./Icons.jsx";

/**
 * Text/button chat engine -- mirrors ramajeyam-chatbot's Chatbot.jsx.
 * No voice, just the tree rendered as bubbles + tappable option buttons,
 * plus Admin-configured "products" grids and dynamic "form" nodes.
 *
 * `theme` (from BotWidget, see backend/models/Chatbot.js -> themeSchema) is
 * used here only for the bot's avatar next to its messages -- everything
 * else (colors, background) is applied globally as CSS variables on the
 * widget shell, see widget.css.
 */
export default function NormalEngine({ bot, language, sessionId, slug, theme }) {
  const { currentNode, messages, path, finished, endedByForm, isTyping, brokenLink, choose, advance } = useChatFlow(
    bot,
    language
  );

  const nodeType = currentNode?.nodeType || "message";
  const bodyEndRef = useRef(null);

  // Keep the newest message (or the typing indicator) in view, the same
  // way any modern chat app scrolls itself.
  useEffect(() => {
    bodyEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isTyping, nodeType]);

  const BotAvatar = () => (
    <span className="widget-avatar">
      {theme?.logoUrl ? (
        <img src={theme.logoUrl} alt="" className="widget-avatar-img" />
      ) : (
        <BotBadgeIcon className="widget-avatar-icon" />
      )}
    </span>
  );

  return (
    <div className="widget-body">
      {messages.map((m, i) => (
        <div key={i} className={`widget-msg-row widget-msg-row-${m.sender}`}>
          {m.sender === "bot" && <BotAvatar />}
          <div className={`bubble bubble-${m.sender}`}>{m.text}</div>
        </div>
      ))}

      {isTyping && (
        <div className="widget-msg-row widget-msg-row-bot">
          <BotAvatar />
          <div className="bubble bubble-bot widget-typing">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      )}

      {!isTyping && !finished && nodeType === "message" && currentNode && !currentNode.isEnd && (
        <div className="widget-options">
          {currentNode.options.map((opt, i) => (
            <button key={i} className="option-btn" onClick={() => choose(opt)}>
              <span className="opt-label">{opt.label}</span>
              <span style={{ flex: 1 }}>{opt.text}</span>
              {opt.url && (
                <span className="opt-link-badge" title="Opens a link">
                  ↗
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {!isTyping && !finished && nodeType === "products" && currentNode && (
        <ProductGrid node={currentNode} onContinue={(next) => advance(next)} />
      )}

      {!isTyping && !finished && nodeType === "steps" && currentNode && (
        <StepsCard node={currentNode} onDone={(next) => advance(next)} />
      )}

      {!isTyping && !finished && nodeType === "form" && currentNode && (
        <DynamicForm
          node={currentNode}
          slug={slug}
          sessionId={sessionId}
          language={language}
          path={path}
          onSubmitted={(nextKey, summary) => advance(nextKey, { summaryText: summary, viaForm: true })}
        />
      )}

      {!isTyping && finished && brokenLink && (
        <p className="widget-thanks">
          This part of the chat isn't available right now — please try again shortly, or contact us directly.
        </p>
      )}

      {!isTyping && finished && !brokenLink && endedByForm && (
        <p className="widget-thanks">Thanks — we've received your details.</p>
      )}

      <div ref={bodyEndRef} />
    </div>
  );
}