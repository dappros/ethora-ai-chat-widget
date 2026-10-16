// Captions of the widget's OWN chrome (launcher, header, empty state) plus the
// language list for the header picker. Everything inside the conversation is
// translated by chat-component's string table, reached through
// `config.i18n.locale`; this file only covers what the shell renders itself.
import {
  resolveStringTable,
  interpolate,
  toBaseLanguage,
} from '@ethora/chat-component/i18n/strings';

export interface WidgetLanguage {
  /** Regional id handed to chat-component, same ids as its LANGUAGE_OPTIONS. */
  id: string;
  /** Endonym, so a reader can find their language whatever the UI is in. */
  name: string;
}

export const WIDGET_LANGUAGES: WidgetLanguage[] = [
  { id: 'en-CA', name: 'English' },
  { id: 'es-US', name: 'Español' },
  { id: 'fr-CA', name: 'Français' },
];

type Table = Record<string, string>;

const WIDGET_STRINGS: Record<string, Table> = {
  en: {
    'widget.open': 'Open {name}',
    'widget.close': 'Close assistant chat',
    'widget.expand': 'Expand',
    'widget.collapse': 'Collapse',
    'widget.cta': 'Ask me anything!',
    'widget.resize': 'Drag to resize, double-click to reset',
    'widget.online': 'Online, replies instantly',
    'widget.emptyTitle': 'Ask me anything',
    'widget.emptyBody': 'Usually replies in a few seconds',
    'widget.greeting': 'Hi there! What can I help you with today?',
  },
  fr: {
    'widget.open': 'Ouvrir {name}',
    'widget.close': "Fermer le chat de l'assistant",
    'widget.expand': 'Agrandir',
    'widget.collapse': 'Réduire',
    'widget.cta': 'Posez-moi vos questions !',
    'widget.resize': 'Glisser pour redimensionner, double-clic pour réinitialiser',
    'widget.online': 'En ligne, répond instantanément',
    'widget.emptyTitle': 'Posez-moi une question',
    'widget.emptyBody': 'Répond en quelques secondes',
    'widget.greeting': 'Bonjour ! Comment puis-je vous aider aujourd’hui ?',
  },
  es: {
    'widget.open': 'Abrir {name}',
    'widget.close': 'Cerrar el chat del asistente',
    'widget.expand': 'Ampliar',
    'widget.collapse': 'Reducir',
    'widget.cta': '¡Pregúntame lo que quieras!',
    'widget.resize': 'Arrastra para cambiar el tamaño, doble clic para restablecer',
    'widget.online': 'En línea, responde al instante',
    'widget.emptyTitle': 'Pregúntame lo que quieras',
    'widget.emptyBody': 'Suele responder en unos segundos',
    'widget.greeting': '¡Hola! ¿En qué puedo ayudarte hoy?',
  },
};

/** The English copy the widget ships, to tell "untouched default" from "operator wrote this". */
export const DEFAULT_COPY = {
  cta: WIDGET_STRINGS.en['widget.cta'],
  emptyTitle: WIDGET_STRINGS.en['widget.emptyTitle'],
  greeting: WIDGET_STRINGS.en['widget.greeting'],
};

export type WidgetT = (key: string, vars?: Record<string, string | number>) => string;

export function makeT(locale: string): WidgetT {
  const base = toBaseLanguage(locale);
  const own = { ...WIDGET_STRINGS.en, ...(WIDGET_STRINGS[base] || {}) };
  const engine = resolveStringTable(locale);
  return (key, vars) => interpolate(own[key] ?? engine[key] ?? key, vars);
}

/** The language id in WIDGET_LANGUAGES that matches a BCP-47 tag, or undefined. */
export function matchLanguage(locale?: string | null): string | undefined {
  const base = toBaseLanguage(locale);
  return WIDGET_LANGUAGES.find((l) => toBaseLanguage(l.id) === base)?.id;
}
