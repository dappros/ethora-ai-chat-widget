// No-op replacement for `rehype-raw`. chat-component passes rehype-raw to
// ReactMarkdown to allow raw HTML embedded inside markdown. The AI assistant's
// bot replies are standard markdown (bold/lists/links/code via remark-gfm), so
// raw-HTML support isn't needed - and dropping it removes the parse5 HTML
// parser (~75KB gz). This stub is a unified transformer that returns the tree
// untouched. Raw HTML in a message is simply rendered as escaped text.
export default function rehypeRawStub() {
  return (tree: unknown) => tree;
}
