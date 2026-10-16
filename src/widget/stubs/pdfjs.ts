// Replacement for chat-component's pdf.js imports. The bundled copy is ~2.6MB
// and only powers in-bubble PDF thumbnails; the assistant disables media, so
// nobody ever sees one. getDocument() rejects, so chat-component falls back to
// the static document card. It must not throw at module load: in the IIFE the
// dynamic import is inlined and a top-level throw would kill the whole widget.
export const GlobalWorkerOptions = { workerSrc: '' };
export const getDocument = () => {
  throw new Error('pdf.js is not bundled in the assistant widget');
};
export default { GlobalWorkerOptions, getDocument };
