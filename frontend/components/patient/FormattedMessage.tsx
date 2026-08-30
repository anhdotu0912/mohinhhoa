"use client";

import React, { useMemo } from "react";

interface FormattedMessageProps {
  text: string;
  isStreaming?: boolean;
}

function cleanInlineDishPortions(raw: string): string {
  if (!raw) return "";
  // Strip raw multiplier like (×1.47) or (x1.47)
  let res = raw.replace(/\s*\([×xX*]\s*[0-9.]+\)/gi, "");
  // Strip "theo công thức"
  res = res.replace(/\s*theo công thức/gi, "");
  // Normalize nested parentheses like "(1 chén (~150g))" -> "(1 chén · 150g)"
  res = res.replace(/\(\s*([^\(\)]+?)\s*\([~≈]?\s*(\d+\s*[a-zA-Zà-ỹÀ-Ỹ/]+)\)\s*\)/g, "($1 · $2)");
  // Normalize "(~150g)" -> "(150g)"
  res = res.replace(/\([~≈]\s*(\d+\s*[a-zA-Zà-ỹÀ-Ỹ/]+)\)/g, "($1)");
  return res;
}

/**
 * Parses inline markdown like **bold**, *italic*, and renders text with strong tags.
 */
function renderInlineFormatting(content: string): React.ReactNode {
  if (!content) return null;
  const cleaned = cleanInlineDishPortions(content);
  // Regex to split by **bold** or *italic*
  const parts = cleaned.split(/(\*\*.*?\*\*|\*.*?\*)/g);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
      return (
        <strong key={index} className="font-semibold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length >= 2) {
      return (
        <em key={index} className="italic text-slate-700">
          {part.slice(1, -1)}
        </em>
      );
    }
    return part;
  });
}

export function FormattedMessage({ text, isStreaming }: FormattedMessageProps) {
  // Split into distinct blocks by double newline or multiple newlines
  const blocks = useMemo(() => {
    if (!text) return [];
    return text.split(/\n\s*\n/);
  }, [text]);

  if (!text) return null;

  return (
    <div className="space-y-3 text-[15px] leading-relaxed text-slate-800 break-words font-normal">
      {blocks.map((block, blockIdx) => {
        const trimmed = block.trim();
        if (!trimmed) return null;

        const lines = trimmed.split("\n");
        // Check if this block contains list items
        const hasListItems = lines.some((l) => /^\s*([•\-\*]|\d+\.)\s+/.test(l));

        if (hasListItems) {
          return (
            <div key={blockIdx} className="space-y-1.5 my-1.5">
              {lines.map((line, lineIdx) => {
                const bulletMatch = line.match(/^\s*([•\-\*]|\d+\.)\s+(.*)$/);
                if (bulletMatch) {
                  const bullet = bulletMatch[1];
                  const itemContent = bulletMatch[2];
                  return (
                    <div key={lineIdx} className="flex items-start gap-2.5 text-slate-800 pl-0.5">
                      <span className="text-[#006857] font-semibold shrink-0 select-none mt-[0.5px]">
                        {bullet.endsWith(".") ? bullet : "•"}
                      </span>
                      <div className="flex-1 min-w-0 leading-relaxed">
                        {renderInlineFormatting(itemContent)}
                      </div>
                    </div>
                  );
                }
                // Header or regular line inside the block
                return (
                  <p key={lineIdx} className="leading-relaxed font-medium text-slate-900 mt-2 first:mt-0">
                    {renderInlineFormatting(line)}
                  </p>
                );
              })}
            </div>
          );
        }

        // Regular paragraph block
        return (
          <p key={blockIdx} className="leading-relaxed">
            {lines.map((line, lIdx) => (
              <React.Fragment key={lIdx}>
                {renderInlineFormatting(line)}
                {lIdx < lines.length - 1 && <br />}
              </React.Fragment>
            ))}
          </p>
        );
      })}

      {isStreaming && (
        <span className="inline-block w-1.5 h-4 bg-[#006857] ml-1 animate-pulse rounded-xs align-middle" />
      )}
    </div>
  );
}
