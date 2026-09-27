"use client";

import "katex/dist/katex.min.css";
import { memo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

const chat: Components = {
  p: ({ children }) => <p className="my-1.5 first:mt-0 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="my-1.5 list-disc space-y-0.5 pl-5 marker:text-faint">{children}</ul>,
  ol: ({ children }) => <ol className="my-1.5 list-decimal space-y-0.5 pl-5 marker:text-faint">{children}</ol>,
  strong: ({ children }) => <strong className="font-semibold text-ink">{children}</strong>,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-ios-blue underline decoration-ios-blue/30 underline-offset-2">
      {children}
    </a>
  ),
  code: ({ children, className }) =>
    className ? (
      <code className={`${className} font-mono text-[13px]`}>{children}</code>
    ) : (
      <code className="rounded-md bg-black/[0.06] px-1.5 py-0.5 font-mono text-[0.88em]">{children}</code>
    ),
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto rounded-xl bg-ink px-3.5 py-3 text-[13px] leading-relaxed text-white/90">{children}</pre>
  ),
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto rounded-xl border border-black/[0.08] bg-white">
      <table className="w-full border-collapse text-[13.5px]">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border-b border-black/[0.08] bg-surface px-3 py-1.5 text-left font-semibold">{children}</th>,
  td: ({ children }) => <td className="border-b border-black/[0.05] px-3 py-1.5 align-top last:border-0">{children}</td>,
  blockquote: ({ children }) => <blockquote className="my-2 border-l-2 border-black/15 pl-3 text-ink-soft">{children}</blockquote>,
  h1: ({ children }) => <p className="my-1.5 font-semibold">{children}</p>,
  h2: ({ children }) => <p className="my-1.5 font-semibold">{children}</p>,
  h3: ({ children }) => <p className="my-1.5 font-semibold">{children}</p>,
};

/** Document typography for the preview panel (a "page"). */
const page: Components = {
  ...chat,
  h1: ({ children }) => <h1 className="mb-4 mt-2 text-[28px] font-semibold leading-tight tracking-[-0.025em]">{children}</h1>,
  h2: ({ children }) => <h2 className="mb-2 mt-7 text-[19px] font-semibold tracking-[-0.015em]">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-1.5 mt-5 text-[16px] font-semibold">{children}</h3>,
  p: ({ children }) => <p className="my-2.5 leading-[1.65] text-ink-soft">{children}</p>,
  ul: ({ children }) => <ul className="my-2.5 list-disc space-y-1 pl-5 leading-[1.6] text-ink-soft marker:text-faint">{children}</ul>,
  ol: ({ children }) => <ol className="my-2.5 list-decimal space-y-1 pl-5 leading-[1.6] text-ink-soft marker:text-faint">{children}</ol>,
  hr: () => <hr className="my-6 border-black/10" />,
};

type Props = { text: string; variant?: "chat" | "page" };

/**
 * Markdown + GFM tables + KaTeX math. Memoised on the text, so finished messages
 * never re-render while another one streams.
 */
export const Markdown = memo(function Markdown({ text, variant = "chat" }: Props) {
  return (
    <ReactMarkdown
      // A single $ is money ("$400"); math is always $$…$$ (inline or on its own line).
      // remark-breaks: a single newline is a line break, like in a text message.
      remarkPlugins={[remarkGfm, remarkBreaks, [remarkMath, { singleDollarTextMath: false }]]}
      rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: "ignore" }]]}
      components={variant === "page" ? page : chat}
    >
      {text}
    </ReactMarkdown>
  );
});
