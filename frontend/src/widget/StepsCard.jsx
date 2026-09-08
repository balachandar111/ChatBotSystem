import { useEffect, useState } from "react";
import { StepPlaceholderIcon } from "./Icons.jsx";

/**
 * Renders a "steps" flow node: the Admin's dynamically-added instruction
 * steps (image + title + description), shown one at a time with Back/Next
 * navigation and a progress dial, finishing on a closing screen — mirrors
 * the interactive cooking-instructions card pattern from the reference
 * chatbot design.
 *
 * `onDone(nextKey)` is called once the customer taps through the closing
 * screen, advancing the flow to `node.stepsNext` (or ending it).
 */
export default function StepsCard({ node, onDone }) {
  const steps = node.steps || [];
  const [index, setIndex] = useState(0);

  // Reset back to step 1 whenever we land on a *different* steps node
  // (e.g. picking another product/method, or restarting).
  useEffect(() => {
    setIndex(0);
  }, [node]);

  const total = steps.length;
  const isClosing = index >= total; // one virtual "done" screen past the last step
  const step = isClosing
    ? {
        image: node.closingImage || "",
        title: node.closingTitle || "All done! 🎉",
        desc: node.closingMessage || "Thanks for following along.",
      }
    : steps[index];

  if (!step) return null;

  return (
    <div className="widget-products">
      <div className="widget-step-card">
        {!isClosing && (
          <div className="widget-step-progress" role="progressbar" aria-valuenow={index + 1} aria-valuemax={total}>
            {steps.map((_, i) => (
              <span
                key={i}
                className={`widget-step-dot ${i <= index ? "widget-step-dot-done" : ""} ${i === index ? "widget-step-dot-active" : ""}`}
              />
            ))}
          </div>
        )}

        <div className={`widget-step-visual-wrap ${isClosing ? "widget-step-visual-wrap-celebrate" : ""}`}>
          {step.image ? (
            <img src={step.image} alt={step.title} className="widget-step-photo" />
          ) : (
            <StepPlaceholderIcon className="widget-step-illustration" />
          )}
        </div>

        {!isClosing && (
          <div className="widget-step-counter">
            Step {index + 1} of {total}
          </div>
        )}

        <div className="widget-step-title">{step.title}</div>
        {step.desc && <div className="widget-step-desc">{step.desc}</div>}

        <div className="widget-step-nav">
          {!isClosing && index > 0 && (
            <button type="button" className="widget-step-btn widget-step-btn-ghost" onClick={() => setIndex((i) => Math.max(0, i - 1))}>
              ← Back
            </button>
          )}
          {!isClosing && (
            <button type="button" className="widget-step-btn widget-step-btn-primary" onClick={() => setIndex((i) => i + 1)}>
              {index === total - 1 ? "Finish" : "Next"} →
            </button>
          )}
          {isClosing && (
            <button type="button" className="widget-step-btn widget-step-btn-primary" onClick={() => onDone(node.stepsNext)}>
              {node.stepsNext ? "Continue" : "Done"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}